import { getToken } from '@/src/auth/tokenStorage';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ||
  'http://localhost:3001';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = options.auth !== false ? await getToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  let data: { error?: string } | null = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    throw new ApiError(
      data?.error || `Erro inesperado (${resp.status}).`,
      resp.status,
    );
  }

  return data as T;
}

export function getApiBaseUrl() {
  return API_BASE;
}
