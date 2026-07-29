/** Tamanho máximo do logo decodificado (bytes). */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function dataUrlByteLength(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  // approx: 3/4 of base64 length
  return Math.floor((b64.length * 3) / 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Converte um File de imagem em data URL ≤ 5 MB.
 * Redimensiona (máx. 1024px) e reduz qualidade JPEG até caber.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (PNG, JPEG, WebP ou GIF).');
  }
  if (!ALLOWED_TYPES.has(file.type) && file.type !== 'image/jpg') {
    throw new Error('Formato não suportado. Use PNG, JPEG, WebP ou GIF.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const maxSide = 1024;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error('Imagem inválida.');
    }
    const scale = Math.min(1, maxSide / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível neste navegador.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Se o original já é pequeno e PNG/WebP com transparência, tenta manter
    if (file.size <= MAX_LOGO_BYTES && scale === 1) {
      const reader = new FileReader();
      const original = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      if (original.startsWith('data:image/') && dataUrlByteLength(original) <= MAX_LOGO_BYTES) {
        return original;
      }
    }

    let quality = 0.92;
    let dataUrl = canvasToJpegDataUrl(canvas, quality);
    while (dataUrlByteLength(dataUrl) > MAX_LOGO_BYTES && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvasToJpegDataUrl(canvas, quality);
    }

    // Ainda grande: reduzir dimensões
    let w = width;
    let h = height;
    while (dataUrlByteLength(dataUrl) > MAX_LOGO_BYTES && Math.max(w, h) > 128) {
      w = Math.max(64, Math.round(w * 0.75));
      h = Math.max(64, Math.round(h * 0.75));
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      quality = 0.85;
      dataUrl = canvasToJpegDataUrl(canvas, quality);
      while (dataUrlByteLength(dataUrl) > MAX_LOGO_BYTES && quality > 0.35) {
        quality -= 0.1;
        dataUrl = canvasToJpegDataUrl(canvas, quality);
      }
    }

    if (dataUrlByteLength(dataUrl) > MAX_LOGO_BYTES) {
      throw new Error(
        'Não foi possível reduzir o logo para 5 MB. Tente outra imagem.',
      );
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
