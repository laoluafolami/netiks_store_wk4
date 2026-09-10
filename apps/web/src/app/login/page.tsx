import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { getViewer } from "@/lib/session";

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const { user } = await getViewer();

  return (
    <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[72rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Vendor Access</p>
            <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
              Sign in to manage your store, inventory, and sales.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              Sign in to manage your storefront, keep inventory current, and stay on top of new orders.
            </p>
          </div>

          <SiteNav current="login" user={user} />
        </header>

        <section className="grid gap-6 py-10 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[1.6rem] bg-[#f5efe2] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8d7727]">What vendors can do</p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#4f493d]">
              <li>Set up your store profile</li>
              <li>Publish products with stock counts and images</li>
              <li>Track units sold and customer orders</li>
            </ul>
          </article>

          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Login</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{params.status ?? "Sign in with your seller account."}</p>

            <form action="/auth/actions/login" className="mt-6 grid gap-4" method="post">
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Email
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" name="email" required type="email" />
              </label>
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Password
                <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" minLength={8} name="password" required type="password" />
              </label>
              <button className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white" type="submit">
                Sign in
              </button>
            </form>

            <p className="mt-6 text-sm text-[var(--muted)]">
              New vendor?{" "}
              <Link className="font-semibold text-[#111111]" href="/register">
                Create your account
              </Link>
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
