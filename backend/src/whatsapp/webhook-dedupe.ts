/**
 * Deduplica webhooks Uazapi (costuma chegar em pares no mesmo ms).
 * Em memória — suficiente com 1 dyno Heroku.
 */
const seen = new Map<string, number>();
const TTL_MS = 60_000;
const MAX_ENTRIES = 2_000;

function prune(now: number) {
  for (const [key, at] of seen) {
    if (now - at > TTL_MS) seen.delete(key);
  }
  if (seen.size > MAX_ENTRIES) {
    const oldest = [...seen.entries()].sort((a, b) => a[1] - b[1]);
    for (const [key] of oldest.slice(0, seen.size - MAX_ENTRIES)) {
      seen.delete(key);
    }
  }
}

/** @returns true se já processamos essa chave recentemente */
export function isDuplicateWebhook(key: string): boolean {
  if (!key) return false;
  const now = Date.now();
  prune(now);
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

export function webhookDedupeKey(parts: {
  messageId?: string;
  token?: string;
  phone?: string;
  text?: string;
  event?: string;
}): string {
  if (parts.messageId) {
    return `id:${parts.messageId}`;
  }
  // Fallback sem id: janela de ~2s pelo floor do timestamp
  const bucket = Math.floor(Date.now() / 2000);
  return `fp:${parts.token || ''}|${parts.phone || ''}|${parts.text || ''}|${parts.event || ''}|${bucket}`;
}
