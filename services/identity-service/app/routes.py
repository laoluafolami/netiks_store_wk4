from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
import jwt
from sqlalchemy.orm import Session

from app.database import get_db_session
from app.schemas import AuthResponse, LoginRequest, RefreshTokenRequest, RegisterRequest
from app.security import create_access_token, decode_access_token
from app.service import (
    authenticate_user,
    get_current_user,
    issue_session_tokens,
    register_user,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    user = register_user(session, payload)
    refresh_token, _ = issue_session_tokens(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    token = create_access_token(subject=user.id, email=user.email, role=user.role)
    return AuthResponse(
        access_token=token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    user = authenticate_user(session, payload)
    refresh_token, _ = issue_session_tokens(
        session,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    token = create_access_token(subject=user.id, email=user.email, role=user.role)
    return AuthResponse(
        access_token=token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    )


@router.get("/me")
async def me(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_db_session),
) -> dict[str, dict[str, str]]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    user = get_current_user(session, payload["sub"])
    return {
        "data": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
    }


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    user, refresh_token = rotate_refresh_token(
        session,
        refresh_token=payload.refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    token = create_access_token(subject=user.id, email=user.email, role=user.role)
    return AuthResponse(
        access_token=token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    )
