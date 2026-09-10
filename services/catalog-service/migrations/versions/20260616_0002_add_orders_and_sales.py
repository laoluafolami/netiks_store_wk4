"""add orders table and sold quantity to products"""

from alembic import op
import sqlalchemy as sa


revision = "20260616_0002"
down_revision = "20260614_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("sold_quantity", sa.Integer(), nullable=False, server_default="0"),
        schema="catalog",
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("buyer_name", sa.String(length=120), nullable=False),
        sa.Column("buyer_email", sa.String(length=255), nullable=False),
        sa.Column("buyer_phone", sa.String(length=40), nullable=True),
        sa.Column("shipping_address", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(length=40), nullable=False, server_default="demo-card"),
        sa.Column("payment_reference", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="paid"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["catalog.products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_reference"),
        schema="catalog",
    )
    op.create_index("ix_catalog_orders_product_id", "orders", ["product_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_orders_store_id", "orders", ["store_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_orders_owner_id", "orders", ["owner_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_orders_buyer_email", "orders", ["buyer_email"], unique=False, schema="catalog")
    op.create_index(
        "ix_catalog_orders_payment_reference",
        "orders",
        ["payment_reference"],
        unique=False,
        schema="catalog",
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_orders_payment_reference", table_name="orders", schema="catalog")
    op.drop_index("ix_catalog_orders_buyer_email", table_name="orders", schema="catalog")
    op.drop_index("ix_catalog_orders_owner_id", table_name="orders", schema="catalog")
    op.drop_index("ix_catalog_orders_store_id", table_name="orders", schema="catalog")
    op.drop_index("ix_catalog_orders_product_id", table_name="orders", schema="catalog")
    op.drop_table("orders", schema="catalog")
    op.drop_column("products", "sold_quantity", schema="catalog")
