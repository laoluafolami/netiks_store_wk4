"""create vendor stores table"""

from alembic import op
import sqlalchemy as sa


revision = "20260614_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS vendor")
    op.create_table(
        "stores",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("logo_url", sa.String(length=255), nullable=True),
        sa.Column("banner_url", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        schema="vendor",
    )
    op.create_index("ix_vendor_stores_owner_id", "stores", ["owner_id"], unique=False, schema="vendor")
    op.create_index("ix_vendor_stores_slug", "stores", ["slug"], unique=False, schema="vendor")


def downgrade() -> None:
    op.drop_index("ix_vendor_stores_slug", table_name="stores", schema="vendor")
    op.drop_index("ix_vendor_stores_owner_id", table_name="stores", schema="vendor")
    op.drop_table("stores", schema="vendor")
