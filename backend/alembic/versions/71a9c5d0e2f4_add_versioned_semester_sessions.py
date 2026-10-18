"""Add versioned semester timetable sessions.

Revision ID: 71a9c5d0e2f4
Revises: 2cc0f788cb1b
"""
from alembic import op
import sqlalchemy as sa

revision = "71a9c5d0e2f4"
down_revision = "2cc0f788cb1b"
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _create_index_if_missing(name, table, columns):
    inspector = _inspector()
    if table in inspector.get_table_names() and name not in {i["name"] for i in inspector.get_indexes(table)}:
        op.create_index(name, table, columns)


def upgrade():
    existing = set(_inspector().get_table_names())
    # Calendar tables predate Alembic in this project and are also created by
    # Base.metadata.create_all at startup. Create them here only for a clean
    # migration-only deployment where startup has not created them yet.
    if "academic_term" not in existing:
        op.create_table(
            "academic_term",
            sa.Column("term_id", sa.Integer(), primary_key=True),
            sa.Column("academic_year", sa.String(length=20), nullable=False),
            sa.Column("term_name", sa.String(length=80), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("holiday_region", sa.String(length=120), nullable=False, server_default="Maharashtra, India"),
            sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Kolkata"),
            sa.Column("working_days_json", sa.Text(), nullable=False, server_default='["Monday","Tuesday","Wednesday","Thursday","Friday"]'),
            sa.Column("reschedule_policy", sa.String(length=32), nullable=False, server_default="suggest"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("academic_year", "term_name", name="uq_academic_term_year_name"),
        )
        op.create_index("ix_academic_term_term_id", "academic_term", ["term_id"])
    existing = set(_inspector().get_table_names())
    if "calendar_event" not in existing:
        op.create_table(
            "calendar_event",
            sa.Column("event_id", sa.Integer(), primary_key=True),
            sa.Column("term_id", sa.Integer(), sa.ForeignKey("academic_term.term_id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("event_type", sa.String(length=32), nullable=False, server_default="holiday"),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("is_closure", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_working_day_override", sa.Boolean(), nullable=True),
            sa.Column("source", sa.String(length=200), nullable=False, server_default="manual"),
            sa.Column("approval_status", sa.String(length=24), nullable=False, server_default="approved"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_calendar_event_event_id", "calendar_event", ["event_id"])
        op.create_index("ix_calendar_event_term_id", "calendar_event", ["term_id"])
    existing = set(_inspector().get_table_names())
    if "timetable_version" not in existing:
        op.create_table(
            "timetable_version",
            sa.Column("version_id", sa.Integer(), primary_key=True),
            sa.Column("term_id", sa.Integer(), sa.ForeignKey("academic_term.term_id", ondelete="CASCADE"), nullable=False),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(length=120), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.UniqueConstraint("term_id", "version_number", name="uq_timetable_version_term_number"),
        )
    _create_index_if_missing("ix_timetable_version_version_id", "timetable_version", ["version_id"])
    _create_index_if_missing("ix_timetable_version_term_id", "timetable_version", ["term_id"])
    _create_index_if_missing("ix_timetable_version_term_status", "timetable_version", ["term_id", "status"])

    existing = set(_inspector().get_table_names())
    if "scheduled_session" not in existing:
        op.create_table(
            "scheduled_session",
            sa.Column("session_id", sa.Integer(), primary_key=True),
            sa.Column("version_id", sa.Integer(), sa.ForeignKey("timetable_version.version_id", ondelete="CASCADE"), nullable=False),
            sa.Column("session_date", sa.Date(), nullable=False),
            sa.Column("weekday", sa.String(length=12), nullable=False),
            sa.Column("period_number", sa.Integer(), nullable=False),
            sa.Column("slot_id", sa.Integer(), sa.ForeignKey("timeslot.slot_id"), nullable=True),
            sa.Column("class_id", sa.Integer(), sa.ForeignKey("class.class_id"), nullable=False),
            sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subject.subject_id"), nullable=False),
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teacher.teacher_id"), nullable=False),
            sa.Column("room_id", sa.Integer(), sa.ForeignKey("room.room_id"), nullable=False),
            sa.Column("session_status", sa.String(length=20), nullable=False, server_default="scheduled"),
            sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("lock_reason", sa.String(length=500), nullable=True),
            sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("locked_by", sa.String(length=120), nullable=True),
            sa.Column("closure_conflict", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("source_event_id", sa.Integer(), sa.ForeignKey("calendar_event.event_id", ondelete="SET NULL"), nullable=True),
            sa.Column("original_session_id", sa.Integer(), sa.ForeignKey("scheduled_session.session_id", ondelete="SET NULL"), nullable=True),
            sa.Column("replacement_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("outcome_note", sa.Text(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("version_id", "session_date", "class_id", "period_number", name="uq_session_version_date_class_period"),
        )
    for name, columns in [
        ("ix_scheduled_session_session_id", ["session_id"]),
        ("ix_scheduled_session_version_id", ["version_id"]),
        ("ix_scheduled_session_session_date", ["session_date"]),
        ("ix_scheduled_session_class_id", ["class_id"]),
        ("ix_scheduled_session_subject_id", ["subject_id"]),
        ("ix_scheduled_session_teacher_id", ["teacher_id"]),
        ("ix_scheduled_session_room_id", ["room_id"]),
        ("ix_session_version_date", ["version_id", "session_date"]),
        ("ix_session_version_status", ["version_id", "session_status"]),
    ]:
        _create_index_if_missing(name, "scheduled_session", columns)


def downgrade():
    existing = set(_inspector().get_table_names())
    if "scheduled_session" in existing:
        indexes = {i["name"] for i in _inspector().get_indexes("scheduled_session")}
        for name in [
            "ix_session_version_status", "ix_session_version_date",
            "ix_scheduled_session_room_id", "ix_scheduled_session_teacher_id",
            "ix_scheduled_session_subject_id", "ix_scheduled_session_class_id",
            "ix_scheduled_session_session_date", "ix_scheduled_session_version_id",
            "ix_scheduled_session_session_id",
        ]:
            if name in indexes:
                op.drop_index(name, table_name="scheduled_session")
        op.drop_table("scheduled_session")
    existing = set(_inspector().get_table_names())
    if "timetable_version" in existing:
        indexes = {i["name"] for i in _inspector().get_indexes("timetable_version")}
        for name in ["ix_timetable_version_term_status", "ix_timetable_version_term_id", "ix_timetable_version_version_id"]:
            if name in indexes:
                op.drop_index(name, table_name="timetable_version")
        op.drop_table("timetable_version")
