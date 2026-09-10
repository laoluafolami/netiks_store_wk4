from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import AuthSession, User
from app.repository import (
    create_auth_session,
    create_user,
    get_auth_session_by_refresh_token_hash,
    get_user_by_email,
    get_user_by_id,
    revoke_auth_session,
)
from app.schemas import LoginRequest, RegisterRequest
from app.security import (
    build_refresh_token_expiry,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def register_user(session: Session, payload: RegisterRequest):
    email = normalize_email(payload.email)
    existing_user = get_user_by_email(session, email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    return create_user(
        session,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )


def authenticate_user(session: Session, payload: LoginRequest):
    email = normalize_email(payload.email)
    user = get_user_by_email(session, email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    return user


def get_current_user(session: Session, user_id: str):
    user = get_user_by_id(session, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def issue_session_tokens(
    session: Session,
    user: User,
    *,
    user_agent: str | None,
    ip_address: str | None,
) -> tuple[str, AuthSession]:
    refresh_token = create_refresh_token()
    auth_session = create_auth_session(
        session,
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=build_refresh_token_expiry(),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return refresh_token, auth_session


def rotate_refresh_token(
    session: Session,
    *,
    refresh_token: str,
    user_agent: str | None,
    ip_address: str | None,
) -> tuple[User, str]:
    now = datetime.now(UTC)
    auth_session = get_auth_session_by_refresh_token_hash(session, hash_refresh_token(refresh_token))
    if not auth_session or auth_session.revoked_at is not None or auth_session.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = get_current_user(session, auth_session.user_id)
    revoke_auth_session(session, auth_session, revoked_at=now)
    new_refresh_token, _ = issue_session_tokens(
        session,
        user,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return user, new_refresh_token
