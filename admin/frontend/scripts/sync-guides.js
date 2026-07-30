#!/usr/bin/env node
/**
 * Copia docs/guides + prints para admin/frontend/public/guides
 * (rotas públicas estáticas no admin web).
 *
 * No Heroku (buildpack monorepo) só existe admin/frontend/ — sem docs/.
 * Nesse caso sai 0 e usa o public/guides já commitado.
 */
const fs = require('fs');
const path = require('path');

const adminRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(adminRoot, '../..');
const srcGuides = path.join(monorepoRoot, 'docs/guides');
const srcAssets = path.join(monorepoRoot, 'docs/assets/onboarding');
const dest = path.join(adminRoot, 'public/guides');
const destAssets = path.join(dest, 'assets');

if (!fs.existsSync(srcGuides) || !fs.existsSync(srcAssets)) {
  console.log(
    '[sync-guides] docs/ ausente (deploy monorepo) — mantendo public/guides commitado',
  );
  if (!fs.existsSync(path.join(dest, 'onboarding-cliente.html'))) {
    console.error('[sync-guides] public/guides também vazio — falha');
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(destAssets, { recursive: true });

function copyFile(from, to) {
  fs.copyFileSync(from, to);
}

for (const file of fs.readdirSync(srcAssets)) {
  if (file.endsWith('.png')) {
    copyFile(path.join(srcAssets, file), path.join(destAssets, file));
  }
}

copyFile(
  path.join(srcGuides, 'sof-guides.css'),
  path.join(dest, 'sof-guides.css'),
);

for (const name of [
  'onboarding-cliente.html',
  'bot-whatsapp.html',
  'plano-solo.html',
  'plano-equipe.html',
  'plano-rede.html',
]) {
  let html = fs.readFileSync(path.join(srcGuides, name), 'utf8');
  html = html.replaceAll('../assets/onboarding/', 'assets/');
  html = html.replace(
    /Abra este arquivo a partir de\s*<code>docs\/guides\/<\/code> para as imagens carregarem\./,
    'Rota pública do admin Sof · compartilhe este link com o cliente.',
  );
  html = html.replace(
    'Material para o cliente final — sem jargão de API.',
    'Rota pública do admin Sof · compartilhe este link com o cliente.',
  );
  fs.writeFileSync(path.join(dest, name), html);
}

console.log('[sync-guides] public/guides atualizado');
