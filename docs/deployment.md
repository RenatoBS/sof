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
| `SEED_DEMO_*` | opcional para demo |

MP / WhatsApp: vazios = modos demo / bot off.

### Variáveis Web

| Var | Notas |
|-----|--------|
| `EXPO_PUBLIC_API_URL` | URL HTTPS da API |
| `NODE_ENV` | `production` |

### Deploy

```bash
# autenticar: HEROKU_API_KEY no ambiente, ou heroku login
git push heroku-api HEAD:main
git push heroku-web HEAD:main

heroku run -a sof-agendamento-api npx prisma db seed   # se necessário
```

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
