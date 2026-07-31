#!/usr/bin/env bash
# Verifica se admin/frontend/public/ (internal-docs + guides) reflete docs/.
# O Heroku builda só o subdiretório admin/frontend, sem docs/ — por isso o
# conteúdo sincronizado precisa estar commitado.
#
# Uso: bash scripts/check-content-sync.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="admin/frontend/public"

echo "==> Rodando sync-content em admin/frontend"
npm run --prefix admin/frontend --silent sync-content >/dev/null

# manifest.json carrega um timestamp de geração; ignorar essa linha.
DIFF="$(git diff -U0 -- "$TARGET" \
  | grep -E '^[+-]' \
  | grep -vE '^(\+\+\+|---)' \
  | grep -v '"generatedAt"' || true)"

UNTRACKED="$(git ls-files --others --exclude-standard -- "$TARGET")"

if [[ -n "$DIFF" || -n "$UNTRACKED" ]]; then
  echo "::error::Conteúdo em $TARGET desatualizado. Rode 'npm run sync-docs' (ou sync-content) em admin/frontend e commite."
  [[ -n "$UNTRACKED" ]] && { echo "Arquivos não commitados:"; echo "$UNTRACKED"; }
  git --no-pager diff --stat -- "$TARGET" || true
  exit 1
fi

# Restaura o timestamp para não sujar a árvore de trabalho local.
git checkout -- "$TARGET" 2>/dev/null || true

echo "OK — docs e guides sincronizados."
