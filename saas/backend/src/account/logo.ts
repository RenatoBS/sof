const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

/**
 * Aceita data URL `data:image/...;base64,...`, string vazia (remove logo) ou null.
 * Valida MIME e tamanho decodificado ≤ 5 MB.
 */
export function parseLogoBase64Input(
  value: unknown,
): { logoBase64: string } | { error: string } | { noop: true } {
  if (value === undefined) return { noop: true };
  if (value === null || value === '') {
    return { logoBase64: '' };
  }
  if (typeof value !== 'string') {
    return { error: 'Logo inválido.' };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { logoBase64: '' };
  }

  const match = trimmed.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/,
  );
  if (!match) {
    return {
      error:
        'Envie o logo como data URL base64 (ex.: data:image/png;base64,...).',
    };
  }

  const mime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ALLOWED_MIME.has(mime) && !ALLOWED_MIME.has(match[1].toLowerCase())) {
    return {
      error: 'Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF.',
    };
  }

  const b64 = match[2].replace(/\s/g, '');
  let bytes: number;
  try {
    bytes = Buffer.from(b64, 'base64').byteLength;
  } catch {
    return { error: 'Base64 do logo inválido.' };
  }
  if (!bytes) {
    return { error: 'Logo vazio.' };
  }
  if (bytes > MAX_LOGO_BYTES) {
    return { error: 'Logo deve ter no máximo 5 MB.' };
  }

  return { logoBase64: `data:${mime};base64,${b64}` };
}

export { MAX_LOGO_BYTES };
