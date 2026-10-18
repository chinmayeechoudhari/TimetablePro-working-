from datetime import date
from types import SimpleNamespace

from app.api.semester import _event_state, _schedule_conflicts
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



def test_weekly_target_scales_down_for_partial_week():
    # Wednesday-Friday is three of five configured teaching days.
    assert _weekly_target(3, date(2026, 7, 1), date(2026, 7, 3), [], {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}) == 2


def test_weekly_target_does_not_exceed_weekly_load_with_working_day_override():
    # An override can reopen a closure but should not inflate the weekly subject target.
    closure = event(date(2026, 7, 4), date(2026, 7, 4))
    override = event(date(2026, 7, 4), date(2026, 7, 4), closure=False, override=True)
    assert _weekly_target(3, date(2026, 6, 29), date(2026, 7, 5), [closure, override], {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}) == 3


def test_weekly_target_drops_to_zero_when_all_teaching_days_are_closed():
    events = [
        event(date(2026, 7, day), date(2026, 7, day))
        for day in range(6, 11)
    ]
    assert _weekly_target(3, date(2026, 7, 6), date(2026, 7, 10), events, {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}) == 0


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