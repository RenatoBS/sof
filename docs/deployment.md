# Deploy — Sof

Documento vivo. Atualize ao criar apps, mudar envs ou provedores.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produção / staging atual (Heroku + Supabase)

### Apps

| App Heroku | `APP_BASE` | URL pública documentada |
|------------|------------|-------------------------|
| `sof-agendamento-api` | `backend` | https://sof-agendamento-api-105cf5acdd23.herokuapp.com |
| `sof-agendamento-web` | `frontend` | https://sof-agendamento-web-34fd9a1e97f3.herokuapp.com |

Git remotes locais típicos:

- `heroku-api` → API  
- `heroku-web` → front  

### Buildpacks (ordem)

1. `https://github.com/lstoll/heroku-buildpack-monorepo`  
2. `heroku/nodejs`  

Config: `APP_BASE=backend` ou `frontend`.

### Processos

**API** (`backend/Procfile`):

```text
release: npx prisma migrate deploy
web: npm run start:prod
```

`heroku-postbuild`: `npx prisma generate && npm run build`  
`prisma` e `tsx` ficam em **dependencies** (release após prune).

**Web** (`frontend/Procfile`):

```text
web: npm run start:web
```

`heroku-postbuild`: `expo export -p web` → `serve dist`.  
`EXPO_PUBLIC_API_URL` deve existir **antes** do build (embaça na exportação estática).

### Banco: Supabase (não Heroku Postgres)

| Var | Uso |
|-----|-----|
| `DATABASE_URL` | Pooler (ex.: porta 6543, `pgbouncer=true`) |
| `DIRECT_URL` | Direto (ex.: 5432) para migrations |

Senhas com `&`, `+`, `/` **devem ser URL-encoded** nas config vars da Heroku.  
CLI Heroku pode ecoar secrets — rotacionar se vazar em logs.

### Variáveis API (mínimo)

| Var | Notas |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | forte, obrigatório |
| `PUBLIC_URL` | URL do app web |
| `CORS_ORIGIN` | mesma URL do web |
| `API_PUBLIC_URL` | URL do app API |
| `DATABASE_URL` / `DIRECT_URL` | Supabase |
| `STRIPE_SECRET_KEY` | cobranca real (preferir `rk_` / `sk_test_` em sandbox) |
| `STRIPE_WEBHOOK_SECRET` | endpoint Dashboard ou Stripe CLI |
| `WHATSAPP_PROVIDER` | `uazapi` (default) ou `meta` |
| `WHATSAPP_BASE_URL` | URL do servidor Uazapi |
| `WHATSAPP_ADMIN_TOKEN` | cria/pareia instância por conta (≠ token da instância) |
| `WHATSAPP_TOKEN` | token de instância (legado) / Meta access token |
| `OPENAI_API_KEY` | transcrição de áudio do bot (Uazapi) + NLU de frases livres (`gpt-4o-mini`) |
| `SEED_DEMO_*` | só para `prisma db seed` (não usados em runtime) |

Só Meta (`WHATSAPP_PROVIDER=meta`): `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`.

Stripe / WhatsApp: vazios = modos demo / bot off. Pareamento QR na Conta exige `WHATSAPP_BASE_URL` + (`WHATSAPP_ADMIN_TOKEN` ou `WHATSAPP_TOKEN`) e `API_PUBLIC_URL` HTTPS em prod.

Webhook Uazapi: configurado com `action: replace` (sem excluir `fromMe` — necessário para detectar resposta humana / escalonamento). Instâncias pareadas **antes** dessa mudança são ressincronizadas automaticamente quando o dono abre a aba Conta (`GET /account/whatsapp/status` reconfigura no máx. 1x/h por instância) — nenhum passo manual no deploy.

### Variáveis Web

| Var | Notas |
|-----|--------|
| `EXPO_PUBLIC_API_URL` | URL HTTPS da API |
| `NODE_ENV` | `production` |

### Deploy

Na raiz do monorepo ([`package.json`](../package.json)):

```bash
# autenticar: HEROKU_API_KEY no ambiente, ou heroku login
# (uma vez) configurar remotes
npm run heroku:remotes

# só API
npm run deploy:api

# só front
npm run deploy:web

# API + front (na ordem: api → web)
npm run deploy

# seed opcional
heroku run -a sof-agendamento-api npx prisma db seed
```

Equivalente manual: `git push heroku-api HEAD:main` e `git push heroku-web HEAD:main`.

Smoke:

```bash
curl -sS https://<api>/api/health
# abrir https://<web>/  e testar login demo
```

### Auth cross-origin em produção

Front e API em `*.herokuapp.com` diferentes ⇒ front envia **Bearer**; cookie com `SameSite=None; Secure`.

## Alternativa: Render

Arquivo: `render.yaml` — serviço Node `sof-agendamento-api`, health `/api/health`.  
Usar se o destino de deploy mudar; manter este doc sincronizado.

## Docker (apenas local)

Não é o runtime de produção atual. Ver [`local-development.md`](local-development.md).
