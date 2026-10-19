import json
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.calendar import AcademicTerm, CalendarEvent
from app.models.models import AcademicGroup, Constraint, Division, Subject, SubjectDefinition, TeacherSubject, Timetable, TeachingAssignment
from app.models.semester import TimetableVersion

router = APIRouter(prefix="/calendar", tags=["academic-calendar"])
WEEKDAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}


class TermCreate(BaseModel):
    academic_year: str = Field(min_length=1, max_length=20)
    term_name: str = Field(min_length=1, max_length=80)
    start_date: date
    end_date: date
    holiday_region: str = Field(default="Maharashtra, India", min_length=1, max_length=120)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)
    reschedule_policy: Literal["cancel", "suggest", "automatic"] = "suggest"
    status: Literal["draft", "active", "archived"] = "draft"

    @model_validator(mode="after")
    def validate_dates_and_days(self):
        if self.end_date < self.start_date:
            raise ValueError("Term end date must be on or after the start date.")
        return self


class TermUpdate(BaseModel):
    academic_year: str | None = Field(default=None, min_length=1, max_length=20)
    term_name: str | None = Field(default=None, min_length=1, max_length=80)
    start_date: date | None = None
    end_date: date | None = None
    holiday_region: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    reschedule_policy: Literal["cancel", "suggest", "automatic"] | None = None
    status: Literal["draft", "active", "archived"] | None = None


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    event_type: Literal["holiday", "vacation", "exam", "event", "closure", "working_day"] = "holiday"
    start_date: date
    end_date: date
    is_closure: bool = True
    is_working_day_override: bool | None = None
    source: str = Field(default="manual", max_length=200)
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("Event end date must be on or after its start date.")
        if self.event_type == "working_day":
            self.is_closure = False
            self.is_working_day_override = True
        return self


def serialize_term(term: AcademicTerm):
    return {
        "term_id": term.term_id,
        "academic_year": term.academic_year,
        "term_name": term.term_name,
        "start_date": term.start_date.isoformat(),
        "end_date": term.end_date.isoformat(),
        "holiday_region": term.holiday_region,
        "timezone": term.timezone,
        "reschedule_policy": term.reschedule_policy,
        "status": term.status,
        "created_at": term.created_at.isoformat() if term.created_at else None,
    }


def serialize_event(event: CalendarEvent):
    return {
        "event_id": event.event_id,
        "term_id": event.term_id,
        "title": event.title,
        "event_type": event.event_type,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "is_closure": event.is_closure,
        "is_working_day_override": event.is_working_day_override,
        "source": event.source,
        "approval_status": event.approval_status,
        "notes": event.notes,
    }


