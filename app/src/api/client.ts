import { ENV } from '@/config/env';

let authToken: string | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
  }
}

export async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(ENV.apiBase + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let err: { code?: string; message?: string } | undefined;
    try {
      err = await res.json();
    } catch {
      /* no body */
    }
    throw new ApiError(res.status, err?.code, err?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
