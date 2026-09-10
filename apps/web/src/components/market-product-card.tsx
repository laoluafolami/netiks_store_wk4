import Image from "next/image";
import Link from "next/link";

import { resolveMediaUrl } from "@/lib/api";
import type { ProductRecord } from "@/lib/types";

type MarketProductCardProps = {
  product: ProductRecord;
};

export function MarketProductCard({ product }: MarketProductCardProps) {
  const imageSrc = resolveMediaUrl(product.featured_image_url);
  const soldOut = product.stock_quantity <= 0;

  return (
    <article className="rounded-[1.5rem] border border-[var(--line)] bg-[#fbfaf7] p-4">
      <Link className="block" href={`/products/${product.slug}`}>
        <div className="product-tile">
          {imageSrc ? (
            <Image
              alt={product.name}
              className="product-image"
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
              src={imageSrc}
              unoptimized
            />
          ) : (
            <div className="flex h-[19rem] items-center justify-center text-sm text-[var(--muted)]">No image</div>
          )}
        </div>
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <Link href={`/products/${product.slug}`}>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#121212]">{product.name}</h2>
          </Link>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{product.description}</p>
        </div>
        <span className="text-base font-semibold text-[#121212]">
          {product.currency} {product.price}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span>{product.sold_quantity} sold</span>
        <span>{product.stock_quantity} left</span>
        <span className={soldOut ? "font-semibold text-[#9f1239]" : "font-semibold text-[#166534]"}>
          {soldOut ? "Sold out" : "Ready to ship"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="rounded-full border border-[#1f1e1a] px-6 py-3 text-sm font-medium text-[#1f1e1a] transition-colors duration-200 hover:bg-[#1f1e1a] hover:text-white" href={`/products/${product.slug}`}>
          View details
        </Link>
        <Link
          className={`rounded-full px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ${
            soldOut ? "pointer-events-none bg-[#b8b3aa]" : "bg-[#0f5b43] hover:bg-[#0b4b37]"
          }`}
          href={`/checkout/${product.slug}`}
        >
          {soldOut ? "Unavailable" : "Buy now"}
        </Link>
      </div>
    </article>
  );
}
