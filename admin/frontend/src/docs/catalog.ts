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

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].replace(/[#*`[\]]/g, '').trim();
    if (!title) continue;
    let id = slugify(title);
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    items.push({ id, title, level });
  }
  return items;
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
