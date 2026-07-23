#!/usr/bin/env bash
# Deploy dos apps admin Sof na Heroku (API + web).
# Uso (na raiz do monorepo):
#   npm run deploy:admin
#   ./scripts/deploy-admin.sh
#   ./scripts/deploy-admin.sh --api-only
#   ./scripts/deploy-admin.sh --web-only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_ONLY=0
WEB_ONLY=0
SKIP_SYNC=0

for arg in "$@"; do
  case "$arg" in
    --api-only) API_ONLY=1 ;;
    --web-only) WEB_ONLY=1 ;;
    --skip-sync) SKIP_SYNC=1 ;;
    -h|--help)
      cat <<'EOF'
Deploy admin Sof → Heroku

  ./scripts/deploy-admin.sh              # schema sync + API + web
  ./scripts/deploy-admin.sh --api-only   # só sof-agendamento-admin-api
  ./scripts/deploy-admin.sh --web-only   # só sof-agendamento-admin-web
  ./scripts/deploy-admin.sh --skip-sync  # não roda admin:sync-schema

Requer remotes git (npm run heroku:remotes):
  heroku-admin-api, heroku-admin-web
EOF
      exit 0
      ;;
    *)
      echo "Flag desconhecida: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

if [[ "$API_ONLY" -eq 1 && "$WEB_ONLY" -eq 1 ]]; then
  echo "Use só uma: --api-only ou --web-only" >&2
  exit 1
fi

need_remote() {
  local name="$1"
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    echo "Remote git '$name' não encontrado." >&2
    echo "Rode: npm run heroku:remotes" >&2
    exit 1
  fi
}

if [[ "$WEB_ONLY" -eq 0 ]]; then need_remote heroku-admin-api; fi
if [[ "$API_ONLY" -eq 0 ]]; then need_remote heroku-admin-web; fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"
echo "==> Deploy admin a partir de $BRANCH ($SHA)"

if [[ "$SKIP_SYNC" -eq 0 && "$WEB_ONLY" -eq 0 ]]; then
  echo "==> Sincronizando schema Prisma → admin-backend/"
  npm run admin:sync-schema
fi

if [[ "$WEB_ONLY" -eq 0 ]]; then
  echo "==> Push heroku-admin-api (sof-agendamento-admin-api)"
  git push heroku-admin-api HEAD:main
fi

if [[ "$API_ONLY" -eq 0 ]]; then
  echo "==> Push heroku-admin-web (sof-agendamento-admin-web)"
  git push heroku-admin-web HEAD:main
fi

echo ""
echo "OK — admin deploy concluído."
echo "  API: https://sof-agendamento-admin-api-62c9ca1861c2.herokuapp.com"
echo "  Web: https://sof-agendamento-admin-web-234d632f6b1f.herokuapp.com"
