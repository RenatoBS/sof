export type DocEntry = {
  slug: string;
  title: string;
  summary: string;
  group: string;
  order: number;
  file: string;
};

export type ClientGuide = {
  title: string;
  href: string;
  summary: string;
};

export type DocsManifest = {
  generatedAt: string;
  groups: string[];
  docs: DocEntry[];
  clientGuides: ClientGuide[];
};

const MANIFEST_URL = '/internal-docs/manifest.json';

export function docMarkdownUrl(slug: string) {
  return `/internal-docs/${encodeURIComponent(slug)}.md`;
}

export async function fetchDocsManifest(): Promise<DocsManifest> {
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar o manifesto (${res.status}).`);
  }
  return (await res.json()) as DocsManifest;
}

export async function fetchDocMarkdown(slug: string): Promise<string> {
  const res = await fetch(docMarkdownUrl(slug), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Documento não encontrado (${slug}).`);
  }
  return res.text();
}

export type TocItem = { id: string; title: string; level: number };

/** `[label](url)` → `label`; tira marcadores inline para o título casar com o texto exibido. */
function inlineText(raw: string) {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_[\]]/g, '')
    .replace(/\s*#+\s*$/, '')
    .trim();
}

/**
 * Fonte única dos âncoras: a mesma lista numera o índice e nomeia os headings
 * renderizados (por ordem de aparição), então clicar sempre cai no destino certo.
 */
export function extractHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  /** `#` dentro de bloco de código não vira heading — contá-lo desalinha o índice inteiro. */
  let fence: string | null = null;
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const fenceMatch = /^(```|~~~)/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fence === fenceMatch[1]) fence = null;
      continue;
    }
    if (fence) continue;
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const title = inlineText(m[2]);
    if (!title) continue;
    let id = slugify(title);
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    items.push({ id, title, level: m[1].length });
  }
  return items;
}

/** Índice lateral: só H2/H3 (o H1 já vira título da página). */
export function extractToc(markdown: string): TocItem[] {
  return extractHeadings(markdown).filter((h) => h.level >= 2);
}

/** Markdown como o leitor realmente renderiza — base comum do índice e dos âncoras. */
export function docBody(markdown: string) {
  return rewriteDocLinks(stripLeadingH1(markdown));
}

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Remove o H1 inicial — o título já aparece no PageHeader do painel. */
export function stripLeadingH1(markdown: string) {
  return markdown.replace(/^#[^#\n][^\n]*\n+/, '');
}

/**
 * Reescreve links relativos de docs/ para rotas do painel.
 * - `foo.md` / `./foo.md` / `../AGENTS.md` → /docs/foo (AGENTS fica como texto)
 * - `guides/x.html` → /guides/x.html
 */
export function rewriteDocLinks(markdown: string): string {
  return markdown.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (full, label: string, href: string) => {
      const h = href.trim();
      if (/^https?:\/\//i.test(h) || h.startsWith('#') || h.startsWith('mailto:')) {
        return full;
      }
      if (h.includes('guides/') && h.endsWith('.html')) {
        const name = h.split('/').pop() || h;
        return `[${label}](/guides/${name})`;
      }
      const mdMatch = /(?:^|\/)([\w.-]+)\.md(?:#(.+))?$/.exec(h);
      if (mdMatch) {
        const slug = mdMatch[1];
        if (slug === 'AGENTS') return label;
        const hash = mdMatch[2] ? `#${mdMatch[2]}` : '';
        return `[${label}](/docs/${slug}${hash})`;
      }
      return full;
    },
  );
}
