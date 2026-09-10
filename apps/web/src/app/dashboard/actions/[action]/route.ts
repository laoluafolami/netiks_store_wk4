import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const internalApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";

const fallbackProductImages = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80",
];

function redirectToDashboard(request: NextRequest, status: string) {
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3001";
  const url = new URL(`${protocol}://${host}/dashboard`);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, { status: 303 });
}

async function requireToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("netiks_access_token")?.value;
  if (!token) {
    throw new Error("Please sign in before using the vendor dashboard.");
  }
  return token;
}

async function postJson(path: string, payload: object, token: string) {
  const response = await fetch(`${internalApiBase}/${path}`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : raw || "Request failed.");
  }

  return data;
}

async function uploadFile(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${internalApiBase}/uploads`, {
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : raw || "Upload failed.");
  }

  return data as { data: { url: string } };
}

function pickFallbackProductImage(seed: string) {
  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 33 + normalized.charCodeAt(index)) % fallbackProductImages.length;
  }
  return fallbackProductImages[hash];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const action = (await context.params).action;

  try {
    const token = await requireToken();
    const formData = await request.formData();

    if (action === "store") {
      await postJson(
        "stores",
        {
          contact_email: String(formData.get("contact_email") ?? ""),
          description: String(formData.get("description") ?? ""),
          name: String(formData.get("name") ?? ""),
          slug: String(formData.get("slug") ?? ""),
        },
        token,
      );
      return redirectToDashboard(request, "Store created successfully.");
    }

    if (action === "category") {
      await postJson(
        "categories",
        {
          description: String(formData.get("description") ?? ""),
          name: String(formData.get("name") ?? ""),
          slug: String(formData.get("slug") ?? ""),
        },
        token,
      );
      return redirectToDashboard(request, "Category created successfully.");
    }

    if (action === "product") {
      const uploadedFile = formData.get("file");
      const hasUploadedFile = uploadedFile instanceof File && uploadedFile.size > 0;
      const imageUrl = hasUploadedFile
        ? (await uploadFile(uploadedFile, token)).data.url
        : pickFallbackProductImage(String(formData.get("name") ?? formData.get("slug") ?? "netiks product"));

      await postJson(
        "products",
        {
          category_id: String(formData.get("category_id") ?? ""),
          currency: "USD",
          description: String(formData.get("description") ?? ""),
          featured_image_url: imageUrl,
          name: String(formData.get("name") ?? ""),
          price: String(formData.get("price") ?? ""),
          sku: String(formData.get("sku") ?? ""),
          slug: String(formData.get("slug") ?? ""),
          status: "published",
          stock_quantity: Number(formData.get("stock_quantity") ?? 0),
          store_id: String(formData.get("store_id") ?? ""),
        },
        token,
      );

      return redirectToDashboard(request, "Product uploaded and published successfully.");
    }

    return redirectToDashboard(request, "Unknown dashboard action.");
  } catch (error) {
    return redirectToDashboard(request, error instanceof Error ? error.message : "Dashboard action failed.");
  }
}
