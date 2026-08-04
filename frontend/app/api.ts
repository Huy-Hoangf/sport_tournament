const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

const fallbackApiBaseUrl =
  process.env.NODE_ENV === "production" ? "" : "http://localhost:3001";

export const API_BASE_URL = configuredApiBaseUrl || fallbackApiBaseUrl;

if (!API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is required in production. Set it to the deployed backend URL.",
  );
}

export type CurrentUser = {
  id: number;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "PLAYER";
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed: ${response.status}`);
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
