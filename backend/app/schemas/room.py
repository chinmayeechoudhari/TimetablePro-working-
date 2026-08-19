from typing import Optional

from pydantic import BaseModel


class RoomBase(BaseModel):
    room_number: str
    room_type: str = "classroom"  # "classroom" or "lab"


class RoomCreate(BaseModel):
    room_number: str
    room_type: Optional[str] = None


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type: Optional[str] = None


class RoomRead(BaseModel):
    room_id: int
    room_number: str
    room_type: str

