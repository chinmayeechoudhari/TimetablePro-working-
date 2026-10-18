from datetime import date
from types import SimpleNamespace

from app.api.semester import _event_state


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
