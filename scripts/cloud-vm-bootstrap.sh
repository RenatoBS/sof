#!/usr/bin/env bash
# Bootstrap da VM cloud Sof:
#   1) Garante ngrok instalado + authtoken (NGROK_AUTHTOKEN ou config local)
#   2) Importa secrets de QA (Heroku sof-solutions-api-qa) para saas/backend/.env
#
# Uso:
#   bash scripts/cloud-vm-bootstrap.sh              # install (idempotente)
#   bash scripts/cloud-vm-bootstrap.sh --ngrok-tunnel   # sobe túnel (bloqueante)
#
# Requisitos (Cursor Secrets / env):
#   HEROKU_API_KEY     — Platform API (obrigatório para import)
#   NGROK_AUTHTOKEN    — opcional se ~/.config/ngrok/ngrok.yml já tiver token
#
# Não imprime valores de secrets.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ENV="${SOF_BACKEND_ENV:-$ROOT/saas/backend/.env}"
BACKEND_ENV_EXAMPLE="$ROOT/saas/backend/.env.example"
HEROKU_QA_API_APP="${HEROKU_QA_API_APP:-sof-solutions-api-qa}"
NGROK_PORT="${NGROK_PORT:-9080}"
NGROK_URL_FILE="${NGROK_URL_FILE:-/tmp/sof-ngrok-url.txt}"

# Keys puxadas do Heroku QA → .env local (allowlist).
QA_IMPORT_KEYS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  WHATSAPP_PROVIDER
  WHATSAPP_BASE_URL
  WHATSAPP_ADMIN_TOKEN
  WHATSAPP_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  OPENAI_API_KEY
)

log() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

ensure_backend_env_file() {
  if [[ ! -f "$BACKEND_ENV" ]]; then
    if [[ -f "$BACKEND_ENV_EXAMPLE" ]]; then
      cp "$BACKEND_ENV_EXAMPLE" "$BACKEND_ENV"
      log "==> Criado $BACKEND_ENV a partir de .env.example"
    else
      touch "$BACKEND_ENV"
      log "==> Criado $BACKEND_ENV vazio"
    fi
  fi
}

ensure_ngrok_installed() {
  if command -v ngrok >/dev/null 2>&1; then
    log "==> ngrok já instalado: $(command -v ngrok) ($(ngrok version 2>/dev/null | head -1))"
    return 0
  fi
  log "==> Instalando ngrok…"
  if ! command -v curl >/dev/null 2>&1; then
    die "curl necessário para instalar ngrok"
  fi
  curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
    | sudo tee /etc/apt/sources.list.d/ngrok.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ngrok
  command -v ngrok >/dev/null 2>&1 || die "falha ao instalar ngrok"
  log "==> ngrok instalado: $(ngrok version 2>/dev/null | head -1)"
}

ensure_ngrok_authtoken() {
  local cfg="${HOME}/.config/ngrok/ngrok.yml"
  if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
    ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
    log "==> ngrok authtoken configurado via NGROK_AUTHTOKEN"
    return 0
  fi
  if [[ -f "$cfg" ]] && grep -q 'authtoken:' "$cfg"; then
    log "==> ngrok authtoken já presente em $cfg"
    return 0
  fi
  warn "NGROK_AUTHTOKEN ausente e sem config local — adicione o secret no dashboard Cursor Cloud"
  return 1
}

import_qa_envs_from_heroku() {
  if [[ -z "${HEROKU_API_KEY:-}" ]]; then
    warn "HEROKU_API_KEY ausente — pulando import de envs QA"
    return 1
  fi

  log "==> Buscando config-vars de $HEROKU_QA_API_APP (sem listar valores)…"
  local tmp json
  tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" RETURN

  local http
  http="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -H "Accept: application/vnd.heroku+json; version=3" \
    -H "Authorization: Bearer ${HEROKU_API_KEY}" \
    "https://api.heroku.com/apps/${HEROKU_QA_API_APP}/config-vars")"

  if [[ "$http" != "200" ]]; then
    warn "Heroku config-vars HTTP $http — import abortado"
    return 1
  fi

  ensure_backend_env_file

  python3 - "$tmp" "$BACKEND_ENV" "${QA_IMPORT_KEYS[@]}" <<'PY'
import json, sys
from pathlib import Path

src = Path(sys.argv[1])
env_path = Path(sys.argv[2])
keys = sys.argv[3:]

data = json.loads(src.read_text())
if not isinstance(data, dict):
    raise SystemExit("resposta Heroku inválida")

existing_lines = env_path.read_text().splitlines() if env_path.exists() else []
# Map key -> line index for upsert
index = {}
for i, line in enumerate(existing_lines):
    raw = line.strip()
    if not raw or raw.startswith("#") or "=" not in line:
        continue
    k = line.split("=", 1)[0].strip()
    index[k] = i

updated = []
missing = []
for key in keys:
    if key not in data or data[key] is None:
        missing.append(key)
        continue
    val = data[key]
    # Heroku may return non-str
    if not isinstance(val, str):
        val = str(val)
    line = f"{key}={val}"
    if key in index:
        existing_lines[index[key]] = line
    else:
        existing_lines.append(line)
    updated.append(key)

env_path.write_text("\n".join(existing_lines).rstrip() + "\n")
print(f"==> .env atualizado: {len(updated)} keys ({', '.join(updated) or 'nenhuma'})")
if missing:
    print(f"==> ausentes no Heroku QA (não alteradas): {', '.join(missing)}")
PY
}

start_ngrok_tunnel() {
  ensure_ngrok_installed
  ensure_ngrok_authtoken || die "não é possível subir túnel sem authtoken"

  log "==> Iniciando ngrok http ${NGROK_PORT} (log → stdout)"
  # Watcher em background grava a URL pública sem imprimir o resto do JSON sensível.
  (
    for _ in $(seq 1 60); do
      url="$(curl -sS http://127.0.0.1:4040/api/tunnels 2>/dev/null \
        | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  ts=d.get("tunnels") or []
  print(ts[0]["public_url"] if ts else "")
except Exception:
  print("")' 2>/dev/null || true)"
      if [[ -n "$url" ]]; then
        printf '%s\n' "$url" >"$NGROK_URL_FILE"
        log "==> ngrok público: $url (também em $NGROK_URL_FILE)"
        break
      fi
      sleep 1
    done
  ) &

  exec ngrok http "$NGROK_PORT" --log=stdout
}

main() {
  local mode="${1:-}"
  case "$mode" in
    --ngrok-tunnel)
      start_ngrok_tunnel
      ;;
    ""|--install)
      log "==> cloud-vm-bootstrap (install)"
      ensure_backend_env_file
      ensure_ngrok_installed
      ensure_ngrok_authtoken || true
      import_qa_envs_from_heroku || true
      log "==> bootstrap concluído"
      ;;
    --import-only)
      ensure_backend_env_file
      import_qa_envs_from_heroku
      ;;
    --help|-h)
      sed -n '2,20p' "$0"
      ;;
    *)
      die "uso: $0 [--install|--import-only|--ngrok-tunnel]"
      ;;
  esac
}

main "${1:-}"
