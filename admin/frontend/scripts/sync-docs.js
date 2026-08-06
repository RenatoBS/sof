#!/usr/bin/env node
/**
 * Copia docs/*.md → admin/frontend/public/internal-docs/
 * e gera manifest.json (hub autenticado /docs).
 *
 * No Heroku (buildpack monorepo) só existe admin/frontend/ — sem docs/.
 * Nesse caso sai 0 e usa o public/internal-docs já commitado.
 */
const fs = require('fs');
const path = require('path');

const adminRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(adminRoot, '../..');
const srcDocs = path.join(monorepoRoot, 'docs');
const dest = path.join(adminRoot, 'public/internal-docs');

/** @type {Record<string, { group: string; order: number; summary?: string }>} */
const META = {
  README: {
    group: 'Índice',
    order: 0,
    summary: 'Entrada da pasta docs/ e pacto de documentação viva.',
  },
  features: {
    group: 'Produto',
    order: 10,
    summary: 'Features de produto e mapa de telas/APIs.',
  },
  'onboarding-cliente': {
    group: 'Produto',
    order: 20,
    summary: 'Guia do cliente: plano/cupom → WhatsApp + cadastros.',
  },
  'planos-funcoes': {
    group: 'Produto',
    order: 30,
    summary: 'Funções por plano (Solo / Equipe / Rede).',
  },
  brand: {
    group: 'Marca e bot',
    order: 40,
    summary: 'Persona verbal Sof (voz do bot e da marca).',
  },
  'bot-messages': {
    group: 'Marca e bot',
    order: 50,
    summary: 'Inventário de mensagens do bot WhatsApp.',
  },
  architecture: {
    group: 'Engenharia',
    order: 60,
    summary: 'Monorepo, Nest, Expo, dados, auth, tempo real.',
  },
  'local-development': {
    group: 'Engenharia',
    order: 70,
    summary: 'Como rodar local, seed, portas, troubleshooting.',
  },
  decisions: {
    group: 'Engenharia',
    order: 80,
    summary: 'Log vivo de decisões (ADR leve).',
  },
  deployment: {
    group: 'Ops',
    order: 90,
    summary: 'Heroku, Supabase, envs de produção, deploys.',
  },
};

const GROUP_ORDER = [
  'Índice',
  'Produto',
  'Marca e bot',
  'Engenharia',
  'Ops',
];

function firstHeading(md) {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : null;
}

function firstUsefulLine(md) {
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('---')) continue;
    if (t.startsWith('|')) continue;
    if (t.startsWith('```')) continue;
    return t.replace(/\*\*/g, '').replace(/`/g, '').slice(0, 160);
  }
  return '';
}

if (!fs.existsSync(srcDocs)) {
  console.log(
    '[sync-docs] docs/ ausente (deploy monorepo) — mantendo public/internal-docs commitado',
  );
  if (!fs.existsSync(path.join(dest, 'manifest.json'))) {
    console.error('[sync-docs] public/internal-docs também vazio — falha');
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

/** Copia mídia referenciada pelos md (ex.: demo E2E) para o painel /docs. */
const srcAssets = path.join(srcDocs, 'assets');
const destAssets = path.join(dest, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.mkdirSync(destAssets, { recursive: true });
  for (const file of fs.readdirSync(srcAssets)) {
    if (!/\.(mp4|webm|png|jpe?g|gif|webp)$/i.test(file)) continue;
    fs.copyFileSync(path.join(srcAssets, file), path.join(destAssets, file));
  }
}

const entries = [];

for (const file of fs.readdirSync(srcDocs)) {
  if (!file.endsWith('.md')) continue;
  const slug = file.replace(/\.md$/, '');
  const from = path.join(srcDocs, file);
  const to = path.join(dest, file);
  const md = fs.readFileSync(from, 'utf8');
  // No painel, assets vivem em /internal-docs/assets/
  const rewritten = md
    .replaceAll('](./assets/', '](/internal-docs/assets/')
    .replaceAll('src="./assets/', 'src="/internal-docs/assets/');
  fs.writeFileSync(to, rewritten);

  const meta = META[slug] || {
    group: 'Outros',
    order: 999,
  };
  const title =
    firstHeading(md) ||
    slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  entries.push({
    slug,
    title,
    summary: meta.summary || firstUsefulLine(md),
    group: meta.group,
    order: meta.order,
    file: `${slug}.md`,
  });
}

entries.sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(a.group);
  const gb = GROUP_ORDER.indexOf(b.group);
  const gDiff = (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
  if (gDiff !== 0) return gDiff;
  return a.order - b.order || a.title.localeCompare(b.title, 'pt-BR');
});

const manifest = {
  generatedAt: new Date().toISOString(),
  groups: GROUP_ORDER,
  docs: entries,
  clientGuides: [
    {
      title: 'Onboarding do cliente',
      href: '/guides/onboarding-cliente.html',
      summary: 'Plano/cupom → WhatsApp + cadastros (com prints).',
    },
    {
      title: 'Bot WhatsApp',
      href: '/guides/bot-whatsapp.html',
      summary: 'Como o bot agenda e o menu do profissional.',
    },
    {
      title: 'Plano Solo',
      href: '/guides/plano-solo.html',
      summary: 'Funções do plano Solo.',
    },
    {
      title: 'Plano Equipe',
      href: '/guides/plano-equipe.html',
      summary: 'Funções do plano Equipe.',
    },
    {
      title: 'Plano Rede',
      href: '/guides/plano-rede.html',
      summary: 'Funções do plano Rede.',
    },
  ],
};

fs.writeFileSync(
  path.join(dest, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  `[sync-docs] public/internal-docs atualizado (${entries.length} docs)`,
);
