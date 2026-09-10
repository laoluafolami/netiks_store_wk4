import Image from "next/image";
import Link from "next/link";

import { MarketProductCard } from "@/components/market-product-card";
import { SectionHeading } from "@/components/section-heading";
import { SiteNav } from "@/components/site-nav";
import { fetchProducts, fetchStores } from "@/lib/api";
import { getViewer } from "@/lib/session";

export default async function Home() {
  const { user } = await getViewer();
  const [productsResponse, storesResponse] = await Promise.allSettled([fetchProducts(), fetchStores()]);
  const products = productsResponse.status === "fulfilled" ? productsResponse.value.data.slice(0, 4) : [];
  const stores = storesResponse.status === "fulfilled" ? storesResponse.value.data.slice(0, 2) : [];

  return (
    <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[84rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8 xl:px-14 xl:py-10">
        <header className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Netiks Store</p>
            <h1 className="mt-3 max-w-3xl text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3.4rem]">
              Discover thoughtful products for work, travel, and everyday carry.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              Discover products from independent sellers, explore product details, and place orders with a smooth checkout experience.
              Sellers can create a store, publish products, and track sales from the dashboard.
            </p>
          </div>

          <SiteNav current="home" user={user} />
        </header>

        <section className="grid gap-4 border-b border-[var(--line)] py-8 lg:grid-cols-[1.1fr_1fr_1fr]">
          <article className="rounded-[1.6rem] bg-[#f5efe2] px-5 py-5 md:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#977419]">Shop the collection</p>
            <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-[#181715]">
              Explore the marketplace, compare products, and complete your order with confidence.
            </h2>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link className="nav-pill nav-pill-active" href="/market">
                Browse live market
              </Link>
              <Link className="nav-pill" href={user ? "/dashboard" : "/register"}>
                {user ? "Open dashboard" : "Become a vendor"}
              </Link>
            </div>
          </article>

          {stores.length > 0 ? (
            stores.map((store) => (
              <article key={store.id} className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] px-5 py-5 md:px-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold tracking-[-0.03em] text-[#151513]">{store.name}</p>
                  <span className="text-[#8d7727]">↗</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{store.description}</p>
              </article>
            ))
          ) : (
            <>
              <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] px-5 py-5 md:px-6">
                <p className="text-base font-semibold tracking-[-0.03em] text-[#151513]">Vendor dashboard</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open a store, publish your products, and manage your sales in one place.</p>
              </article>
              <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] px-5 py-5 md:px-6">
                <p className="text-base font-semibold tracking-[-0.03em] text-[#151513]">Inventory tracking</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Every completed order updates stock levels and sales counts automatically.</p>
              </article>
            </>
          )}
        </section>

        <section className="py-10">
          <SectionHeading
            title="Live Products"
            description="Fresh arrivals and bestsellers from stores currently selling on Netiks Store."
          />
          <div className="grid gap-x-5 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
            {products.length === 0 ? (
              <article className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
                No public products yet. Publish one from the vendor dashboard and it will appear here.
              </article>
            ) : (
              products.map((product) => <MarketProductCard key={product.id} product={product} />)
            )}
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-10">
          <SectionHeading
            title="Why Shoppers Choose Netiks Store"
            description="A smooth shopping experience from discovery through checkout."
          />
          <div className="grid gap-5 md:grid-cols-3">
            <article className="rounded-[1.5rem] border border-[var(--line)] bg-[#fbfaf7] p-5">
              <p className="text-lg font-semibold text-[#161615]">1. Discover products</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Browse curated categories, compare details, and find products that fit your day-to-day needs.</p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--line)] bg-[#fbfaf7] p-5">
              <p className="text-lg font-semibold text-[#161615]">2. Order with ease</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Move from product page to checkout quickly with clear pricing, quantity selection, and order confirmation.</p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--line)] bg-[#fbfaf7] p-5">
              <p className="text-lg font-semibold text-[#161615]">3. Shop trusted stores</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Every listing comes from a store owner who manages inventory, availability, and order fulfillment directly.</p>
            </article>
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#907314]">Designed for modern work</p>
              <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-[#111110]">
                Products that fit focused desks, everyday carry, and thoughtful workspaces.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
              From compact audio gear to workspace essentials, Netiks Store brings together useful products from independent sellers with a clean and straightforward buying experience.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="hero-image hero-image-large">
              <Image
                alt="Featured workspace setup"
                fill
                sizes="(min-width: 1024px) 34vw, 90vw"
                src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"
                unoptimized
              />
            </div>
            <div className="hero-image hero-image-large">
              <Image
                alt="Headphones and compact accessories"
                fill
                sizes="(min-width: 1024px) 30vw, 90vw"
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80"
                unoptimized
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
