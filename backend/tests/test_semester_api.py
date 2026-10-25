from datetime import date
from types import SimpleNamespace

from app.api.semester import _event_state, _schedule_conflicts, _target_for_week
from app.api.semester_workflow import _weekly_target


def event(start, end, *, closure=True, override=None):
    return SimpleNamespace(
        start_date=start,
        end_date=end,
        is_closure=closure,
        is_working_day_override=override,
    )


def test_touched_calendar_weeks_include_partial_first_and_last_weeks():
    start = date(2026, 7, 1)
    end = date(2026, 12, 30)
    first_monday = date.fromordinal(start.toordinal() - start.weekday())
    last_sunday = date.fromordinal(end.toordinal() + (6 - end.weekday()))
    touched_weeks = ((last_sunday - first_monday).days // 7) + 1
    assert touched_weeks == 27
    assert touched_weeks * 3 == 81


def test_regular_working_day_is_eligible():
    assert _event_state([], date(2026, 7, 1), {"Wednesday"}) == (True, False, [])


def test_approved_closure_blocks_teaching_day():
    closure = event(date(2026, 7, 1), date(2026, 7, 1))
    eligible, closed, active = _event_state([closure], date(2026, 7, 1), {"Wednesday"})
    assert eligible is False
    assert closed is True
    assert active == [closure]


def test_working_day_override_reopens_closure():
    closure = event(date(2026, 7, 1), date(2026, 7, 1))
    override = event(date(2026, 7, 1), date(2026, 7, 1), closure=False, override=True)
    assert _event_state([closure, override], date(2026, 7, 1), set()) == (True, False, [closure, override])


def test_event_outside_date_range_does_not_affect_day():
    closure = event(date(2026, 7, 2), date(2026, 7, 3))
    assert _event_state([closure], date(2026, 7, 1), {"Wednesday"}) == (True, False, [])



def test_weekly_target_keeps_full_requirement_for_partial_week():
    # Wednesday-Friday is only part of the calendar week,
    # but the full weekly requirement still applies.
    working_days = {
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
    }
    assert _weekly_target(
        3,
        date(2026, 7, 1),
        date(2026, 7, 3),
        [],
        working_days,
    ) == 3


def test_weekly_target_does_not_exceed_weekly_load_with_working_day_override():
    # An override can reopen a closure but should not inflate the weekly subject target.
    closure = event(date(2026, 7, 4), date(2026, 7, 4))
    override = event(date(2026, 7, 4), date(2026, 7, 4), closure=False, override=True)
    assert _weekly_target(3, date(2026, 6, 29), date(2026, 7, 5), [closure, override], {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}) == 3


def test_weekly_target_keeps_full_requirement_when_all_days_are_closed():
    working_days = {
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
    }
    events = [
        event(date(2026, 7, day), date(2026, 7, day))
        for day in range(6, 11)
    ]

    assert _weekly_target(
        3,
        date(2026, 7, 6),
        date(2026, 7, 10),
        events,
        working_days,
    ) == 3


def test_dashboard_and_workflow_weekly_targets_match():
    working_days = {
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
    }
    closure = event(date(2026, 7, 1), date(2026, 7, 1))

    workflow_target = _weekly_target(
        3, date(2026, 7, 1), date(2026, 7, 3),
        [closure], working_days,
    )
    dashboard_target = _target_for_week(
        3, date(2026, 7, 1), date(2026, 7, 3),
        [closure], working_days,
    )

    assert workflow_target == 3
    assert dashboard_target == workflow_target


def test_weekly_targets_return_zero_for_invalid_or_empty_inputs():
    start = date(2026, 7, 1)
    end = date(2026, 7, 3)
    working_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

    for target_function in (_weekly_target, _target_for_week):
        assert target_function(0, start, end, [], working_days) == 0
        assert target_function(3, end, start, [], working_days) == 0
        assert target_function(3, start, end, [], set()) == 0


def session(session_id, day, period, class_id, teacher_id, room_id, status="scheduled"):
    return SimpleNamespace(
        session_id=session_id,
        session_date=day,
        period_number=period,
        class_id=class_id,
        teacher_id=teacher_id,
        room_id=room_id,
        session_status=status,
    )


def test_schedule_conflicts_detect_teacher_and_room_double_booking():
    rows = [
        session(1, date(2026, 7, 1), 2, 10, 7, 4),
        session(2, date(2026, 7, 1), 2, 11, 7, 4),
    ]
    conflicts = _schedule_conflicts(rows)
    assert {item["resource"] for item in conflicts} == {"teacher", "room"}
    assert all(item["session_ids"] == [1, 2] for item in conflicts)


def test_schedule_conflicts_ignore_different_dates_and_periods():
    rows = [
        session(1, date(2026, 7, 1), 2, 10, 7, 4),
        session(2, date(2026, 7, 2), 2, 11, 7, 4),
        session(3, date(2026, 7, 1), 3, 12, 7, 4),
    ]
    assert _schedule_conflicts(rows) == []


def test_schedule_conflicts_ignore_cancelled_sessions():
    rows = [
        session(1, date(2026, 7, 1), 2, 10, 7, 4, status="cancelled"),
        session(2, date(2026, 7, 1), 2, 11, 7, 4),
    ]
    assert _schedule_conflicts(rows) == []

def test_overlapping_calendar_events_require_review():
    from app.api.calendar import _overlapping_events

    existing = SimpleNamespace(
        event_id=1,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 12),
        approval_status="approved",
    )
    assert _overlapping_events([existing], date(2026, 8, 12), date(2026, 8, 13)) == [existing]
    assert _overlapping_events([existing], date(2026, 8, 13), date(2026, 8, 14)) == []


def test_rejected_calendar_events_do_not_trigger_overlap_review():
    from app.api.calendar import _overlapping_events

    rejected = SimpleNamespace(
        event_id=1,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 12),
        approval_status="rejected",
    )
    assert _overlapping_events([rejected], date(2026, 8, 11), date(2026, 8, 11)) == []
