#!/usr/bin/env bash
# Aplica saas/backend/.env.qa no Heroku API QA e define URLs do par web/api.
# Nao imprime valores de secrets.
# Uso: ./scripts/heroku-set-qa-config.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/saas/backend/.env.qa}"
API_APP="${HEROKU_QA_API_APP:-sof-solutions-api-qa}"
WEB_APP="${HEROKU_QA_WEB_APP:-sof-solutions-web-qa}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo nao encontrado: $ENV_FILE" >&2
  exit 1
fi

API_URL="$(heroku apps:info -a "$API_APP" -s 2>/dev/null | sed -n 's/^web_url=//p' | sed 's:/*$::')"
WEB_URL="$(heroku apps:info -a "$WEB_APP" -s 2>/dev/null | sed -n 's/^web_url=//p' | sed 's:/*$::')"

# Prefer custom domain qa.sof.solutions when attached to the web app
if heroku domains -a "$WEB_APP" 2>/dev/null | grep -q 'qa.sof.solutions'; then
  WEB_URL="https://qa.sof.solutions"
fi

if [[ -z "$API_URL" || -z "$WEB_URL" ]]; then
  echo "Nao foi possivel obter web_url dos apps $API_APP / $WEB_APP" >&2
  exit 1
fi

echo "==> API QA: $API_URL"
echo "==> Web QA: $WEB_URL"
echo "==> Lendo keys de $ENV_FILE (valores nao sao impressos)"

ARGS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="$(echo "$key" | xargs)"
  case "$key" in
    PORT|PUBLIC_URL|CORS_ORIGIN|NODE_ENV|API_PUBLIC_URL) continue ;;
  esac
  if [[ "$val" =~ ^\".*\"$ ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "$val" =~ ^\'.*\'$ ]]; then
    val="${val:1:${#val}-2}"
  fi
  ARGS+=("${key}=${val}")
done < "$ENV_FILE"

ARGS+=(
  "NODE_ENV=production"
  "PUBLIC_URL=${WEB_URL}"
  "CORS_ORIGIN=${WEB_URL}"
  "API_PUBLIC_URL=${API_URL}"
  "TZ=America/Sao_Paulo"
  "APP_BASE=saas/backend"
)

echo "==> Configurando ${API_APP} (${#ARGS[@]} vars)..."
heroku config:set "${ARGS[@]}" -a "$API_APP" >/dev/null

echo "==> Configurando ${WEB_APP}..."
heroku config:set \
  "APP_BASE=saas/frontend" \
  "NODE_ENV=production" \
  "EXPO_PUBLIC_API_URL=${API_URL}" \
  -a "$WEB_APP" >/dev/null

echo "OK — envs QA aplicadas (sem listar secrets)."
echo "  API: $API_URL"
echo "  Web: $WEB_URL"
