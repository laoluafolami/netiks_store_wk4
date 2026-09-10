const fallbackApiBaseUrl = "http://localhost:8000/api/v1";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl;
}

