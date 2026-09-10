import { MarketProductCard } from "@/components/market-product-card";
import { SiteNav } from "@/components/site-nav";
import { fetchProducts } from "@/lib/api";
import { getViewer } from "@/lib/session";

export default async function MarketPage() {
  const { user } = await getViewer();
  const products = await fetchProducts().then((payload) => payload.data).catch(() => []);
  const status =
    products.length > 0
      ? "Explore products from independent stores currently selling on Netiks Store."
      : "No published products yet.";

  return (
    <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[88rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8 xl:px-14 xl:py-10">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Live Marketplace</p>
            <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
              Public products that shoppers can inspect and buy immediately.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{status}</p>
          </div>

          <SiteNav current="market" user={user} />
        </header>

        <section className="grid gap-x-5 gap-y-8 py-10 md:grid-cols-2 xl:grid-cols-3">
          {products.length === 0 ? (
            <article className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
              Publish a product from the vendor dashboard and it will appear here.
            </article>
          ) : (
            products.map((product) => <MarketProductCard key={product.id} product={product} />)
          )}
        </section>
      </div>
    </main>
  );
}
