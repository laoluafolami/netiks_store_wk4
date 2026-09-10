from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthSession, User


def get_user_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return session.execute(statement).scalar_one_or_none()


def get_user_by_id(session: Session, user_id: str) -> User | None:
    statement = select(User).where(User.id == user_id)
    return session.execute(statement).scalar_one_or_none()


def create_user(
    session: Session,
    *,
    full_name: str,
    email: str,
    password_hash: str,
    role: str = "vendor",
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        role=role,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_auth_session(
    session: Session,
    *,
    user_id: str,
    refresh_token_hash: str,
    expires_at: datetime,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthSession:
    auth_session = AuthSession(
        user_id=user_id,
        refresh_token_hash=refresh_token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return auth_session


def get_auth_session_by_refresh_token_hash(
    session: Session,
    refresh_token_hash: str,
) -> AuthSession | None:
    statement = select(AuthSession).where(AuthSession.refresh_token_hash == refresh_token_hash)
    return session.execute(statement).scalar_one_or_none()


def revoke_auth_session(session: Session, auth_session: AuthSession, revoked_at: datetime) -> AuthSession:
    auth_session.revoked_at = revoked_at
    auth_session.last_used_at = revoked_at
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return auth_session
