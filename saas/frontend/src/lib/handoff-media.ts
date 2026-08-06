import { fileToImageDataUrl } from '@/src/lib/logo';

export type HandoffMediaKind = 'image' | 'video' | 'audio' | 'document';

export type HandoffMediaAttachment = {
  kind: HandoffMediaKind;
  dataUrl: string;
  name: string;
};

const LIMITS: Record<HandoffMediaKind, number> = {
  image: 2 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 5 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

function kindFromMime(mime: string): HandoffMediaKind | null {
  const m = mime.toLowerCase();
  if (/^image\/(jpeg|jpg|png|webp)$/.test(m)) return 'image';
  if (/^video\/(mp4|webm)$/.test(m)) return 'video';
  if (/^audio\/(mpeg|mp3|ogg|mp4|aac|webm|wav)$/.test(m)) return 'audio';
  if (m === 'application/pdf') return 'document';
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteLength(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4);
}

export async function fileToHandoffMedia(
  file: File,
): Promise<HandoffMediaAttachment> {
  const kind = kindFromMime(file.type);
  if (!kind) {
    throw new Error('Tipo não suportado. Use imagem, vídeo, áudio ou PDF.');
  }

  let dataUrl: string;
  if (kind === 'image') {
    dataUrl = await fileToImageDataUrl(file);
  } else {
    if (file.size > LIMITS[kind]) {
      throw new Error(
        `Arquivo muito grande (máx. ${Math.round(LIMITS[kind] / (1024 * 1024))} MB).`,
      );
    }
    dataUrl = await readFileAsDataUrl(file);
  }

  if (dataUrlByteLength(dataUrl) > LIMITS[kind]) {
    throw new Error(
      `Arquivo muito grande (máx. ${Math.round(LIMITS[kind] / (1024 * 1024))} MB).`,
    );
  }

  return {
    kind,
    dataUrl,
    name: file.name || defaultName(kind),
  };
}

function defaultName(kind: HandoffMediaKind): string {
  if (kind === 'image') return 'imagem.jpg';
  if (kind === 'video') return 'video.mp4';
  if (kind === 'audio') return 'audio.mp3';
  return 'documento.pdf';
}

export function mediaKindLabel(kind?: string | null): string {
  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Vídeo]';
  if (kind === 'audio') return '[Áudio]';
  if (kind === 'document') return '[PDF]';
  return '';
}
