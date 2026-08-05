import { parseLogoBase64Input } from '../account/logo';

export const MAX_PRODUCT_IMAGES = 5;

/**
 * Valida array de data URLs (mesmo padrão do logo). Máx. 5 imagens.
 */
export function parseProductImagesInput(
  value: unknown,
): { images: string[] } | { error: string } {
  if (value === undefined || value === null) {
    return { images: [] };
  }
  if (!Array.isArray(value)) {
    return { error: 'Imagens devem ser uma lista.' };
  }
  if (value.length > MAX_PRODUCT_IMAGES) {
    return {
      error: `No máximo ${MAX_PRODUCT_IMAGES} imagens por produto.`,
    };
  }
  const images: string[] = [];
  for (const item of value) {
    const parsed = parseLogoBase64Input(item);
    if ('error' in parsed) {
      return { error: parsed.error.replace(/[Ll]ogo/g, 'Imagem') };
    }
    if ('noop' in parsed) continue;
    if (parsed.logoBase64) images.push(parsed.logoBase64);
  }
  return { images };
}

export function normalizeProductImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}
