const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;
export function setAuthToken(t: string | null) { authToken = t; }

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}

export function mediaUrl(imageUrl?: string | null): string | null {
  return imageUrl ? `${BASE}${imageUrl}` : null;
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}, timeoutMs = 60000): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...opts, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const j = await res.json();
      // FastAPI detail may be a string or a structured object (e.g. suspension).
      if (j.detail && typeof j.detail === "object") {
        code = j.detail.code;
        detail = j.detail.message || j.detail.reason || detail;
      } else if (j.detail) {
        detail = j.detail;
      }
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { BASE };
