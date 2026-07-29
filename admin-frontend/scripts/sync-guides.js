#!/usr/bin/env node
/**
 * Copia docs/guides + prints para admin-frontend/public/guides
 * (rotas públicas estáticas no admin web).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const srcGuides = path.join(root, 'docs/guides');
const srcAssets = path.join(root, 'docs/assets/onboarding');
const dest = path.join(root, 'admin-frontend/public/guides');
const destAssets = path.join(dest, 'assets');

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

for (const name of ['onboarding-cliente.html', 'bot-whatsapp.html']) {
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
