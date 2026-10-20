"""Date-aware CP-SAT model for semester timetable optimization.

This module is deliberately separate from the weekly template solver. It accepts
plain dictionaries so its scheduling rules can be tested without a database.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from ortools.sat.python import cp_model

from app.constraints.semester_compiler import compile_semester_constraint


ACTIVE_STATUSES = {"scheduled", "completed", "missed"}


def _event_state(day: date, events: list[dict], working_days: set[str]) -> tuple[bool, bool]:
    active = [e for e in events if e["start_date"] <= day <= e["end_date"]]
    override = any(e.get("is_working_day_override") is True for e in active)
    closed = any(e.get("is_closure", False) for e in active) and not override
    return (override or day.strftime("%A") in working_days) and not closed, closed


def solve_semester_schedule(data: dict, max_time_seconds: float = 30.0) -> dict:
    """Solve dated sessions while preserving semester totals and allowing capped holiday makeup.

    Required data keys:
      start_date, end_date, working_days, events, slots, subjects, teachers,
      rooms, teacher_subjects, unavailable_pairs.
    Optional: locked_sessions, teacher_max_periods.
    IDs are integers. Slot dictionaries contain slot_id, day, period_number.
    Subject dictionaries contain subject_id, class_id, periods_per_week,
    subject_type. Teacher-subject links are (teacher_id, subject_id).
    Locked sessions use session_date, class_id, subject_id, teacher_id, room_id,
    slot_id, period_number and is_locked.
    """
    start, end = data["start_date"], data["end_date"]
    if end < start:
        return {"status": "invalid", "reason": "Term end date must be on or after its start date."}
    working_days = set(data["working_days"])
    if not working_days:
        return {"status": "invalid", "reason": "At least one working day is required."}

    slots = list(data["slots"])
    subjects = list(data["subjects"])
    teachers = list(data["teachers"])
    rooms = list(data["rooms"])
    events = list(data.get("events", []))
    teacher_subjects = set(tuple(x) for x in data.get("teacher_subjects", []))
    unavailable = set(tuple(x) for x in data.get("unavailable_pairs", []))
    locked = [x for x in data.get("locked_sessions", []) if x.get("is_locked")]
    subject_by_id = {s["subject_id"]: s for s in subjects}

    slots_by_day = defaultdict(list)
    for slot in slots:
        slots_by_day[slot["day"]].append(slot)

    teachers_by_subject = defaultdict(list)
    for teacher in teachers:
        for subject in subjects:
            if (teacher["teacher_id"], subject["subject_id"]) in teacher_subjects:
                teachers_by_subject[subject["subject_id"]].append(teacher)

    rooms_by_type = defaultdict(list)
    for room in rooms:
        r_type = "lab" if str(room.get("room_type", "")).lower() == "lab" else "theory"
        rooms_by_type[r_type].append(room)

    # Candidate key = (date, slot_id, class_id, subject_id, teacher_id, room_id).
    candidates = {}
    day = start
    while day <= end:
        eligible, _ = _event_state(day, events, working_days)
        if eligible:
            weekday = day.strftime("%A")
            day_slots = slots_by_day.get(weekday, [])
            for subject in subjects:
                subj_type = "lab" if str(subject.get("subject_type", "")).lower() == "lab" else "theory"
                eligible_rooms = rooms_by_type.get(subj_type, [])
                eligible_teachers = teachers_by_subject.get(subject["subject_id"], [])
                for slot in day_slots:
                    sl_id = slot["slot_id"]
                    for teacher in eligible_teachers:
                        if (teacher["teacher_id"], sl_id) in unavailable:
                            continue
                        for room in eligible_rooms:
                            key = (day, sl_id, subject["class_id"],
                                   subject["subject_id"], teacher["teacher_id"], room["room_id"])
                            candidates[key] = None
        day += timedelta(days=1)

    if not candidates:
        return {"status": "infeasible", "reason": "No eligible dated assignments can be formed.", "sessions": []}

    model = cp_model.CpModel()
    assign = {key: model.NewBoolVar("a_" + "_".join(map(str, key)))
              for key in candidates}

    # Pre-index assign variables by (class_id, subject_id) and (class_id, subject_id, date)
    assign_by_subject = defaultdict(list)
    assign_by_subj_date = defaultdict(list)
    for key, var in assign.items():
        session_date, slot_id, class_id, subject_id, teacher_id, room_id = key
        assign_by_subject[(class_id, subject_id)].append((session_date, var))
        assign_by_subj_date[(class_id, subject_id, session_date)].append(var)

    # At most one session per class, teacher, or room at each dated period.
    # Group by period_number, not slot_id: duplicate slot records for the same
    # weekday/period must not allow overlapping assignments.
    slot_by_id = {slot["slot_id"]: slot for slot in slots}
    buckets = defaultdict(list)
    for key, var in assign.items():
        session_date, slot_id, class_id, subject_id, teacher_id, room_id = key
        period_number = slot_by_id[slot_id]["period_number"]
        buckets[("class", session_date, period_number, class_id)].append(var)
        buckets[("teacher", session_date, period_number, teacher_id)].append(var)
        buckets[("room", session_date, period_number, room_id)].append(var)
    for variables in buckets.values():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)

    # Preserve weekly targets while allowing displaced sessions to move later
    # in the semester. If hard resource/calendar limits make some makeup work
    # impossible, expose it as an explicit high-cost shortfall rather than
    # violating a hard constraint or silently dropping sessions.
    weeks = list(_week_starts(start, end))
    makeup_counts = defaultdict(int)
    for preference in data.get("makeup_preferences", []):
        pair = (preference.get("class_id"), preference.get("subject_id"))
        if pair[0] is not None and pair[1] is not None:
            makeup_counts[pair] += 1

    closure_affected_weeks: set[date] = set()
    day = start
    while day <= end:
        _eligible, closed = _event_state(day, events, working_days)
        if closed and day.strftime("%A") in working_days:
            closure_affected_weeks.add(next(_week_starts(day, day)))
        day += timedelta(days=1)

    # Pre-compute per-week eligible teaching-day counts within the term.
    # A week with approved closures may have fewer eligible days than usual.
    # Capping the effective weekly target at this count ensures the required
    # semester total is always physically achievable.
    week_eligible_days: dict = {}
    for week in weeks:
        count = 0
        for offset in range(7):
            d = week + timedelta(days=offset)
            if d < start or d > end:
                continue
            is_eligible, _ = _event_state(d, events, working_days)
            if is_eligible:
                count += 1
        week_eligible_days[week] = count

    makeup_penalties = []
    unresolved_makeups = []
    unresolved_penalties = []
    for subject in subjects:
        target = max(0, int(subject.get("periods_per_week", 0) or 0))
        semester_vars = []
        if target <= 0:
            continue
        weekly_candidates = {}
        subj_assigns = assign_by_subject.get((subject["class_id"], subject["subject_id"]), [])

        # Effective weekly target: capped at the number of eligible days in
        # that week so the required semester total is always achievable.
        week_effective_target: dict = {
            week: min(target, week_eligible_days[week])
            for week in weeks
        }

        for week in weeks:
            week_end = week + timedelta(days=6)
            matching = [var for d, var in subj_assigns if week <= d <= week_end]
            weekly_candidates[week] = matching
            semester_vars.extend(matching)

        displaced_count = makeup_counts[(subject["class_id"], subject["subject_id"])]
        estimated_closure_load = sum(
            target - week_effective_target[w] for w in closure_affected_weeks
        )
        allowed_shortfall = min(
            sum(week_effective_target.values()),
            displaced_count if displaced_count > 0 else estimated_closure_load,
        )
        for week, matching in weekly_candidates.items():
            eff_target = week_effective_target[week]
            extra_capacity = max(
                displaced_count,
                sum(target - week_effective_target[w]
                    for w in closure_affected_weeks if w <= week),
            )
            weekly_capacity = eff_target + extra_capacity
            if matching:
                weekly_total = sum(matching)
                model.Add(weekly_total <= weekly_capacity)
                deviation = model.NewIntVar(
                    0, weekly_capacity,
                    f"weekly_deviation_c{subject['class_id']}_s{subject['subject_id']}_{week}"
                )
                # Two one-sided constraints instead of AddAbsEquality.
                model.Add(deviation >= weekly_total - eff_target)
                model.Add(deviation >= eff_target - weekly_total)
                makeup_penalties.append(deviation)

        # Required semester total = sum of per-week effective targets.
        # This is always achievable regardless of how many holidays reduce capacity.
        required_semester_total = sum(week_effective_target.values())
        # Always use a soft shortfall variable. The 1,000,000 penalty per
        # missing session drives the solver to schedule as many as it can,
        # while never making the whole model infeasible due to slot competition.
        unresolved = model.NewIntVar(
            0, required_semester_total,
            f"unresolved_makeup_c{subject['class_id']}_s{subject['subject_id']}"
        )
        model.Add(sum(semester_vars) + unresolved == required_semester_total)
        unresolved_makeups.append((subject, unresolved))
        unresolved_penalties.append(unresolved)

    # Keep locked assignments fixed. A lock that cannot be represented is a
    # reported infeasibility rather than silently moved or dropped.
    locked_keys = set()
    for item in locked:
        session_date = item["session_date"]
        key_prefix = (session_date, item["slot_id"], item["class_id"],
                      item["subject_id"], item["teacher_id"], item["room_id"])
        if key_prefix not in assign:
            return {
                "status": "infeasible",
                "reason": f"Locked session on {session_date.isoformat()} (class {item['class_id']}, period {item['period_number']}) cannot be represented by an eligible slot. Resolve the lock or calendar conflict before optimizing.",
                "sessions": [],
                "locked_conflicts": [session_date.isoformat()],
            }
        model.Add(assign[key_prefix] == 1)
        locked_keys.add(key_prefix)

    # Compile persisted user-authored constraints against date-aware assignment keys.
    dynamic_penalties = []
    for constraint in data.get("dynamic_constraints", []):
        compiled = compile_semester_constraint(model, assign, constraint, data)
        weight = constraint.weight if constraint.constraint_type == "soft" else None
        if weight is not None and weight != 1:
            # Keep weighted terms as linear expressions instead of creating
            # auxiliary variables from protobuf domains. This avoids fragile
            # Proto() access and lets CP-SAT optimize the weighted objective directly.
            compiled = [penalty * int(weight) for penalty in compiled]
        dynamic_penalties.extend(compiled)

    # Closure makeup preferences are soft objectives: preferred date/period first,
    # then another date in the same ISO week, then any other eligible date.
    preference_penalties = []
    for index, preference in enumerate(data.get("makeup_preferences", [])):
        class_id = preference["class_id"]
        subject_id = preference["subject_id"]
        original_date = preference["original_date"]
        preferred_date = preference.get("preferred_date")
        preferred_period = preference.get("preferred_period")
        relevant = [
            (key, var) for key, var in assign.items()
            if key[2] == class_id and key[3] == subject_id and key[0] != original_date
        ]
        if not relevant:
            continue
        if preferred_date:
            preferred_matches = [
                var for key, var in relevant
                if key[0] == preferred_date
                and (preferred_period is None or slot_by_id[key[1]]["period_number"] == preferred_period)
            ]
            preferred_met = model.NewBoolVar(f"makeup_preferred_met_{index}")
            if preferred_matches:
                model.Add(sum(preferred_matches) >= 1).OnlyEnforceIf(preferred_met)
                model.Add(sum(preferred_matches) == 0).OnlyEnforceIf(preferred_met.Not())
            else:
                model.Add(preferred_met == 0)
            preference_penalties.append((preferred_met.Not(), 1000))
        elif preferred_period is not None:
            # A period can be selected independently of a date. Treat it as a
            # soft preference across eligible replacement dates, never as a
            # hard constraint that can make the semester infeasible.
            period_matches = [
                var for key, var in relevant
                if slot_by_id[key[1]]["period_number"] == preferred_period
            ]
            period_met = model.NewBoolVar(f"makeup_period_met_{index}")
            if period_matches:
                model.Add(sum(period_matches) >= 1).OnlyEnforceIf(period_met)
                model.Add(sum(period_matches) == 0).OnlyEnforceIf(period_met.Not())
            else:
                model.Add(period_met == 0)
            preference_penalties.append((period_met.Not(), 500))
        same_week_matches = [
            var for key, var in relevant
            if key[0].isocalendar()[:2] == original_date.isocalendar()[:2]
        ]
        if same_week_matches:
            same_week_met = model.NewBoolVar(f"makeup_same_week_met_{index}")
            model.Add(sum(same_week_matches) >= 1).OnlyEnforceIf(same_week_met)
            model.Add(sum(same_week_matches) == 0).OnlyEnforceIf(same_week_met.Not())
            preference_penalties.append((same_week_met.Not(), 100))
    preference_weighted_penalties = [penalty * weight for penalty, weight in preference_penalties]

    # Soft preference: discourage exceeding a teacher's daily workload target.
    # Weekly-load preservation is a stronger objective than individual soft preferences.
    penalties = [penalty * 10 for penalty in makeup_penalties]
    # An unresolved session is much more expensive than any preference or
    # distribution penalty. CP-SAT therefore schedules every feasible makeup
    # first, while still reporting the remainder if hard constraints prevent it.
    penalties.extend(penalty * 1_000_000 for penalty in unresolved_penalties)
    penalties.extend(preference_weighted_penalties)
    teacher_daily = defaultdict(list)
    for (session_date, slot_id, class_id, subject_id, teacher_id, room_id), var in assign.items():
        teacher_daily[(teacher_id, session_date)].append(var)
    teacher_max = {t["teacher_id"]: max(0, int(t.get("max_periods_per_day") or 0)) for t in teachers}
    for (teacher_id, session_date), variables in teacher_daily.items():
        limit = teacher_max.get(teacher_id, 0)
        if limit and len(variables) > limit:
            overflow = model.NewIntVar(0, len(variables), f"daily_overflow_t{teacher_id}_{session_date}")
            model.Add(overflow >= sum(variables) - limit)
            penalties.append(overflow)

    # Soft preference: distribute a subject's weekly meetings over different days.
    for week in _week_starts(start, end):
        for subject in subjects:
            day_vars = []
            c_id = subject["class_id"]
            s_id = subject["subject_id"]
            subj_target = max(0, int(subject.get("periods_per_week", 0) or 0))
            for offset in range(7):
                curr_d = week + timedelta(days=offset)
                if curr_d.strftime("%A") in working_days:
                    day_vars_for_subject = assign_by_subj_date.get((c_id, s_id, curr_d), [])
                    if not day_vars_for_subject:
                        continue
                    used = model.NewBoolVar(f"used_s{s_id}_{week}_{curr_d.strftime('%A')}")
                    model.Add(sum(day_vars_for_subject) >= 1).OnlyEnforceIf(used)
                    model.Add(sum(day_vars_for_subject) == 0).OnlyEnforceIf(used.Not())
                    day_vars.append(used)
            if day_vars and subj_target:
                penalty = model.NewIntVar(0, min(subj_target, len(day_vars)), f"spread_s{s_id}_{week}")
                model.Add(penalty >= min(subj_target, len(day_vars)) - sum(day_vars))
                penalties.append(penalty)
    penalties.extend(dynamic_penalties)
    if penalties:
        model.Minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.1, float(max_time_seconds))
    status = solver.Solve(model)
    print("DEBUG: CP-SAT STATUS:", solver.StatusName(status), "WallTime:", solver.WallTime(), solver.ResponseStats())
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "infeasible" if status == cp_model.INFEASIBLE else "no_solution",
            "reason": "Weekly targets, resource availability, calendar dates, or locked assignments conflict.",
            "sessions": [],
        }

    sessions = []
    for (session_date, slot_id, class_id, subject_id, teacher_id, room_id), var in assign.items():
        if solver.Value(var):
            slot = next(s for s in slots if s["slot_id"] == slot_id)
            sessions.append({
                "session_date": session_date,
                "weekday": session_date.strftime("%A"),
                "period_number": slot["period_number"],
                "slot_id": slot_id,
                "class_id": class_id,
                "subject_id": subject_id,
                "teacher_id": teacher_id,
                "room_id": room_id,
                "session_status": "scheduled",
                "is_locked": (session_date, slot_id, class_id, subject_id, teacher_id, room_id) in locked_keys,
                "closure_conflict": False,
            })
    sessions.sort(key=lambda x: (x["session_date"], x["period_number"], x["class_id"]))
    unresolved_summary = []
    for subject, variable in unresolved_makeups:
        missing_count = solver.Value(variable)
        if missing_count > 0:
            unresolved_summary.append({
                "class_id": subject["class_id"],
                "subject_id": subject["subject_id"],
                "unresolved_count": missing_count,
                "reason": "No additional eligible date/period remained inside the semester after applying hard constraints.",
            })

    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "objective_value": solver.ObjectiveValue() if penalties else 0,
        "sessions": sessions,
        "unresolved_makeups": unresolved_summary,
        "locked_conflicts": [],
    }


def _week_starts(start: date, end: date):
    week = start - timedelta(days=start.weekday())
    last = end - timedelta(days=end.weekday())
    while week <= last:
        yield week
        week += timedelta(days=7)
