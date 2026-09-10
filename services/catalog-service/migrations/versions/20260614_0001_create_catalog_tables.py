"""create catalog categories and products tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260614_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS catalog")
    op.create_table(
        "categories",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
        schema="catalog",
    )
    op.create_index("ix_catalog_categories_slug", "categories", ["slug"], unique=False, schema="catalog")

    op.create_table(
        "products",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("store_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sku", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("featured_image_url", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["category_id"], ["catalog.categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        schema="catalog",
    )
    op.create_index("ix_catalog_products_store_id", "products", ["store_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_products_owner_id", "products", ["owner_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_products_category_id", "products", ["category_id"], unique=False, schema="catalog")
    op.create_index("ix_catalog_products_slug", "products", ["slug"], unique=False, schema="catalog")


def downgrade() -> None:
    op.drop_index("ix_catalog_products_slug", table_name="products", schema="catalog")
    op.drop_index("ix_catalog_products_category_id", table_name="products", schema="catalog")
    op.drop_index("ix_catalog_products_owner_id", table_name="products", schema="catalog")
    op.drop_index("ix_catalog_products_store_id", table_name="products", schema="catalog")
    op.drop_table("products", schema="catalog")
    op.drop_index("ix_catalog_categories_slug", table_name="categories", schema="catalog")
    op.drop_table("categories", schema="catalog")
