from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_db
from app.models.models import Room
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _dump_payload(payload):
    """
    Support both Pydantic v1 and v2.
    """
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True)

    return payload.dict(exclude_unset=True)


def _normalize_room_number(value: str) -> str:
    """
    Normalize whitespace while preserving the user's
    preferred room label/capitalization.
    """
    return " ".join(value.strip().split())


def _find_duplicate_room(
    db: Session,
    room_number: str,
    exclude_id: int | None = None,
):
    """
    Room numbers are globally unique, case-insensitively.
    """

    normalized = _normalize_room_number(room_number)

    query = db.query(Room).filter(
        func.lower(func.trim(Room.room_number))
        == normalized.lower()
    )

    if exclude_id is not None:
        query = query.filter(Room.room_id != exclude_id)

    return query.first()


def _room_read(room: Room) -> RoomRead:
    return RoomRead(
        room_id=room.room_id,
        room_number=room.room_number,
        room_type=room.room_type,
    )


@router.get("", response_model=List[RoomRead])
def get_rooms(db: Session = Depends(get_db)) -> List[RoomRead]:

    rooms = (
        db.query(Room)
        .order_by(Room.room_number)
        .all()
    )

    return [_room_read(room) for room in rooms]


@router.get("/{room_id}", response_model=RoomRead)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
) -> RoomRead:

    room = (
        db.query(Room)
        .filter(Room.room_id == room_id)
        .first()
    )

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    return _room_read(room)


@router.post(
    "",
    response_model=RoomRead,
    status_code=status.HTTP_201_CREATED,
)
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
) -> RoomRead:

    data = _dump_payload(payload)

    room_number = _normalize_room_number(
        data.get("room_number", "")
    )

    if not room_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Room number cannot be empty.",
        )

    duplicate = _find_duplicate_room(
        db,
        room_number,
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f'Room "{duplicate.room_number}" already exists. '
                "Room numbers must be unique."
            ),
        )

    data["room_number"] = room_number

    if not data.get("room_type"):
        data["room_type"] = "classroom"

    room = Room(**data)

    db.add(room)

    try:
        db.commit()
        db.refresh(room)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f'Room "{room_number}" already exists. '
                "Room numbers must be unique."
            ),
        )

    return _room_read(room)


@router.put(
    "/{room_id}",
    response_model=RoomRead,
)
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
) -> RoomRead:

    room = (
        db.query(Room)
        .filter(Room.room_id == room_id)
        .first()
    )

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    data = _dump_payload(payload)

    if "room_number" in data and data["room_number"] is not None:

        normalized_number = _normalize_room_number(
            data["room_number"]
        )

        if not normalized_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Room number cannot be empty.",
            )

        duplicate = _find_duplicate_room(
            db,
            normalized_number,
            exclude_id=room_id,
        )

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f'Room "{duplicate.room_number}" already exists. '
                    "Room numbers must be unique."
                ),
            )

        data["room_number"] = normalized_number

    for field, value in data.items():
        setattr(room, field, value)

    db.add(room)

    try:
        db.commit()
        db.refresh(room)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Another room already uses this room number."
            ),
        )

    return _room_read(room)


@router.delete(
    "/{room_id}",
    response_model=RoomRead,
)
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
) -> RoomRead:

    room = (
        db.query(Room)
        .filter(Room.room_id == room_id)
        .first()
    )

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    deleted = _room_read(room)

    from app.models.models import Timetable

    db.query(Timetable).filter(
        Timetable.room_id == room_id
    ).delete(
        synchronize_session=False
    )

    db.delete(room)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This room cannot be deleted because it "
                "is currently being used."
            ),
        )

    return deleted