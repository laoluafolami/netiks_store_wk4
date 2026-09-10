import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const internalApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";

const demoImageBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0q8sAAAAASUVORK5CYII=";

function redirectToStudio(request: NextRequest, status: string) {
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3001";
  const url = new URL(`${protocol}://${host}/studio?status=${encodeURIComponent(status)}`);
  return NextResponse.redirect(url, { status: 303 });
}

async function requireToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("netiks_access_token")?.value;
  if (!token) {
    throw new Error("Please authenticate first.");
  }
  return token;
}

async function postJson(path: string, payload: object, token?: string) {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${internalApiBase}/${path}`, {
    body: JSON.stringify(payload),
    headers,
    method: "POST",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : "Request failed.");
  }

  return data;
}

async function uploadFile(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${internalApiBase}/uploads`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : "Upload failed.");
  }

  return data as { data: { url: string } };
}

function buildDemoFile() {
  const bytes = Uint8Array.from(atob(demoImageBase64), (char) => char.charCodeAt(0));
  return new File([bytes], "qa-demo.png", { type: "image/png" });
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      action: string;
    }>;
  },
) {
  const action = (await context.params).action;

  try {
    if (action === "register") {
      const formData = await request.formData();
      const data = await postJson("auth/register", {
        email: String(formData.get("email") ?? ""),
        full_name: String(formData.get("full_name") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      const response = redirectToStudio(request, "Authenticated. The seller studio is ready.");
      response.cookies.set("netiks_access_token", data.access_token, { httpOnly: false, path: "/" });
      response.cookies.set("netiks_refresh_token", data.refresh_token, { httpOnly: false, path: "/" });
      response.cookies.set("netiks_user", JSON.stringify(data.user), { httpOnly: false, path: "/" });
      return response;
    }

    if (action === "login") {
      const formData = await request.formData();
      const data = await postJson("auth/login", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      const response = redirectToStudio(request, "Signed in successfully.");
      response.cookies.set("netiks_access_token", data.access_token, { httpOnly: false, path: "/" });
      response.cookies.set("netiks_refresh_token", data.refresh_token, { httpOnly: false, path: "/" });
      response.cookies.set("netiks_user", JSON.stringify(data.user), { httpOnly: false, path: "/" });
      return response;
    }

    if (action === "logout") {
      const response = redirectToStudio(request, "Session cleared.");
      response.cookies.delete("netiks_access_token");
      response.cookies.delete("netiks_refresh_token");
      response.cookies.delete("netiks_user");
      return response;
    }

    if (action === "store") {
      const token = await requireToken();
      const formData = await request.formData();
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
      return redirectToStudio(request, "Store created successfully.");
    }

    if (action === "category") {
      const token = await requireToken();
      const formData = await request.formData();
      await postJson(
        "categories",
        {
          name: String(formData.get("name") ?? ""),
          slug: String(formData.get("slug") ?? ""),
        },
        token,
      );
      return redirectToStudio(request, "Category created successfully.");
    }

    if (action === "product") {
      const token = await requireToken();
      const formData = await request.formData();
      const uploadedFile = formData.get("file");
      const file = uploadedFile instanceof File && uploadedFile.size > 0 ? uploadedFile : buildDemoFile();
      const upload = await uploadFile(file, token);

      await postJson(
        "products",
        {
          category_id: String(formData.get("category_id") ?? ""),
          currency: "USD",
          description: String(formData.get("description") ?? ""),
          featured_image_url: upload.data.url,
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

      return redirectToStudio(request, "Product uploaded and published successfully.");
    }

    return redirectToStudio(request, "Unknown action.");
  } catch (error) {
    return redirectToStudio(request, error instanceof Error ? error.message : "Studio action failed.");
  }
}
