# Deploy — Sof

Documento vivo. Atualize ao criar apps, mudar envs ou provedores.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produção / QA (Heroku + Supabase)

### Apps — produção

| App Heroku | `APP_BASE` | URL pública documentada |
|------------|------------|-------------------------|
| `sof-agendamento-api` | `saas/backend` | https://sof-agendamento-api-105cf5acdd23.herokuapp.com |
| `sof-agendamento-web` | `saas/frontend` | https://sof-agendamento-web-34fd9a1e97f3.herokuapp.com |
| `sof-agendamento-admin-api` | `admin/backend` | https://sof-agendamento-admin-api-62c9ca1861c2.herokuapp.com |
| `sof-agendamento-admin-web` | `admin/frontend` | https://painel-admin.sof.solutions (Heroku: `…-234d632f6b1f.herokuapp.com`) |

### Apps — QA (SaaS apenas)

| App Heroku | `APP_BASE` | URL |
|------------|------------|-----|
| `sof-agendamento-api-qa` | `saas/backend` | https://sof-agendamento-api-qa-8b73b9b8bd8b.herokuapp.com |
| `sof-agendamento-web-qa` | `saas/frontend` | https://qa.sof.solutions (Heroku: `…-caeea22b3c6d.herokuapp.com`) |

DNS Hostinger (web QA):

| Tipo | Host | Destino |
|------|------|---------|
| CNAME | `qa` | `tranquil-mammal-85ehpepda34n6p7y1y62v588.herokudns.com` |

Após o CNAME propagar, ACM emite o certificado (`heroku certs:auto -a sof-agendamento-web-qa`). `PUBLIC_URL` / `CORS_ORIGIN` da API QA apontam para `https://qa.sof.solutions`.

Fonte local das envs da API QA: `saas/backend/.env.qa` (não commitado; template em `.env.qa.example`). Aplicar/atualizar no Heroku:

```bash
npm run heroku:qa:config   # lê .env.qa; sobrescreve PUBLIC_URL/CORS/API_PUBLIC_URL/NODE_ENV para as URLs Heroku
npm run deploy:qa          # push API + web QA
# opcional: heroku run -a sof-agendamento-api-qa npx prisma db seed
```

Remotes: `heroku-api-qa`, `heroku-web-qa` (`npm run heroku:remotes:qa`). Banco: Supabase **staging** (não o de produção). Admin Sof **não** tem apps QA neste momento.

Painel admin compartilha o mesmo Postgres (Supabase) do produto. Migrations rodam só no release do `sof-agendamento-api` (prod) ou `sof-agendamento-api-qa` (QA). O `admin/backend` carrega uma cópia do schema em `admin/backend/prisma/schema.prisma` (sync: `npm run admin:sync-schema` após mudar o schema do produto).

Git remotes locais típicos:

- `heroku-api` / `heroku-web` → SaaS produção  
- `heroku-api-qa` / `heroku-web-qa` → SaaS QA  
- `heroku-admin-api` / `heroku-admin-web` → admin produção  

### Buildpacks (ordem)

1. `https://github.com/lstoll/heroku-buildpack-monorepo`  
2. `heroku/nodejs`  

Config: `APP_BASE=saas/backend|saas/frontend|admin/backend|admin/frontend`.

### Processos

**API** (`saas/backend/Procfile`):

```text
release: npx prisma migrate deploy
web: npm run start:prod
```

`heroku-postbuild`: `npx prisma generate && npm run build`  
`prisma` e `tsx` ficam em **dependencies** (release após prune).

**Web** (`saas/frontend/Procfile`):

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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | e-mail transacional (Gmail App Password ok para começar); vazio = e-mails ignorados |

Só Meta (`WHATSAPP_PROVIDER=meta`): `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`.

Stripe / WhatsApp: vazios = modos demo / bot off. Pareamento QR na Conta exige `WHATSAPP_BASE_URL` + (`WHATSAPP_ADMIN_TOKEN` ou `WHATSAPP_TOKEN`) e `API_PUBLIC_URL` HTTPS em prod.

Webhook Uazapi: configurado com `action: replace` (sem excluir `fromMe` — necessário para detectar resposta humana / escalonamento). Instâncias pareadas **antes** dessa mudança são ressincronizadas automaticamente quando o dono abre a aba Conta (`GET /account/whatsapp/status` reconfigura no máx. 1x/h por instância) — nenhum passo manual no deploy.

Lembretes WhatsApp: o job roda **no dyno web** (`@nestjs/schedule`, a cada 30 min + tick no boot). Não há worker separado no Procfile. Com vários dynos web, o claim SQL em `Appointment.reminderClaimedAt` evita double-send. Antecedência e fuso são por conta (`whatsappReminderMinutes`, `timezone`).

Fuso do dyno: `TZ=America/Sao_Paulo` na API (`sof-agendamento-api`) para `Date` local do Node (hoje/amanhã no bot WhatsApp) bater com o Brasil. Contas com outro `Account.timezone` ainda devem ser respeitadas no código; o `TZ` do Heroku é o default do processo, não substitui fuso por conta.

### Variáveis Web

| Var | Notas |
|-----|--------|
| `EXPO_PUBLIC_API_URL` | URL HTTPS da API |
| `NODE_ENV` | `production` |

