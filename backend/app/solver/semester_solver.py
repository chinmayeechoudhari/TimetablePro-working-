"""Date-aware CP-SAT model for semester timetable optimization.

Supports:
- Authoritative total semester teaching hours (total_hours)
- Configurable lecture duration (1h, 2h multi-period consecutive blocks)
- Distinct calendar events (Closures with makeups vs. Assessments without makeups)
- Idempotent holiday makeup rescheduling with same-week preference
- Dynamic LLM constraint integration
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from ortools.sat.python import cp_model

from app.constraints.semester_compiler import compile_semester_constraint


ACTIVE_STATUSES = {"scheduled", "completed", "missed"}


def _event_state(day: date, events: list[dict], working_days: set[str]) -> tuple[bool, bool, bool]:
    """Return (is_eligible_for_regular_lectures, is_closure, is_suppressed).

    Precedence rules:
    1. Working-day override overrides routine closure / suppression for the specified date.
    2. Approved closure: college closed, no regular classes, requires holiday makeup.
    3. Approved exam / assessment (suppresses_lectures): college open, no regular classes, NO holiday makeup.
    4. Normal weekday: teachable if day in working_days.
    """
    active = [
        e for e in events
        if e.get("approval_status", "approved") == "approved"
        and e["start_date"] <= day <= e["end_date"]
    ]
    override = any(e.get("is_working_day_override") is True for e in active)
    closed = any(e.get("is_closure", False) for e in active) and not override
    suppressed = any(e.get("suppresses_lectures", False) for e in active) and not override

    if closed:
        return False, True, False
    if suppressed:
        return False, False, True

    is_eligible = (override or day.strftime("%A") in working_days)
    return is_eligible, False, False


def _week_starts(start: date, end: date):
    week = start - timedelta(days=start.weekday())
    last = end - timedelta(days=end.weekday())
    while week <= last:
        yield week
        week += timedelta(days=7)


def solve_semester_schedule(data: dict, max_time_seconds: float = 30.0) -> dict:
    """Solve dated sessions for an academic term.

    Required data keys:
      start_date, end_date, working_days, events, slots, subjects, teachers,
      rooms, teacher_subjects, unavailable_pairs.
    Optional:
      locked_sessions, teacher_max_periods, makeup_preferences, dynamic_constraints.
    """
    start, end = data["start_date"], data["end_date"]
    if end < start:
        return {"status": "invalid", "reason": "Term end date must be on or after its start date.", "sessions": []}
    working_days = set(data["working_days"])
    if not working_days:
        return {"status": "invalid", "reason": "At least one working day is required.", "sessions": []}

    slots = list(data["slots"])
    subjects = list(data["subjects"])
    teachers = list(data["teachers"])
    rooms = list(data["rooms"])
    events = list(data.get("events", []))
    teacher_subjects = set(tuple(x) for x in data.get("teacher_subjects", []))
    unavailable = set(tuple(x) for x in data.get("unavailable_pairs", []))
    locked = [x for x in data.get("locked_sessions", []) if x.get("is_locked")]
    makeup_preferences = list(data.get("makeup_preferences", []))
    is_rescheduling_mode = bool(makeup_preferences)

    # Index slots by day, sorted by period_number
    slots_by_day = defaultdict(list)
    for slot in slots:
        slots_by_day[slot["day"]].append(slot)
    for day_name in slots_by_day:
        slots_by_day[day_name].sort(key=lambda s: s["period_number"])
    slot_by_id = {slot["slot_id"]: slot for slot in slots}

    # Index teachers and rooms
    teachers_by_subject = defaultdict(list)
    for teacher in teachers:
        for subject in subjects:
            if (teacher["teacher_id"], subject["subject_id"]) in teacher_subjects:
                teachers_by_subject[subject["subject_id"]].append(teacher)

    rooms_by_type = defaultdict(list)
    for room in rooms:
        r_type = "lab" if str(room.get("room_type", "")).lower() == "lab" else "theory"
        rooms_by_type[r_type].append(room)

    weeks = list(_week_starts(start, end))
    num_weeks = max(1, len(weeks))

    # Pre-compute eligible days per week
    week_eligible_days = {}
    for week in weeks:
        count = 0
        for offset in range(7):
            d = week + timedelta(days=offset)
            if start <= d <= end:
                is_eligible, _, _ = _event_state(d, events, working_days)
                if is_eligible:
                    count += 1
        week_eligible_days[week] = count

    # Identify weeks affected by closures
    closure_affected_weeks: set[date] = set()
    day = start
    while day <= end:
        _, closed, _ = _event_state(day, events, working_days)
        if closed and day.strftime("%A") in working_days:
            closure_affected_weeks.add(day - timedelta(days=day.weekday()))
        day += timedelta(days=1)

    # Compute subject requirements (total hours, duration, required sessions)
    for subject in subjects:
        duration = max(1, int(subject.get("lecture_duration") or 1))
        subject["lecture_duration"] = duration

        if subject.get("total_hours") is not None and int(subject["total_hours"]) > 0:
            total_h = int(subject["total_hours"])
            subject["total_hours"] = total_h
            subject["target_sessions"] = total_h // duration
            subject["periods_per_week"] = max(1, round(total_h / num_weeks))
        else:
            weekly_quota = max(0, int(subject.get("periods_per_week", 0) or 0))
            subject["periods_per_week"] = weekly_quota
            total_h = weekly_quota * num_weeks
            subject["total_hours"] = total_h
            subject["target_sessions"] = total_h // duration

    # Build candidate session assignments
    candidates = {}
    candidate_slots = {}  # key -> list of slot dicts covering the session

    day = start
    while day <= end:
        eligible, _, _ = _event_state(day, events, working_days)
        if eligible:
            weekday = day.strftime("%A")
            day_slot_list = slots_by_day.get(weekday, [])

            for subject in subjects:
                duration = subject["lecture_duration"]
                subj_type = "lab" if str(subject.get("subject_type", "")).lower() == "lab" else "theory"
                eligible_rooms = rooms_by_type.get(subj_type, [])
                eligible_teachers = teachers_by_subject.get(subject["subject_id"], [])

                if not eligible_teachers or not eligible_rooms:
                    continue

                for i, start_slot in enumerate(day_slot_list):
                    if i + duration > len(day_slot_list):
                        continue
                    block_slots = day_slot_list[i : i + duration]
                    is_consecutive = all(
                        block_slots[k]["period_number"] == start_slot["period_number"] + k
                        for k in range(duration)
                    )
                    if not is_consecutive:
                        continue

                    for teacher in eligible_teachers:
                        if any((teacher["teacher_id"], s["slot_id"]) in unavailable for s in block_slots):
                            continue

                        for room in eligible_rooms:
                            key = (day, start_slot["slot_id"], subject["class_id"],
                                   subject["subject_id"], teacher["teacher_id"], room["room_id"])
                            candidates[key] = None
                            candidate_slots[key] = block_slots

        day += timedelta(days=1)

    if not candidates:
        return {"status": "infeasible", "reason": "No eligible dated assignments can be formed.", "sessions": []}

    model = cp_model.CpModel()
    assign = {key: model.NewBoolVar("a_" + "_".join(map(str, key))) for key in candidates}

    # Index by (class_id, subject_id) and week
    assign_by_subject = defaultdict(list)
    assign_by_subj_week = defaultdict(lambda: defaultdict(list))
    assign_by_subj_date = defaultdict(list)

    for key, var in assign.items():
        session_date, slot_id, class_id, subject_id, teacher_id, room_id = key
        assign_by_subject[(class_id, subject_id)].append((session_date, var))
        week_start = session_date - timedelta(days=session_date.weekday())
        assign_by_subj_week[(class_id, subject_id)][week_start].append(var)
        assign_by_subj_date[(class_id, subject_id, session_date)].append(var)

    # 1. HARD CONSTRAINTS: Bucket Conflicts
    buckets = defaultdict(list)
    for key, var in assign.items():
        session_date, start_slot_id, class_id, subject_id, teacher_id, room_id = key
        for covered_slot in candidate_slots[key]:
            p_num = covered_slot["period_number"]
            buckets[("class", session_date, p_num, class_id)].append(var)
            buckets[("teacher", session_date, p_num, teacher_id)].append(var)
            buckets[("room", session_date, p_num, room_id)].append(var)

    for bucket_key, variables in buckets.items():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)

    # 2. HARD CONSTRAINTS: Locked Sessions
    locked_keys = set()
    for item in locked:
        session_date = item["session_date"]
        matched_key = None
        for key in candidates:
            if (key[0] == session_date and key[1] == item["slot_id"] and
                key[2] == item["class_id"] and key[3] == item["subject_id"] and
                key[4] == item["teacher_id"] and key[5] == item["room_id"]):
                matched_key = key
                break
        if not matched_key:
            return {
                "status": "infeasible",
                "reason": f"Locked session on {session_date.isoformat()} (class {item['class_id']}, period {item['period_number']}) cannot be scheduled.",
                "sessions": [],
                "locked_conflicts": [session_date.isoformat()],
            }
        model.Add(assign[matched_key] == 1)
        locked_keys.add(matched_key)

    # 3. SUBJECT TARGETS AND CAPACITY
    makeup_counts = defaultdict(int)
    for pref in makeup_preferences:
        c_id, s_id = pref.get("class_id"), pref.get("subject_id")
        if c_id is not None and s_id is not None:
            makeup_counts[(c_id, s_id)] += 1

    unresolved_makeups = []
    unresolved_penalties = []
    makeup_penalties = []

    for subject in subjects:
        c_id = subject["class_id"]
        s_id = subject["subject_id"]
        target = subject["target_sessions"]
        duration = subject["lecture_duration"]
        subj_assigns = [v for _, v in assign_by_subject.get((c_id, s_id), [])]

        if target <= 0:
            continue

        weekly_quota = subject["periods_per_week"]
        displaced_count = makeup_counts[(c_id, s_id)]

        # Effective target per week capped by eligible days
        week_effective_target = {
            week: min(weekly_quota, week_eligible_days[week])
            for week in weeks
        }

        # Weekly capacity constraints
        for week in weeks:
            week_candidates = assign_by_subj_week[(c_id, s_id)][week]
            eff_target = week_effective_target[week]
            extra_capacity = max(
                displaced_count,
                sum(weekly_quota - week_effective_target[w]
                    for w in closure_affected_weeks if w <= week)
            )
            weekly_capacity = eff_target + extra_capacity

            if week_candidates:
                weekly_total = sum(week_candidates)
                model.Add(weekly_total <= weekly_capacity)
                dev = model.NewIntVar(0, weekly_capacity, f"dev_c{c_id}_s{s_id}_{week}")
                model.Add(dev >= eff_target - weekly_total)
                makeup_penalties.append(dev)

        # Semester total target is the authoritative requirement
        target_total = target

        if is_rescheduling_mode:
            # In rescheduling mode, use soft shortfall variable to schedule maximum feasible makeups
            unresolved = model.NewIntVar(0, target_total, f"unresolved_c{c_id}_s{s_id}")
            model.Add(sum(subj_assigns) + unresolved == target_total)
            unresolved_makeups.append((subject, unresolved))
            unresolved_penalties.append(unresolved)
        else:
            # In fresh generation, must schedule exact required sessions
            model.Add(sum(subj_assigns) == target_total)

    # 4. HOLIDAY MAKEUP PREFERENCES (Soft objectives)
    preference_penalties = []
    for idx, pref in enumerate(makeup_preferences):
        c_id = pref["class_id"]
        s_id = pref["subject_id"]
        orig_date = pref["original_date"]
        pref_date = pref.get("preferred_date")
        pref_period = pref.get("preferred_period")

        relevant = [
            (key, var) for key, var in assign.items()
            if key[2] == c_id and key[3] == s_id and key[0] != orig_date
        ]
        if not relevant:
            continue

        if pref_date:
            pref_matches = [
                var for key, var in relevant
                if key[0] == pref_date
                and (pref_period is None or slot_by_id[key[1]]["period_number"] == pref_period)
            ]
            if pref_matches:
                met = model.NewBoolVar(f"pref_met_{idx}")
                model.Add(sum(pref_matches) >= met)
                preference_penalties.append((met.Not(), 1000))

        same_week_matches = [
            var for key, var in relevant
            if key[0].isocalendar()[:2] == orig_date.isocalendar()[:2]
        ]
        if same_week_matches:
            sw_met = model.NewBoolVar(f"sw_met_{idx}")
            model.Add(sum(same_week_matches) >= sw_met)
            preference_penalties.append((sw_met.Not(), 100))

    # 5. TEACHER DAILY WORKLOAD (Soft limit)
    teacher_daily = defaultdict(list)
    for key, var in assign.items():
        session_date, _, _, _, teacher_id, _ = key
        teacher_daily[(teacher_id, session_date)].append(var)

    teacher_max = {t["teacher_id"]: max(0, int(t.get("max_periods_per_day") or 0)) for t in teachers}
    daily_overflow_penalties = []
    for (teacher_id, session_date), vars_list in teacher_daily.items():
        limit = teacher_max.get(teacher_id, 0)
        if limit and len(vars_list) > limit:
            overflow = model.NewIntVar(0, len(vars_list), f"ov_t{teacher_id}_{session_date}")
            model.Add(overflow >= sum(vars_list) - limit)
            daily_overflow_penalties.append(overflow)

    # 6. DYNAMIC CONSTRAINTS COMPILATION
    dynamic_penalties = []
    for constraint in data.get("dynamic_constraints", []):
        compiled = compile_semester_constraint(model, assign, constraint, data)
        weight = constraint.weight if constraint.constraint_type == "soft" else None
        if weight is not None and weight != 1:
            compiled = [penalty * int(weight) for penalty in compiled]
        dynamic_penalties.extend(compiled)

    # Combine objective terms
    penalties = []
    penalties.extend(p * 10 for p in makeup_penalties)
    penalties.extend(p * 1_000_000 for p in unresolved_penalties)
    penalties.extend(p * weight for p, weight in preference_penalties)
    penalties.extend(p * 50 for p in daily_overflow_penalties)
    penalties.extend(dynamic_penalties)

    if penalties:
        model.Minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.1, float(max_time_seconds))
    solver.parameters.num_workers = 8

    status = solver.Solve(model)
    status_name = solver.StatusName(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "infeasible" if status == cp_model.INFEASIBLE else "no_solution",
            "reason": f"Solver returned '{status_name}'. Constraints prevent a valid schedule from being built.",
            "sessions": [],
        }

    # Extract scheduled session records
    sessions = []
    for key, var in assign.items():
        if solver.Value(var):
            session_date, start_slot_id, class_id, subject_id, teacher_id, room_id = key
            covered_slots = candidate_slots[key]
            for covered_slot in covered_slots:
                sessions.append({
                    "session_date": session_date,
                    "weekday": session_date.strftime("%A"),
                    "period_number": covered_slot["period_number"],
                    "slot_id": covered_slot["slot_id"],
                    "class_id": class_id,
                    "subject_id": subject_id,
                    "teacher_id": teacher_id,
                    "room_id": room_id,
                    "session_status": "scheduled",
                    "is_locked": key in locked_keys,
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

    # Hour accounting summary
    hour_accounting = []
    for subject in subjects:
        c_id = subject["class_id"]
        s_id = subject["subject_id"]
        duration = subject["lecture_duration"]
        total_req = subject["total_hours"]
        req_sessions = subject["target_sessions"]
        sched_periods = sum(1 for s in sessions if s["class_id"] == c_id and s["subject_id"] == s_id)
        sched_sessions = sched_periods // duration
        sched_hours = sched_sessions * duration
        rem_hours = max(0, total_req - sched_hours)
        hour_accounting.append({
            "class_id": c_id,
            "subject_id": s_id,
            "subject_name": subject.get("subject_name", ""),
            "total_required_hours": total_req,
            "lecture_duration": duration,
            "required_sessions": req_sessions,
            "scheduled_sessions": sched_sessions,
            "scheduled_hours": sched_hours,
            "remaining_hours": rem_hours,
            "status": "complete" if rem_hours == 0 else "incomplete",
        })

    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "objective_value": solver.ObjectiveValue() if penalties else 0,
        "sessions": sessions,
        "unresolved_makeups": unresolved_summary,
        "hour_accounting": hour_accounting,
        "locked_conflicts": [],
    }
