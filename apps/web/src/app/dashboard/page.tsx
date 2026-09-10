import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { fetchCategories, fetchMyStore, fetchVendorOrders, fetchVendorProducts } from "@/lib/api";
import { getViewer } from "@/lib/session";
import type { CategoryRecord, OrderRecord, ProductRecord, StoreRecord } from "@/lib/types";

type DashboardPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const { token, user } = await getViewer();

  if (!token || !user) {
    redirect("/login?status=Please sign in to open the vendor dashboard.");
  }

  let categories: CategoryRecord[] = [];
  let products: ProductRecord[] = [];
  let orders: OrderRecord[] = [];
  let store: StoreRecord | null = null;

  try {
    const [categoryResponse, productsResponse, ordersResponse] = await Promise.all([
      fetchCategories(token),
      fetchVendorProducts(token),
      fetchVendorOrders(token),
    ]);
    categories = categoryResponse.data;
    products = productsResponse.data;
    orders = ordersResponse.data;
  } catch {
    categories = [];
    products = [];
    orders = [];
  }

  try {
    const storeResponse = await fetchMyStore(token);
    store = storeResponse.data;
  } catch {
    store = null;
  }

  const totalSold = products.reduce((sum, product) => sum + product.sold_quantity, 0);
  const inventoryLeft = products.reduce((sum, product) => sum + product.stock_quantity, 0);

  return (
    <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[88rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8 xl:px-14 xl:py-10">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Vendor Dashboard</p>
            <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
              {store ? `${store.name} is live.` : "Set up your store and publish products."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              {params.status ?? "Create your store, organize your catalog, and manage sales from one streamlined dashboard."}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <SiteNav current="dashboard" user={user} />
            <form action="/auth/actions/logout" method="post">
              <button className="rounded-full border border-[#111111] px-4 py-2 text-xs font-semibold text-[#111111]" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-4 py-8 md:grid-cols-3">
          <article className="rounded-[1.5rem] bg-[#f5efe2] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7727]">Products</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#171615]">{products.length}</p>
          </article>
          <article className="rounded-[1.5rem] bg-[#f5efe2] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7727]">Units Sold</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#171615]">{totalSold}</p>
          </article>
          <article className="rounded-[1.5rem] bg-[#f5efe2] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7727]">Inventory Left</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#171615]">{inventoryLeft}</p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Store setup</h2>
            {store ? (
              <div className="mt-5 rounded-[1.25rem] bg-white p-5">
                <p className="text-lg font-semibold text-[#171615]">{store.name}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{store.description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                  <span>{store.contact_email}</span>
                  <span>{store.slug}</span>
                  <span>{store.status}</span>
                </div>
              </div>
            ) : (
              <form action="/dashboard/actions/store" className="mt-5 grid gap-4 md:grid-cols-2" method="post">
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Store name
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Harbor & Pine Supply" name="name" required />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Store slug
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="harbor-and-pine-supply" name="slug" required />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
                  Contact email
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue={user.email} name="contact_email" required type="email" />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
                  Description
                  <textarea className="min-h-28 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Thoughtful desk tools, travel tech, and calm everyday accessories for focused work." name="description" required />
                </label>
                <button className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white" type="submit">
                  Create store
                </button>
              </form>
            )}
          </article>

          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Create category</h2>
            <form action="/dashboard/actions/category" className="mt-5 grid gap-4 md:grid-cols-2" method="post">
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Category name
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Workspace Audio" name="name" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Category slug
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="workspace-audio" name="slug" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
                Description
                <textarea className="min-h-24 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Headphones, speakers, and desk-friendly audio gear for everyday work." name="description" required />
              </label>
              <button className="inline-flex items-center justify-center rounded-full border border-[#111111] px-5 py-3 text-sm font-semibold text-[#111111]" type="submit">
                Save category
              </button>
            </form>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Publish product</h2>
              <Link className="nav-pill" href="/market">
                View public market
              </Link>
            </div>

            <form action="/dashboard/actions/product" className="mt-5 grid gap-4 md:grid-cols-2" encType="multipart/form-data" method="post">
              <input name="store_id" type="hidden" value={store?.id ?? ""} />
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Product name
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Slate Wireless Headphones" name="name" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Product slug
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" placeholder="product-slug" name="slug" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
                Description
                <textarea className="min-h-28 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Balanced over-ear headphones with a soft matte finish and all-day comfort." name="description" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Price
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="149.99" name="price" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Stock quantity
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="18" min="0" name="stock_quantity" required type="number" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                SKU
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="SLATE-WH-001" name="sku" required />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Category
                <select
                  className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]"
                  defaultValue={categories[0]?.id ?? ""}
                  disabled={categories.length === 0}
                  name="category_id"
                  required
                >
                  {categories.length === 0 ? <option value="">Create a category first</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Upload image
                <input accept="image/png,image/jpeg,image/webp" className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[#121212]" name="file" type="file" />
              </label>
              <div className="rounded-[1rem] bg-[#f5efe2] px-4 py-4 text-sm text-[#4f493d]">
                Add a product photo to complete your listing. If you skip this step, your product will still be published with a catalog image.
              </div>
              <button className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={!store || categories.length === 0} type="submit">
                Publish product
              </button>
            </form>
          </article>

          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Sales snapshot</h2>
            <div className="mt-5 grid gap-4">
              {products.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                  Publish your first product and the dashboard will start tracking units sold and remaining stock.
                </div>
              ) : (
                products.map((product) => (
                  <article className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-4" key={product.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold tracking-[-0.03em] text-[#121212]">{product.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{product.description}</p>
                      </div>
                      <span className="rounded-full bg-[#f5efe2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d7727]">
                        {product.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                      <span>{product.currency} {product.price}</span>
                      <span>{product.sold_quantity} sold</span>
                      <span>{product.stock_quantity} remaining</span>
                      <span>{product.sku}</span>
                    </div>
                  </article>
                ))
              )}
            </div>

            <h3 className="mt-8 text-lg font-semibold tracking-[-0.03em] text-[#141413]">Recent orders</h3>
            <div className="mt-4 grid gap-3">
              {orders.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                  No orders yet. New purchases will appear here as soon as customers start checking out.
                </div>
              ) : (
                orders.slice(0, 5).map((order) => (
                  <article className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-4" key={order.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#121212]">{order.buyer_name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{order.buyer_email}</p>
                      </div>
                      <span className="text-sm font-semibold text-[#121212]">USD {order.total_price}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      <span>{order.status}</span>
                      <span>{order.quantity} units</span>
                      <span>{order.payment_reference}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
