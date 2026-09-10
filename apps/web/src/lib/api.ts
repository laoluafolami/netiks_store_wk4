import type { CategoryRecord, OrderRecord, ProductRecord, StoreRecord } from "@/lib/types";

const internalApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${internalApiBase}/${path}`, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export async function fetchProducts() {
  return apiFetch<{ data: ProductRecord[] }>("products");
}

export async function fetchProduct(slug: string, token?: string | null) {
  return apiFetch<{ data: ProductRecord }>(`products/${slug}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchCategories(token?: string | null) {
  return apiFetch<{ data: CategoryRecord[] }>("categories", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchStores() {
  return apiFetch<{ data: StoreRecord[] }>("stores");
}

export async function fetchMyStore(token: string) {
  return apiFetch<{ data: StoreRecord }>("vendors/me/store", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchVendorProducts(token: string) {
  return apiFetch<{ data: ProductRecord[] }>("products?mine=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchVendorOrders(token: string) {
  return apiFetch<{ data: OrderRecord[] }>("orders?mine=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function resolveMediaUrl(path: string | null) {
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `http://127.0.0.1:8004${path}`;
}
