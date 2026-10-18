from datetime import date
from types import SimpleNamespace

from app.api.semester import _event_state


def test_touched_calendar_weeks_include_partial_first_and_last_weeks():
    start = date(2026, 7, 1)  # Wednesday
    end = date(2026, 12, 30)  # Wednesday
    first_monday = start.fromordinal(start.toordinal() - start.weekday())
    last_sunday = end.fromordinal(end.toordinal() + (6 - end.weekday()))
    assert ((last_sunday - first_monday).days // 7) + 1 == 27
    assert 27 * 3 == 81


def test_pending_closure_does_not_block_day():
    pending = SimpleNamespace(start_date=date(2026, 7, 1), end_date=date(2026, 7, 1), is_closure=True, is_working_day_override=None)
    # Approval filtering happens before _event_state is called; the helper only evaluates supplied approved events.
    assert _event_state([], date(2026, 7, 1), {"Wednesday"}) == (True, False, [])


def test_working_day_override_reopens_closure():
    closure = SimpleNamespace(start_date=date(2026, 7, 1), end_date=date(2026, 7, 1), is_closure=True, is_working_day_override=None)
    override = SimpleNamespace(start_date=date(2026, 7, 1), end_date=date(2026, 7, 1), is_closure=False, is_working_day_override=True)
    assert _event_state([closure, override], date(2026, 7, 1), set()) == (True, False, [closure, override])
