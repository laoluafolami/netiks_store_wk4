import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const internalApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";

function redirectTo(request: NextRequest, pathname: string, status: string) {
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3001";
  const url = new URL(`${protocol}://${host}${pathname}`);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, { status: 303 });
}

function setSessionCookies(response: NextResponse, data: { access_token: string; refresh_token?: string | null; user: object }) {
  response.cookies.set("netiks_access_token", data.access_token, { httpOnly: false, path: "/" });
  if (data.refresh_token) {
    response.cookies.set("netiks_refresh_token", data.refresh_token, { httpOnly: false, path: "/" });
  }
  response.cookies.set("netiks_user", JSON.stringify(data.user), { httpOnly: false, path: "/" });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const action = (await context.params).action;

  try {
    if (action === "register" || action === "login") {
      const formData = await request.formData();
      const payload =
        action === "register"
          ? {
              email: String(formData.get("email") ?? ""),
              full_name: String(formData.get("full_name") ?? ""),
              password: String(formData.get("password") ?? ""),
            }
          : {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
            };

      const response = await fetch(`${internalApiBase}/auth/${action}`, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const raw = await response.text();
      if (!response.ok) {
        return redirectTo(request, `/${action}`, raw || "Authentication failed.");
      }

      const data = raw ? JSON.parse(raw) : null;
      const redirect = redirectTo(
        request,
        "/dashboard",
        action === "register" ? "Account created. You can now set up your store." : "Signed in successfully.",
      );
      setSessionCookies(redirect, data);
      return redirect;
    }

    if (action === "logout") {
      const response = redirectTo(request, "/market", "Signed out successfully.");
      response.cookies.delete("netiks_access_token");
      response.cookies.delete("netiks_refresh_token");
      response.cookies.delete("netiks_user");
      return response;
    }

    return redirectTo(request, "/login", "Unknown auth action.");
  } catch (error) {
    return redirectTo(request, "/login", error instanceof Error ? error.message : "Authentication failed.");
  }
}
