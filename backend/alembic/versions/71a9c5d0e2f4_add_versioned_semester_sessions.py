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


def upgrade():
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
    op.create_index("ix_timetable_version_term_id", "timetable_version", ["term_id"])
    op.create_index("ix_timetable_version_term_status", "timetable_version", ["term_id", "status"])
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
    op.create_index("ix_scheduled_session_version_id", "scheduled_session", ["version_id"])
    op.create_index("ix_scheduled_session_session_date", "scheduled_session", ["session_date"])
    op.create_index("ix_scheduled_session_class_id", "scheduled_session", ["class_id"])
    op.create_index("ix_scheduled_session_subject_id", "scheduled_session", ["subject_id"])
    op.create_index("ix_scheduled_session_teacher_id", "scheduled_session", ["teacher_id"])
    op.create_index("ix_scheduled_session_room_id", "scheduled_session", ["room_id"])
    op.create_index("ix_session_version_date", "scheduled_session", ["version_id", "session_date"])
    op.create_index("ix_session_version_status", "scheduled_session", ["version_id", "session_status"])


def downgrade():
    op.drop_index("ix_session_version_status", table_name="scheduled_session")
    op.drop_index("ix_session_version_date", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_room_id", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_teacher_id", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_subject_id", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_class_id", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_session_date", table_name="scheduled_session")
    op.drop_index("ix_scheduled_session_version_id", table_name="scheduled_session")
    op.drop_table("scheduled_session")
    op.drop_index("ix_timetable_version_term_status", table_name="timetable_version")
    op.drop_index("ix_timetable_version_term_id", table_name="timetable_version")
    op.drop_table("timetable_version")
