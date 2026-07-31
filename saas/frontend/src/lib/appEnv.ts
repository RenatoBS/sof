export type AppEnv = 'production' | 'qa' | 'local';

function normalizeExplicit(raw: string): AppEnv | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === 'qa' || v === 'staging' || v === 'stage' || v === 'test') return 'qa';
  if (v === 'local' || v === 'development' || v === 'dev') return 'local';
  if (v === 'production' || v === 'prod') return 'production';
  return null;
}

function fromHostname(hostname: string): AppEnv | null {
  const h = hostname.trim().toLowerCase();
  if (!h) return null;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) {
    return 'local';
  }
  if (
    h === 'qa.sof.solutions' ||
    h.startsWith('qa.') ||
    h.includes('-qa.') ||
    h.includes('-qa-')
  ) {
    return 'qa';
  }
  if (h === 'sof.solutions' || h === 'www.sof.solutions') {
    return 'production';
  }
  return null;
}

function fromApiUrl(apiUrl: string): AppEnv | null {
  const api = apiUrl.trim().toLowerCase();
  if (!api) return null;
  if (api.includes('localhost') || api.includes('127.0.0.1')) return 'local';
  if (api.includes('qa-api') || api.includes('-qa.') || api.includes('-qa-')) {
    return 'qa';
  }
  if (api.includes('api.sof.solutions')) return 'production';
  return null;
}

/** Resolve ambiente da UI (prod esconde a faixa). */
export function resolveAppEnv(): AppEnv {
  const explicit = normalizeExplicit(process.env.EXPO_PUBLIC_APP_ENV || '');
  if (explicit) return explicit;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const fromHost = fromHostname(window.location.hostname);
    if (fromHost) return fromHost;
  }

  const fromApi = fromApiUrl(process.env.EXPO_PUBLIC_API_URL || '');
  if (fromApi) return fromApi;

  return 'production';
}

export function envStripCopy(env: AppEnv): { label: string; detail: string } | null {
  if (env === 'qa') {
    return { label: 'Ambiente de teste', detail: 'QA' };
  }
  if (env === 'local') {
    return { label: 'Ambiente local', detail: 'desenvolvimento' };
  }
  return null;
}