def get_term_or_404(db: Session, term_id: int):
    term = db.query(AcademicTerm).filter(AcademicTerm.term_id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Academic term not found.")
    return term


def _overlapping_events(existing_events, start_date: date, end_date: date, exclude_event_id: int | None = None):
    """Return non-rejected calendar entries whose date ranges overlap the proposed range."""
    return [
        event for event in existing_events
        if event.event_id != exclude_event_id
        and event.approval_status != "rejected"
        and event.start_date <= end_date
        and event.end_date >= start_date
    ]


@router.get("/terms")
def list_terms(db: Session = Depends(get_db)):
    terms = db.query(AcademicTerm).order_by(AcademicTerm.start_date.desc(), AcademicTerm.term_id.desc()).all()
    return [serialize_term(term) for term in terms]


@router.post("/terms", status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = AcademicTerm(
        academic_year=payload.academic_year.strip(),
        term_name=payload.term_name.strip(),
        start_date=payload.start_date,
        end_date=payload.end_date,
        holiday_region=payload.holiday_region.strip(),
        timezone=payload.timezone.strip(),
        reschedule_policy=payload.reschedule_policy,
        status=payload.status,
    )
    # The admin workflow supports one active semester at a time.
    if term.status == "active":
        db.query(AcademicTerm).filter(AcademicTerm.status == "active").update(
            {AcademicTerm.status: "archived"}, synchronize_session=False
        )
    db.add(term)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A term with this academic year and name already exists.")
    db.refresh(term)
    return serialize_term(term)


@router.patch("/terms/{term_id}")
def update_term(term_id: int, payload: TermUpdate, db: Session = Depends(get_db)):
    term = get_term_or_404(db, term_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(term, field, value)
    if term.status == "active":
        db.query(AcademicTerm).filter(
            AcademicTerm.term_id != term_id,
            AcademicTerm.status == "active",
        ).update({AcademicTerm.status: "archived"}, synchronize_session=False)
    if term.end_date < term.start_date:
        raise HTTPException(status_code=422, detail="Term end date must be on or after the start date.")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A term with this academic year and name already exists.")
    db.refresh(term)
    return serialize_term(term)


@router.delete("/terms/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    """Permanently remove one semester's data while preserving shared structure and faculty.

    Academic groups, divisions/classes, global teachers, rooms, and time slots are
    deliberately retained. Subject definitions and assignments for the term's
    academic year are cleared because the current schema scopes these records to
    academic year/group rather than directly to a semester.
    """
    term = get_term_or_404(db, term_id)
    def normalize_year(value):
        return (value or "").strip().casefold().replace("–", "-").replace("—", "-").replace(" ", "")

    academic_year = normalize_year(term.academic_year)

    try:
        # Delete version snapshots through the ORM so scheduled-session
        # relationships are removed even when database cascade settings differ.
        versions = db.query(TimetableVersion).filter(TimetableVersion.term_id == term_id).all()
        for version in versions:
            db.delete(version)
        db.flush()

        # Remove dated calendar events before the term. This also avoids stale
        # source-event references in installations without ON DELETE SET NULL.
        db.query(CalendarEvent).filter(CalendarEvent.term_id == term_id).delete(synchronize_session=False)

        # Dynamic constraints are stored in JSON envelopes; legacy/global rules
        # are intentionally retained.
        for rule in db.query(Constraint).all():
            try:
                stored = json.loads(rule.parameters_json or "{}")
            except (TypeError, ValueError):
                continue
            scope = stored.get("scope") if isinstance(stored, dict) else None
            if isinstance(scope, dict) and str(scope.get("term_id")) == str(term_id):
                db.delete(rule)

        # The current data model attaches subjects to academic groups, not terms.
        # Clear those subject definitions/assignments for this academic year but
        # keep the groups and divisions so department/class counts survive.
        groups = db.query(AcademicGroup).all()
        scoped_group_ids = [
            group.group_id for group in groups
            if normalize_year(group.academic_year) == academic_year
        ]
        if scoped_group_ids:
            definitions = db.query(SubjectDefinition).filter(
                SubjectDefinition.group_id.in_(scoped_group_ids)
            ).all()
            definition_ids = [definition.definition_id for definition in definitions]
            if definition_ids:
                db.query(TeachingAssignment).filter(
                    TeachingAssignment.definition_id.in_(definition_ids)
                ).delete(synchronize_session=False)
                for definition in definitions:
                    db.delete(definition)

            # Legacy timetable rows for these retained classes must not leave
            # the previous semester's subjects visible in the weekly timetable.
            division_rows = db.query(Division).filter(
                Division.group_id.in_(scoped_group_ids)
            ).all()
            class_ids = [division.class_id for division in division_rows]
            if class_ids:
                legacy_subject_ids = [
                    row.subject_id for row in db.query(Subject.subject_id).filter(
                        Subject.class_id.in_(class_ids)
                    ).all()
                ]
                db.query(Timetable).filter(Timetable.class_id.in_(class_ids)).delete(
                    synchronize_session=False
                )
                if legacy_subject_ids:
                    db.query(TeacherSubject).filter(
                        TeacherSubject.subject_id.in_(legacy_subject_ids)
                    ).delete(synchronize_session=False)
                    db.query(Subject).filter(
                        Subject.subject_id.in_(legacy_subject_ids)
                    ).delete(synchronize_session=False)

        db.delete(term)
        db.flush()
        # Promote the next remaining term so the admin can remove old terms
        # one at a time without exposing a semester toggle in timetable view.
        next_term = db.query(AcademicTerm).order_by(
            AcademicTerm.start_date.desc(), AcademicTerm.term_id.desc()
        ).first()
        if next_term:
            next_term.status = "active"
        db.commit()
    except Exception:
        db.rollback()
        raise
    return None



@router.post("/terms/{term_id}/holidays/import")
def import_public_holidays(term_id: int, db: Session = Depends(get_db)):
    """Import the college's built-in AY 2026-27 semester-I calendar dates.

    These are taken from the academic activity calendar supplied by the
    institution. Government/public-holiday feeds are not used as the source
    of truth for college-specific dates.
    """
    term = get_term_or_404(db, term_id)
    built_in_events = [
        ("2026-08-15", "Independence Day", "holiday", True),
        ("2026-08-26", "Eid-e-Milad", "holiday", True),
        ("2026-08-31", "College Foundation Day", "event", False),
        ("2026-09-07", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-08", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-09", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-10", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-11", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-12", "Mid-Semester Examination (MSE)", "exam", True),
        ("2026-09-18", "Gauri Pujan", "holiday", True),
        ("2026-09-25", "Anant Chaturdashi", "holiday", True),
        ("2026-10-02", "Gandhi Jayanti / Dasara", "holiday", True),
        ("2026-10-20", "Vijaya Dashami / Dasara", "holiday", True),
        ("2026-11-06", "Diwali break", "vacation", True),
        ("2026-11-07", "Diwali break", "vacation", True),
        ("2026-11-08", "Diwali break", "vacation", True),
        ("2026-11-09", "Diwali break", "vacation", True),
        ("2026-11-10", "Diwali break", "vacation", True),
        ("2026-11-11", "Diwali break", "vacation", True),
        ("2026-11-12", "Diwali break", "vacation", True),
        ("2026-11-16", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-17", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-18", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-19", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-20", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-21", "Internal Assessment (GD/PPT, CP)", "exam", True),
        ("2026-11-23", "Preparatory Leave (PL)", "vacation", True),
        ("2026-11-24", "Guru Nanak Jayanti", "holiday", True),
        ("2026-11-25", "Preparatory Leave (PL)", "vacation", True),
        ("2026-11-26", "End-Semester Examination (ESE)", "exam", True),
        ("2026-11-27", "End-Semester Examination (ESE)", "exam", True),
        ("2026-11-28", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-01", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-02", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-03", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-04", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-05", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-07", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-08", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-09", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-10", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-11", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-12", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-14", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-15", "End-Semester Examination (ESE)", "exam", True),
        ("2026-12-25", "Christmas", "holiday", True),
    ]
    imported = 0
    skipped = 0
    for raw_date, title, event_type, is_closure in built_in_events:
        event_date = date.fromisoformat(raw_date)
        if not term.start_date <= event_date <= term.end_date:
            continue
        overlapping = db.query(CalendarEvent).filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.start_date <= event_date,
            CalendarEvent.end_date >= event_date,
        ).all()
        exists = next((
            event for event in overlapping
            if event.start_date == event_date
            and event.end_date == event_date
            and event.title.strip().casefold() == title.strip().casefold()
        ), None)
        if exists:
            skipped += 1
            continue
        needs_review = bool(overlapping)
        db.add(CalendarEvent(
            term_id=term_id,
            title=title,
            event_type=event_type,
            start_date=event_date,
            end_date=event_date,
            is_closure=is_closure,
            is_working_day_override=False,
            source="College Academic Activity Calendar AY 2026-27 Sem I",
            approval_status="pending" if needs_review else "approved",
            notes=(
                "Overlaps another calendar entry; administrator review required."
                if needs_review else
                "Imported from the college-provided academic activity calendar. Please verify against the latest official circular."
            ),
        ))
        imported += 1
    db.commit()
    return {
        "imported": imported,
        "skipped": skipped,
        "source": "College Academic Activity Calendar AY 2026-27 Sem I",
        "message": f"Imported {imported} college calendar entries. Please verify dates against the latest college circular.",
    }



@router.post("/terms/{term_id}/holidays/region")
def import_region_holidays(term_id: int, db: Session = Depends(get_db)):
    """Load country/region public holidays, preferring the selected region."""
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError

    term = get_term_or_404(db, term_id)
    region = (term.holiday_region or "").lower()
    country_map = {
        "india": "IN", "bharat": "IN", "united states": "US", "usa": "US",
        "united kingdom": "GB", "uk": "GB", "canada": "CA", "australia": "AU",
        "united arab emirates": "AE", "uae": "AE", "germany": "DE",
        "france": "FR", "singapore": "SG", "new zealand": "NZ", "ireland": "IE",
        "netherlands": "NL", "spain": "ES", "italy": "IT", "south africa": "ZA",
    }
    country = next((code for name, code in country_map.items() if name in region), None)
    if not country:
        raise HTTPException(status_code=422, detail="No regional feed is configured for this country yet. Upload your institution calendar or add dates manually.")
    imported = skipped = 0
    overlaps = []
    for year in range(term.start_date.year, term.end_date.year + 1):
        request = Request(f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country}", headers={"User-Agent": "TimetablePro/1.0"})
        try:
            with urlopen(request, timeout=10) as response:
                holidays = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError):
            # Offline fallback for Maharashtra: dates taken from the Maharashtra
            # Government's 2026 public-holiday notification. Do not silently
            # claim this fallback is complete for other regions/years.
            maharashtra_2026 = [
                ("2026-08-15", "Independence Day"),
                ("2026-08-26", "Eid-e-Milad"),
                ("2026-09-14", "Ganesh Chaturthi"),
                ("2026-10-02", "Mahatma Gandhi Jayanti"),
                ("2026-10-20", "Dasara"),
                ("2026-11-08", "Diwali Amavasya (Laxmi Pujan)"),
                ("2026-11-10", "Diwali (Bali Pratipada)"),
                ("2026-11-24", "Guru Nanak Jayanti"),
                ("2026-12-25", "Christmas"),
            ]
            if country == "IN" and "maharashtra" in region and year == 2026:
                holidays = [
                    {"date": day, "localName": title, "name": title, "counties": ["IN-MH"]}
                    for day, title in maharashtra_2026
                ]
            else:
                raise HTTPException(status_code=502, detail=f"Regional holiday service is unavailable for {year}. No offline fallback is configured for this region/year. Upload your institution calendar or add dates manually.")
        for item in holidays:
            try:
                event_date = date.fromisoformat(item["date"])
            except (KeyError, ValueError):
                continue
            if not term.start_date <= event_date <= term.end_date:
                continue
            subdivisions = item.get("counties") or []
            if "maharashtra" in region and subdivisions and "IN-MH" not in subdivisions:
                continue
            title = item.get("localName") or item.get("name") or "Public holiday"
            overlapping = db.query(CalendarEvent).filter(
                CalendarEvent.term_id == term_id,
                CalendarEvent.start_date <= event_date,
                CalendarEvent.end_date >= event_date,
            ).all()
            exists = next((event for event in overlapping if event.start_date == event_date and event.end_date == event_date and event.title.strip().casefold() == title.strip().casefold()), None)
            if exists:
                skipped += 1
                continue
            needs_review = bool(overlapping)
            for event in overlapping:
                overlaps.append({
                    "imported_title": title,
                    "date": event_date.isoformat(),
                    "existing_title": event.title,
                    "existing_source": event.source,
                    "existing_approval_status": event.approval_status,
                })
            db.add(CalendarEvent(
                term_id=term_id, title=title, event_type="holiday",
                start_date=event_date, end_date=event_date, is_closure=True,
                is_working_day_override=False,
                source=f"Regional public holidays ({term.holiday_region})",
                approval_status="pending" if needs_review else "approved",
                notes="Overlaps another calendar entry; administrator review required." if needs_review else "Imported regional public-holiday suggestion. Verify against the relevant government notice.",
            ))
            imported += 1
    db.commit()
    return {
        "imported": imported,
        "skipped": skipped,
        "overlaps": overlaps[:100],
        "source": term.holiday_region,
        "message": f"Loaded {imported} regional holiday dates; {len(overlaps)} overlapping date pairs need administrator review.",
    }


@router.post("/terms/{term_id}/holidays/upload")
async def upload_institution_calendar(term_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import date/title rows from an institution-issued XLSX or CSV calendar."""
    import csv
    import io
    from openpyxl import load_workbook

    term = get_term_or_404(db, term_id)
    filename = (file.filename or "").lower()
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Calendar file must be 10 MB or smaller.")
    rows = []
    try:
        if filename.endswith(".csv"):
            text = raw.decode("utf-8-sig")
            rows = list(csv.reader(io.StringIO(text)))
        elif filename.endswith(".xlsx"):
            workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            sheet = workbook.active
            rows = [[cell for cell in row] for row in sheet.iter_rows(values_only=True)]
        elif filename.endswith(".pdf"):
            import re
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
            if not extracted.strip():
                raise HTTPException(status_code=422, detail="No selectable text was found in this PDF. It may be scanned; use OCR or upload CSV/XLSX.")
            rows = [["Date", "Title", "Type", "Closure"]]
            date_pattern = re.compile(r"(?P<date>\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{4})?)\b)", re.I)
            for line in extracted.splitlines():
                line = re.sub(r"\s+", " ", line).strip(" •|\t-")
                match = date_pattern.search(line)
                if not match:
                    continue
                date_text = match.group("date").strip()
                event_title = (line[:match.start()] + " " + line[match.end():]).strip(" :-|\t•")
                if not event_title or len(event_title) > 160:
                    continue
                if not re.search(r"\d{4}", date_text):
                    date_text = f"{date_text} {term.start_date.year}"
                rows.append([date_text, event_title, "holiday", "yes"])
            if len(rows) == 1:
                raise HTTPException(status_code=422, detail="No recognizable date-and-event rows found in the PDF. Review its layout or upload a CSV/XLSX table.")
        else:
            raise HTTPException(status_code=415, detail="Upload a PDF, .xlsx or .csv calendar file.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this calendar file. Check that it is a valid PDF, .xlsx or UTF-8 CSV.") from exc

    def parse_date(value):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, (int, float)):
            from openpyxl.utils.datetime import from_excel
            return from_excel(value).date()
        value = str(value or "").strip()
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%Y", "%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                pass
        return None

    if not rows:
        raise HTTPException(status_code=400, detail="The file has no rows.")
    normalized = [str(value or "").strip().lower() for value in rows[0]]
    date_index = next((i for i, value in enumerate(normalized) if value in {"date", "start date", "start_date", "day/date"}), None)
    title_index = next((i for i, value in enumerate(normalized) if value in {"title", "event", "holiday", "description", "activity", "occasion"}), None)
    if date_index is None or title_index is None:
        raise HTTPException(status_code=422, detail="Use a table with column headers Date and Title (or Event/Description). Optional columns: End Date, Type, Closure.")
    end_index = next((i for i, value in enumerate(normalized) if value in {"end date", "end_date", "to"}), None)
    type_index = next((i for i, value in enumerate(normalized) if value in {"type", "event type"}), None)
    closure_index = next((i for i, value in enumerate(normalized) if value in {"closure", "no classes", "is closure"}), None)
    imported = skipped = 0
    problems = []
    overlaps = []
    for line, row in enumerate(rows[1:], start=2):
        if max(date_index, title_index) >= len(row):
            continue
        start_date = parse_date(row[date_index])
        title = str(row[title_index] or "").strip()
        if not start_date or not title:
            continue
        end_date = parse_date(row[end_index]) if end_index is not None and end_index < len(row) else start_date
        end_date = end_date or start_date
        if end_date < start_date or start_date < term.start_date or end_date > term.end_date:
            problems.append(f"Row {line}: date range is invalid or outside this term.")
            continue
        event_type = str(row[type_index] or "holiday").strip().lower() if type_index is not None and type_index < len(row) else "holiday"
        type_aliases = {"break": "vacation", "vacation": "vacation", "exam": "exam", "examination": "exam", "event": "event", "working day": "working_day", "working_day": "working_day", "closure": "closure", "holiday": "holiday"}
        event_type = type_aliases.get(event_type, "holiday")
        raw_closure = str(row[closure_index] or "").strip().lower() if closure_index is not None and closure_index < len(row) else ""
        is_closure = event_type == "working_day" or raw_closure in {"yes", "true", "1", "y"} if closure_index is not None else event_type in {"holiday", "vacation", "closure", "working_day"}
        if event_type in {"exam", "event"} and closure_index is None:
            is_closure = False
        overlapping = db.query(CalendarEvent).filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.start_date <= end_date,
            CalendarEvent.end_date >= start_date,
        ).all()
        same = next((item for item in overlapping if item.title.strip().casefold() == title.casefold()), None)
        if same:
            skipped += 1
            continue
        for item in overlapping:
            overlaps.append({"imported_title": title, "start_date": start_date.isoformat(), "existing_title": item.title, "existing_start_date": item.start_date.isoformat(), "existing_source": item.source, "existing_approval_status": item.approval_status})
        db.add(CalendarEvent(term_id=term_id, title=title, event_type=event_type, start_date=start_date, end_date=end_date, is_closure=is_closure, is_working_day_override=event_type == "working_day", source=f"Uploaded institution calendar: {file.filename}", approval_status="pending", notes="Imported from institution file. Review and approve this entry in the calendar."))
        imported += 1
    db.commit()
    return {"imported": imported, "skipped": skipped, "problems": problems[:20], "overlaps": overlaps[:100], "source": file.filename, "message": f"Imported {imported} entries as pending review; {skipped} duplicates skipped. {len(overlaps)} overlapping date pairs need administrator review."}


@router.delete("/terms/{term_id}/events/imported")
def delete_imported_events(term_id: int, db: Session = Depends(get_db)):
    """Bulk-remove imported entries for a term while preserving manual additions."""
    get_term_or_404(db, term_id)
    imported_sources = (
        CalendarEvent.source.like("Uploaded institution calendar:%"),
        CalendarEvent.source.like("Regional public holidays%"),
        CalendarEvent.source == "College Academic Activity Calendar AY 2026-27 Sem I",
    )
    query = db.query(CalendarEvent).filter(CalendarEvent.term_id == term_id).filter(
        __import__("sqlalchemy").or_(*imported_sources)
    )
    count = query.count()
    query.delete(synchronize_session=False)
    db.commit()
    return {"deleted": count, "message": f"Removed {count} imported calendar entries. Manually added events were preserved."}


@router.get("/terms/{term_id}/events")
def list_events(term_id: int, from_date: date | None = Query(default=None), to_date: date | None = Query(default=None), db: Session = Depends(get_db)):
    get_term_or_404(db, term_id)
    query = db.query(CalendarEvent).filter(CalendarEvent.term_id == term_id)
    if from_date:
        query = query.filter(CalendarEvent.end_date >= from_date)
    if to_date:
        query = query.filter(CalendarEvent.start_date <= to_date)
    events = query.order_by(CalendarEvent.start_date, CalendarEvent.event_id).all()
    return [serialize_event(event) for event in events]


@router.post("/terms/{term_id}/events", status_code=201)
def create_event(term_id: int, payload: EventCreate, db: Session = Depends(get_db)):
    term = get_term_or_404(db, term_id)
    if payload.start_date < term.start_date or payload.end_date > term.end_date:
        raise HTTPException(status_code=422, detail="Calendar events must fall within the selected term dates.")
    overlaps = _overlapping_events(
        db.query(CalendarEvent).filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.start_date <= payload.end_date,
            CalendarEvent.end_date >= payload.start_date,
            CalendarEvent.approval_status != "rejected",
        ).all(),
        payload.start_date,
        payload.end_date,
    )
    event_data = payload.model_dump()
    if overlaps:
        event_data["approval_status"] = "pending"
        review_note = "Overlaps another calendar entry; administrator review required."
        event_data["notes"] = f"{event_data.get('notes') or ''} {review_note}".strip()
    event = CalendarEvent(term_id=term_id, **event_data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event)



@router.get("/terms/{term_id}/schedule")
def get_term_schedule(term_id: int, db: Session = Depends(get_db)):
    """Expand the generated weekly pattern into dated classes for a term.

    Approved closures and non-working weekdays suppress regular classes.
    Classes that fall on closures are returned as cancelled occurrences with
    an optional replacement-date suggestion; suggestions are never applied
    automatically.
    """
    from datetime import timedelta
    from app.models.models import Timetable, TimeSlot

    term = get_term_or_404(db, term_id)
    weekly_rows = db.query(Timetable).all()
    slots = {slot.slot_id: slot for slot in db.query(TimeSlot).all()}
    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.term_id == term_id,
            CalendarEvent.approval_status == "approved",
        )
        .order_by(CalendarEvent.start_date, CalendarEvent.event_id)
        .all()
    )
    working_days = set(json.loads(term.working_days_json or "[]"))

    def events_for(day):
        return [event for event in events if event.start_date <= day <= event.end_date]

    def day_state(day):
        day_events = events_for(day)
        force_working = any(event.is_working_day_override is True for event in day_events)
        is_closed = any(event.is_closure for event in day_events) and not force_working
        is_working = force_working or day.strftime("%A") in working_days
        return is_working and not is_closed, day_events, is_closed

    def conflicts(candidate_date, row, slot):
        for other in weekly_rows:
            other_slot = slots.get(other.slot_id)
            if not other_slot or other_slot.day != candidate_date.strftime("%A"):
                continue
            if other_slot.period_number != slot.period_number:
                continue
            if (
                other.class_id == row.class_id
                or other.teacher_id == row.teacher_id
                or other.room_id == row.room_id
            ):
                return True
        return False

    results = []
    day = term.start_date
    while day <= term.end_date:
        is_working, day_events, is_closed = day_state(day)
        matching_rows = [
            (row, slots.get(row.slot_id))
            for row in weekly_rows
            if slots.get(row.slot_id) and slots[row.slot_id].day == day.strftime("%A")
        ]
        if is_working:
            for row, slot in matching_rows:
                results.append({
                    "date": day.isoformat(),
                    "weekday": day.strftime("%A"),
                    "status": "scheduled",
                    "class_id": row.class_id,
                    "subject_id": row.subject_id,
                    "teacher_id": row.teacher_id,
                    "room_id": row.room_id,
                    "slot_id": row.slot_id,
                    "period_number": slot.period_number,
                    "event_titles": [event.title for event in day_events],
                    "suggested_replacement_date": None,
                })
        elif is_closed:
            for row, slot in matching_rows:
                suggestion = None
                if term.reschedule_policy == "suggest":
                    candidate = day + timedelta(days=1)
                    while candidate <= term.end_date:
                        candidate_working, _, candidate_closed = day_state(candidate)
                        if candidate_working and not candidate_closed and not conflicts(candidate, row, slot):
                            suggestion = candidate.isoformat()
                            break
                        candidate += timedelta(days=1)
                results.append({
                    "date": day.isoformat(),
                    "weekday": day.strftime("%A"),
                    "status": "cancelled_holiday",
                    "class_id": row.class_id,
                    "subject_id": row.subject_id,
                    "teacher_id": row.teacher_id,
                    "room_id": row.room_id,
                    "slot_id": row.slot_id,
                    "period_number": slot.period_number,
                    "event_titles": [event.title for event in day_events],
                    "suggested_replacement_date": suggestion,
                    "requires_admin_approval": bool(suggestion),
                })
        day += timedelta(days=1)

    return {
        "term": serialize_term(term),
        "total_sessions": sum(item["status"] == "scheduled" for item in results),
        "cancelled_sessions": sum(item["status"] == "cancelled_holiday" for item in results),
        "sessions": results,
        "note": "Replacement dates are suggestions only and are not applied without administrator approval.",
    }


@router.patch("/events/{event_id}")
def update_event(event_id: int, payload: EventCreate, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    term = get_term_or_404(db, event.term_id)
    if payload.start_date < term.start_date or payload.end_date > term.end_date:
        raise HTTPException(status_code=422, detail="Calendar events must fall within the selected term dates.")
    overlaps = _overlapping_events(
        db.query(CalendarEvent).filter(
            CalendarEvent.term_id == event.term_id,
            CalendarEvent.start_date <= payload.end_date,
            CalendarEvent.end_date >= payload.start_date,
            CalendarEvent.approval_status != "rejected",
        ).all(),
        payload.start_date,
        payload.end_date,
        exclude_event_id=event.event_id,
    )
    event_data = payload.model_dump()
    if overlaps and payload.approval_status != "approved":
        event_data["approval_status"] = "pending"
        review_note = "Overlaps another calendar entry; administrator review required."
        event_data["notes"] = f"{event_data.get('notes') or ''} {review_note}".strip()
    for field, value in event_data.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    db.delete(event)
    db.commit()
    return None
