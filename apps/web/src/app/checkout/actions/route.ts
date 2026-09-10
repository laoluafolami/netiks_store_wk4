import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const internalApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";

function redirectToCheckout(request: NextRequest, slug: string, status: string, reference?: string) {
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3001";
  const url = new URL(`${protocol}://${host}/checkout/${slug}`);
  url.searchParams.set("status", status);
  if (reference) {
    url.searchParams.set("reference", reference);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const slug = String(formData.get("slug") ?? "");

  try {
    const response = await fetch(`${internalApiBase}/checkout`, {
      body: JSON.stringify({
        buyer_email: String(formData.get("buyer_email") ?? ""),
        buyer_name: String(formData.get("buyer_name") ?? ""),
        buyer_phone: String(formData.get("buyer_phone") ?? ""),
        payment_last4: String(formData.get("payment_last4") ?? ""),
        payment_method: "demo-card",
        product_id: String(formData.get("product_id") ?? ""),
        quantity: Number(formData.get("quantity") ?? 1),
        shipping_address: String(formData.get("shipping_address") ?? ""),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      return redirectToCheckout(
        request,
        slug,
        typeof data?.detail === "string" ? data.detail : raw || "Checkout failed.",
      );
    }

    return redirectToCheckout(
      request,
      slug,
      `Payment approved. Order ${data.data.payment_reference} is confirmed.`,
      data.data.payment_reference,
    );
  } catch (error) {
    return redirectToCheckout(request, slug, error instanceof Error ? error.message : "Checkout failed.");
  }
}
