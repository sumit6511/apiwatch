from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class UserOut(BaseModel):
    id: str
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    token: str
    user: UserOut
