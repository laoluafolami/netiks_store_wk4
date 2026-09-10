import Link from "next/link";

import type { AuthUser } from "@/lib/types";

type SiteNavProps = {
  current: "home" | "market" | "login" | "register" | "dashboard" | "product" | "checkout";
  user?: AuthUser | null;
};

function linkClass(active: boolean) {
  return active ? "nav-pill nav-pill-active" : "nav-pill";
}

export function SiteNav({ current, user }: SiteNavProps) {
  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
      <Link className={linkClass(current === "home")} href="/">
        Home
      </Link>
      <Link className={linkClass(current === "market" || current === "product" || current === "checkout")} href="/market">
        Market
      </Link>
      {user ? (
        <Link className={linkClass(current === "dashboard")} href="/dashboard">
          Dashboard
        </Link>
      ) : (
        <>
          <Link className={linkClass(current === "login")} href="/login">
            Login
          </Link>
          <Link className={linkClass(current === "register")} href="/register">
            Register
          </Link>
        </>
      )}
    </nav>
  );
}
