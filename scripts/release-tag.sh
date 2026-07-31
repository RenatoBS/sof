#!/usr/bin/env bash
# Cria e envia a tag de release que dispara o GitHub Actions.
#   -stg  → workflow "Deploy QA"        (SaaS API + web QA)
#   -prod → workflow "Deploy Produção"  (produto + admin)
#
# Uso:
#   npm run release:qa                # deriva a próxima versão da última tag *-stg
#   npm run release:qa -- v1.4.0      # tag explícita → v1.4.0-stg
#   npm run release:prod -- v1.4.0    # tag explícita → v1.4.0-prod
#   ./scripts/release-tag.sh stg v1.4.0

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SUFFIX="${1:-}"
VERSION="${2:-}"

case "$SUFFIX" in
  stg|prod) ;;
  *)
    echo "Uso: ./scripts/release-tag.sh <stg|prod> [vX.Y.Z]" >&2
    exit 1
    ;;
esac

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Árvore de trabalho suja — commite ou guarde as mudanças antes de taguear." >&2
  exit 1
fi

git fetch --tags --quiet origin

if [[ -z "$VERSION" ]]; then
  LAST="$(git tag --list "v*-${SUFFIX}" --sort=-v:refname | head -n1)"
  if [[ -z "$LAST" ]]; then
    VERSION="v0.1.0"
  else
    BASE="${LAST%-${SUFFIX}}"
    IFS='.' read -r MAJOR MINOR PATCH <<<"${BASE#v}"
    VERSION="v${MAJOR}.${MINOR}.$((PATCH + 1))"
  fi
  echo "==> Versão derivada de '${LAST:-nenhuma tag anterior}': $VERSION"
fi

[[ "$VERSION" == v* ]] || VERSION="v${VERSION}"
TAG="${VERSION}-${SUFFIX}"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag $TAG já existe. Escolha outra versão." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"

if [[ "$SUFFIX" == "prod" && "$BRANCH" != "main" ]]; then
  echo "Aviso: tag de produção a partir de '$BRANCH' (esperado: main)."
  read -r -p "Continuar? [y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

echo "==> Criando $TAG em $BRANCH ($SHA)"
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

REPO_URL="$(git remote get-url origin | sed -E 's#(git@|https://)github.com[:/]#https://github.com/#; s#\.git$##')"
echo ""
echo "OK — tag $TAG enviada."
echo "  Acompanhe: ${REPO_URL}/actions"
