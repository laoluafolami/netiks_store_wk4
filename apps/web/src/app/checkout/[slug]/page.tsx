import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { fetchProduct } from "@/lib/api";
import { getViewer } from "@/lib/session";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reference?: string; status?: string }>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const { user } = await getViewer();

  try {
    const response = await fetchProduct(slug);
    const product = response.data;
    const soldOut = product.stock_quantity <= 0;

    return (
      <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-[88rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8 xl:px-14 xl:py-10">
          <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Checkout</p>
              <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
                Complete a shopper purchase for {product.name}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
                {query.status ?? "Review your details, confirm your order, and complete checkout in just a few moments."}
              </p>
            </div>

            <SiteNav current="checkout" user={user} />
          </header>

          <section className="grid gap-6 py-10 lg:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Customer details</h2>
              <form action="/checkout/actions" className="mt-6 grid gap-4 md:grid-cols-2" method="post">
                <input name="product_id" type="hidden" value={product.id} />
                <input name="slug" type="hidden" value={product.slug} />

                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Full name
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="Naomi Cole" name="buyer_name" required />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Email
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="naomi.cole@example.com" name="buyer_email" required type="email" />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Phone
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="+1 415 555 0198" name="buyer_phone" />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Quantity
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="1" max={Math.max(product.stock_quantity, 1)} min="1" name="quantity" required type="number" />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
                  Shipping address
                  <textarea className="min-h-28 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="14 Mercer Lane, Brooklyn, NY 11201" name="shipping_address" required />
                </label>
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  Card last 4
                  <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" defaultValue="4242" maxLength={4} minLength={4} name="payment_last4" required />
                </label>
                <div className="rounded-[1rem] bg-[#f5efe2] px-4 py-4 text-sm text-[#4f493d]">
                  Your payment confirmation and order reference will appear as soon as the order is placed.
                </div>
                <button className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={soldOut} type="submit">
                  {soldOut ? "Sold out" : "Pay and place order"}
                </button>
              </form>
            </article>

            <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Order summary</h2>
              <div className="mt-6 grid gap-4 rounded-[1.25rem] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[#171615]">{product.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{product.description}</p>
                  </div>
                  <span className="text-base font-semibold text-[#171615]">
                    {product.currency} {product.price}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                  <span>{product.stock_quantity} remaining before purchase</span>
                  <span>{product.sold_quantity} already sold</span>
                </div>
                {query.reference ? (
                  <div className="rounded-[1rem] bg-[#eef8f3] px-4 py-4 text-sm text-[#166534]">
                    Order confirmed with reference <span className="font-semibold">{query.reference}</span>.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="rounded-full border border-[#1f1e1a] px-6 py-3 text-sm font-medium text-[#1f1e1a] transition-colors duration-200 hover:bg-[#1f1e1a] hover:text-white" href={`/products/${product.slug}`}>
                  Back to product
                </Link>
                <Link className="rounded-full border border-[#1f1e1a] px-6 py-3 text-sm font-medium text-[#1f1e1a] transition-colors duration-200 hover:bg-[#1f1e1a] hover:text-white" href="/market">
                  Continue shopping
                </Link>
              </div>
            </article>
          </section>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
