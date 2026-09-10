import Link from "next/link";

import { RegisterForm } from "@/components/register-form";
import { SiteNav } from "@/components/site-nav";
import { getViewer } from "@/lib/session";

type RegisterPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const { user } = await getViewer();

  return (
    <main className="min-h-screen bg-[var(--page-wash)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[72rem] rounded-[2.2rem] bg-[var(--surface)] px-6 py-6 shadow-[0_30px_90px_rgba(88,71,14,0.08)] md:px-10 md:py-8">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#907314]">Become A Vendor</p>
            <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#141413] md:text-[3rem]">
              Create a seller account and start listing products.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              Join Netiks Store to open your storefront, publish products, and manage incoming orders.
            </p>
          </div>

          <SiteNav current="register" user={user} />
        </header>

        <section className="grid gap-6 py-10 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[1.6rem] bg-[#f5efe2] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8d7727]">Start selling</p>
            <p className="mt-4 text-sm leading-6 text-[#4f493d]">
              Create your account, verify your details, and begin setting up your store in just a few steps.
            </p>
            <p className="mt-4 text-sm leading-6 text-[#4f493d]">
              Once your account is ready, you can add categories, publish products, and monitor orders from your dashboard.
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-[var(--line)] bg-[#fbfaf7] p-6">
            <RegisterForm statusMessage={params.status} />

            <p className="mt-6 text-sm text-[var(--muted)]">
              Already registered?{" "}
              <Link className="font-semibold text-[#111111]" href="/login">
                Sign in
              </Link>
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
