"""create identity auth sessions table"""

from alembic import op
import sqlalchemy as sa


revision = "20260614_0002"
down_revision = "20260614_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["identity.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
        schema="identity",
    )
    op.create_index(
        "ix_identity_auth_sessions_refresh_token_hash",
        "auth_sessions",
        ["refresh_token_hash"],
        unique=False,
        schema="identity",
    )
    op.create_index(
        "ix_identity_auth_sessions_user_id",
        "auth_sessions",
        ["user_id"],
        unique=False,
        schema="identity",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_identity_auth_sessions_user_id",
        table_name="auth_sessions",
        schema="identity",
    )
    op.drop_index(
        "ix_identity_auth_sessions_refresh_token_hash",
        table_name="auth_sessions",
        schema="identity",
    )
    op.drop_table("auth_sessions", schema="identity")