### Variáveis Admin API (`sof-agendamento-admin-api`)

| Var | Notas |
|-----|--------|
| `APP_BASE` | `admin/backend` |
| `NODE_ENV` | `production` |
| `ADMIN_JWT_SECRET` | forte, obrigatório |
| `PUBLIC_URL` | URL do admin-web |
| `CORS_ORIGIN` | mesma URL do admin-web |
| `DATABASE_URL` / `DIRECT_URL` | mesmos do produto (Supabase) |
| `STRIPE_SECRET_KEY` | criar/alterar planos (mesmo da API produto) |
| `WHATSAPP_BASE_URL` | URL do servidor Uazapi (ops no detalhe da conta) |
| `WHATSAPP_ADMIN_TOKEN` | cria/pareia instância por conta |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | legado (instância única), opcional |
| `API_PUBLIC_URL` | URL HTTPS da **API produto** (webhook Uazapi) |
| `SEED_ADMIN_*` | só para seed no app produto |

### Variáveis Admin Web (`sof-agendamento-admin-web`)

| Var | Notas |
|-----|--------|
| `APP_BASE` | `admin/frontend` |
| `EXPO_PUBLIC_API_URL` | URL HTTPS da admin-api (antes do build) |
| `NODE_ENV` | `production` |

Guias HTML públicos (sem auth): `/guides`, `/guides/onboarding`, `/guides/bot` e estáticos `/guides/*.html` (onboarding, bot, `plano-solo|equipe|rede`) — gerados no build com `npm run sync-guides` a partir de `docs/guides/` + `docs/assets/onboarding/` (no Heroku usa o `public/guides` commitado). `serve.json` desliga `cleanUrls` para o `.html` não virar SPA.

### Deploy

Na raiz do monorepo ([`package.json`](../package.json)):

```bash
# autenticar: HEROKU_API_KEY no ambiente, ou heroku login
# (uma vez) configurar remotes
npm run heroku:remotes
npm run heroku:remotes:qa

# só API / front produto (produção)
npm run deploy:api
npm run deploy:web

# SaaS QA (envs: npm run heroku:qa:config a partir de saas/backend/.env.qa)
npm run deploy:qa

# admin (schema sync + API + web) — ver scripts/deploy-admin.sh
npm run deploy:admin
# só um lado: npm run deploy:admin -- --api-only | --web-only

# produto: api → web (sequencial)
npm run deploy

# produto: api + web em paralelo
npm run deploy:together

# os quatro
npm run deploy:all

# seed opcional (cria admin + planos + demo)
heroku run -a sof-agendamento-api npx prisma db seed
```

Equivalente manual: `git push heroku-api HEAD:main` (e remotes `heroku-web`, `heroku-admin-api`, `heroku-admin-web`).

Smoke:

```bash
curl -sS https://sof-agendamento-api-105cf5acdd23.herokuapp.com/api/health
curl -sS https://sof-agendamento-admin-api-62c9ca1861c2.herokuapp.com/api/health
# abrir webs produto e admin
```

### Auth cross-origin em produção

Front e API em hosts diferentes ⇒ front envia **Bearer**; cookie com `SameSite=None; Secure`.

### Domínio custom (Hostinger + Heroku)

Registrar na Hostinger; DNS aponta para targets `*.herokudns.com`. Apps:

| Hostname | App Heroku | Tipo DNS |
|----------|------------|----------|
| `sof.solutions` | `sof-agendamento-web` | ALIAS/ANAME (ou redirect → `www`) |
| `www.sof.solutions` | `sof-agendamento-web` | CNAME |
| `api.sof.solutions` | `sof-agendamento-api` | CNAME |
| `painel-admin.sof.solutions` | `sof-agendamento-admin-web` | CNAME |

Targets atuais: `heroku domains -a sof-agendamento-web` / `-a sof-agendamento-api` / `-a sof-agendamento-admin-web`. SSL: `heroku certs:auto` (ACM).

DNS Hostinger para o painel admin:

| Tipo | Nome | Destino |
|------|------|---------|
| CNAME | `painel-admin` | `darwinian-falls-v0ckxy5sdvju0hfc1v4udihb.herokudns.com` |

Após DNS + certificado OK, atualizar envs:

| App | Vars |
|-----|------|
| `sof-agendamento-web` | `EXPO_PUBLIC_API_URL=https://api.sof.solutions` (+ **rebuild**/redeploy) |
| `sof-agendamento-api` | `PUBLIC_URL=https://www.sof.solutions`, `CORS_ORIGIN=https://www.sof.solutions,https://sof.solutions`, `API_PUBLIC_URL=https://api.sof.solutions` |
| `sof-agendamento-admin-api` | `PUBLIC_URL=https://painel-admin.sof.solutions`, `CORS_ORIGIN=https://painel-admin.sof.solutions` (+ opcional URL Heroku legada) |

Admin API segue em `*.herokuapp.com` até ter subdomínio próprio (ex. `api-admin.sof.solutions`).

## Alternativa: Render

Arquivo: `render.yaml` — serviço Node `sof-agendamento-api`, health `/api/health`.  
Usar se o destino de deploy mudar; manter este doc sincronizado.

## Docker (apenas local)

Não é o runtime de produção atual. Ver [`local-development.md`](local-development.md).
