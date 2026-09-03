from fastapi import APIRouter, Depends, status

from app.dependencies import get_auth_service, get_current_user_id
from app.errors import InvalidSessionError
from app.schemas.user import TokenResponse, UserLogin, UserOut, UserSignup
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserSignup, auth: AuthService = Depends(get_auth_service)) -> TokenResponse:
    return await auth.signup(payload)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, auth: AuthService = Depends(get_auth_service)) -> TokenResponse:
    return await auth.login(payload)


@router.get("/me", response_model=UserOut)
async def me(
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
) -> UserOut:
    user = await auth.get_user(user_id)
    if user is None:
        raise InvalidSessionError("User no longer exists.")
    return user
