import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  slug: string;
  name: string;
  price: string;
  description: string;
  image: string;
  rating: number;
  reviews: number;
  accent?: "outline" | "solid";
};

export function ProductCard({
  slug,
  name,
  price,
  description,
  image,
  rating,
  reviews,
  accent = "outline",
}: ProductCardProps) {
  const stars = Array.from({ length: 5 }, (_, index) => index < Math.round(rating));

  return (
    <article className="group">
      <Link href={`/products/${slug}`} className="block">
        <div className="product-tile">
          <button
            aria-label={`Save ${name}`}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-[1.1rem] text-[#1d1d1b] shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-transform duration-300 group-hover:scale-105"
            type="button"
          >
            ♡
          </button>
          <Image alt={name} className="product-image" fill sizes="(min-width: 1280px) 22vw, (min-width: 768px) 40vw, 90vw" src={image} />
        </div>
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <Link href={`/products/${slug}`}>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#161615]">{name}</h3>
          </Link>
          <p className="mt-2 max-w-[16rem] text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        <p className="whitespace-nowrap text-[1.05rem] font-semibold tracking-[-0.03em] text-[#171615]">
          {price}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="flex gap-0.5 text-[#16a34a]">
          {stars.map((filled, index) => (
            <span key={index}>{filled ? "★" : "☆"}</span>
          ))}
        </span>
        <span className="text-[var(--muted)]">({reviews})</span>
      </div>

      <button
        className={
          accent === "solid"
            ? "mt-5 rounded-full bg-[#0f5b43] px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0b4b37]"
            : "mt-5 rounded-full border border-[#1f1e1a] px-6 py-3 text-sm font-medium text-[#1f1e1a] transition-colors duration-200 hover:bg-[#1f1e1a] hover:text-white"
        }
        type="button"
      >
        Add to Cart
      </button>
    </article>
  );
}
