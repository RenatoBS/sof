export async function api(path, options = {}) {
  const resp = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const message = data?.error || `Erro inesperado (${resp.status}).`;
    throw new Error(message);
  }
  return data;
}
