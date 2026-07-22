import { getAdminToken } from '@/src/auth/tokenStorage';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ||
  'http://localhost:3011';

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

  const useAuth = options.auth !== false;
  if (useAuth) {
    const token = await getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
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
      (typeof data?.error === 'string' ? data.error : undefined) ||
        `Erro inesperado (${resp.status}).`,
      resp.status,
    );
  }

  return data as T;
}
