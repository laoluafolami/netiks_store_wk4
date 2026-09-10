import { cookies } from "next/headers";

import type { AuthUser } from "@/lib/types";

export async function getViewer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("netiks_access_token")?.value ?? null;
  const refreshToken = cookieStore.get("netiks_refresh_token")?.value ?? null;
  const rawUser = cookieStore.get("netiks_user")?.value ?? null;
  const user = rawUser ? (JSON.parse(rawUser) as AuthUser) : null;

  return {
    refreshToken,
    token,
    user,
  };
}
