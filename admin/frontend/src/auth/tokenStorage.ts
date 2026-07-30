const KEY = 'sof_admin_token';

export async function getAdminToken(): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export async function setAdminToken(token: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, token);
}

export async function clearAdminToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
