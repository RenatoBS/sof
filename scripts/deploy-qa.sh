#!/usr/bin/env bash
# Deploy SaaS QA (API + web) na Heroku.
# Uso: npm run deploy:qa

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need_remote() {
  local name="$1"
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    echo "Remote git '$name' nao encontrado." >&2
    echo "Rode: npm run heroku:remotes:qa" >&2
    exit 1
  fi
}

need_remote heroku-api-qa
need_remote heroku-web-qa

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"
echo "==> Deploy SaaS QA a partir de $BRANCH ($SHA)"

echo "==> Push heroku-api-qa"
git push heroku-api-qa HEAD:main

echo "==> Push heroku-web-qa"
git push heroku-web-qa HEAD:main

API_URL="$(heroku apps:info -a sof-solutions-api-qa -s | sed -n 's/^web_url=//p' | sed 's:/*$::')"
WEB_URL="$(heroku apps:info -a sof-solutions-web-qa -s | sed -n 's/^web_url=//p' | sed 's:/*$::')"

echo ""
echo "OK — SaaS QA publicado."
echo "  API: $API_URL"
echo "  Web: $WEB_URL"
echo "  Health: $API_URL/api/health"
