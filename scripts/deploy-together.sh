#!/usr/bin/env bash
# Deploy produto Sof (API + front) na Heroku em paralelo.
# Uso (na raiz do monorepo):
#   npm run deploy:together
#   ./scripts/deploy-together.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      cat <<'EOF'
Deploy produto Sof → Heroku (API + web juntos)

  ./scripts/deploy-together.sh

Envia HEAD:main para heroku-api e heroku-web em paralelo.
Requer remotes (npm run heroku:remotes): heroku-api, heroku-web

Para deploy sequencial (api depois web): npm run deploy
EOF
      exit 0
      ;;
    *)
      echo "Flag desconhecida: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

need_remote() {
  local name="$1"
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    echo "Remote git '$name' não encontrado." >&2
    echo "Rode: npm run heroku:remotes" >&2
    exit 1
  fi
}

need_remote heroku-api
need_remote heroku-web

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"
echo "==> Deploy produto (API + web) a partir de $BRANCH ($SHA)"
echo "==> Push paralelo: heroku-api + heroku-web"

API_LOG="$(mktemp -t sof-deploy-api.XXXXXX)"
WEB_LOG="$(mktemp -t sof-deploy-web.XXXXXX)"
trap 'rm -f "$API_LOG" "$WEB_LOG"' EXIT

git push heroku-api HEAD:main >"$API_LOG" 2>&1 &
API_PID=$!
git push heroku-web HEAD:main >"$WEB_LOG" 2>&1 &
WEB_PID=$!

API_OK=0
WEB_OK=0
wait "$API_PID" && API_OK=1 || API_OK=0
wait "$WEB_PID" && WEB_OK=1 || WEB_OK=0

echo ""
echo "── heroku-api ──"
cat "$API_LOG"
echo ""
echo "── heroku-web ──"
cat "$WEB_LOG"
echo ""

if [[ "$API_OK" -eq 1 && "$WEB_OK" -eq 1 ]]; then
  echo "OK — API e front publicados juntos."
  echo "  API: https://sof-agendamento-api-105cf5acdd23.herokuapp.com"
  echo "  Web: https://sof-agendamento-web-34fd9a1e97f3.herokuapp.com"
  exit 0
fi

[[ "$API_OK" -eq 0 ]] && echo "FALHA: heroku-api" >&2
[[ "$WEB_OK" -eq 0 ]] && echo "FALHA: heroku-web" >&2
exit 1
