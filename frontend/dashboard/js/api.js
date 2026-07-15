const API_BASE =
  (typeof window !== 'undefined' && window.__SOFT_API__) ||
  'http://localhost:3001';

export async function api(path, options = {}) {
  const resp = await fetch(`${API_BASE}/api${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const message = data?.error || `Erro inesperado (${resp.status}).`;
    const error = new Error(message);
    error.status = resp.status;
    throw error;
  }
  return data;
}
