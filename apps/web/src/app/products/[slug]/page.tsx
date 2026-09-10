import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { fetchProduct, resolveMediaUrl } from "@/lib/api";
import { getViewer } from "@/lib/session";

type ProductDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { slug } = await params;
  const { user } = await getViewer();

  try {
    const response = await fetchProduct(slug);
    const product = response.data;
    const soldOut = product.stock_quantity <= 0;
    const imageSrc = resolveMediaUrl(product.featured_image_url);

    return (
      <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-[88rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8 xl:px-14 xl:py-10">
          <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Product Details</p>
              <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
                {product.name}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{product.description}</p>
            </div>

            <SiteNav current="product" user={user} />
          </header>

          <section className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="product-tile min-h-[28rem]">
              {imageSrc ? (
                <Image
                  alt={product.name}
                  className="product-image h-full"
                  fill
                  sizes="(min-width: 1024px) 52vw, 92vw"
                  src={imageSrc}
                  unoptimized
                />
              ) : (
                <div className="flex h-[28rem] items-center justify-center text-sm text-[var(--muted)]">No image</div>
              )}
            </div>

            <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
              <p className="text-3xl font-semibold tracking-[-0.04em] text-[#171615]">
                {product.currency} {product.price}
              </p>
              <div className="mt-5 grid gap-3 text-sm text-[var(--muted)]">
                <p>{product.sold_quantity} units sold</p>
                <p>{product.stock_quantity} currently available</p>
                <p>SKU: {product.sku}</p>
              </div>

              <div className="mt-6 rounded-[1.25rem] bg-[#f5efe2] p-4 text-sm text-[#4f493d]">
                {soldOut
                  ? "This item is sold out and checkout is disabled until the vendor restocks it."
                  : "Secure checkout lets you confirm your order details, complete your purchase, and receive an instant order confirmation."}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="rounded-full border border-[#1f1e1a] px-6 py-3 text-sm font-medium text-[#1f1e1a] transition-colors duration-200 hover:bg-[#1f1e1a] hover:text-white" href="/market">
                  Back to market
                </Link>
                <Link
                  className={`rounded-full px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ${
                    soldOut ? "pointer-events-none bg-[#b8b3aa]" : "bg-[#0f5b43] hover:bg-[#0b4b37]"
                  }`}
                  href={`/checkout/${product.slug}`}
                >
                  {soldOut ? "Sold out" : "Buy this product"}
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
