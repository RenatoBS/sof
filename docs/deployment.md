# Deploy — Sof

Documento vivo. Atualize ao criar apps, mudar envs ou provedores.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produção / QA (Heroku + Supabase)

### Apps — produção

| App Heroku | `APP_BASE` | URL pública documentada |
|------------|------------|-------------------------|
| `sof-solutions-api` | `saas/backend` | https://sof-solutions-api-20faec08383c.herokuapp.com |
| `sof-solutions-web` | `saas/frontend` | https://sof-solutions-web-c45a36088329.herokuapp.com |
| `sof-solutions-admin-api` | `admin/backend` | https://sof-solutions-admin-api-28e60756b423.herokuapp.com |
| `sof-solutions-admin-web` | `admin/frontend` | https://painel-admin.sof.solutions (Heroku: `…-234d632f6b1f.herokuapp.com`) |

### Apps — QA (SaaS apenas)

| App Heroku | `APP_BASE` | URL |
|------------|------------|-----|
| `sof-solutions-api-qa` | `saas/backend` | https://qa-api.sof.solutions (Heroku: `…-1c7586e166db.herokuapp.com`) |
| `sof-solutions-web-qa` | `saas/frontend` | https://qa.sof.solutions (Heroku: `…-b047fcba11fd.herokuapp.com`) |

DNS Hostinger (QA):

| Tipo | Host | Destino |
|------|------|---------|
| CNAME | `qa` | `tranquil-mammal-85ehpepda34n6p7y1y62v588.herokudns.com` |
| CNAME | `qa-api` | `tranquil-citipati-b86m1v90bpfhw2e1n6qrjt6c.herokudns.com` |

Após os CNAMEs propagarem, ACM emite os certificados. Envs da API QA: `PUBLIC_URL`/`CORS_ORIGIN` → `https://qa.sof.solutions`; `API_PUBLIC_URL` → `https://qa-api.sof.solutions`. Web QA: `EXPO_PUBLIC_API_URL=https://qa-api.sof.solutions` (rebuild obrigatório).

Fonte local das envs da API QA: `saas/backend/.env.qa` (não commitado; template em `.env.qa.example`). Aplicar/atualizar no Heroku:

```bash
npm run heroku:qa:config   # lê .env.qa; sobrescreve PUBLIC_URL/CORS/API_PUBLIC_URL/NODE_ENV para as URLs Heroku
npm run deploy:qa          # push API + web QA
# opcional: heroku run -a sof-solutions-api-qa npx prisma db seed
```

**VM Cloud Agent:** o inverso (Heroku QA → `.env` local) roda no boot via `scripts/cloud-vm-bootstrap.sh` / `npm run cloud:import-qa-env` (allowlist Stripe/WhatsApp/OpenAI; requer secret `HEROKU_API_KEY`). Detalhe em [`local-development.md`](local-development.md#vm-cloud-agent-cursor).

Remotes: `heroku-api-qa`, `heroku-web-qa` (`npm run heroku:remotes:qa`). Banco: Supabase **staging** (não o de produção). Admin Sof **não** tem apps QA neste momento.

Painel admin compartilha o mesmo Postgres (Supabase) do produto. Migrations rodam só no release do `sof-solutions-api` (prod) ou `sof-solutions-api-qa` (QA). O `admin/backend` carrega uma cópia do schema em `admin/backend/prisma/schema.prisma` (sync: `npm run admin:sync-schema` após mudar o schema do produto).

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

Fuso do dyno: `TZ=America/Sao_Paulo` na API (`sof-solutions-api`) para `Date` local do Node (hoje/amanhã no bot WhatsApp) bater com o Brasil. Contas com outro `Account.timezone` ainda devem ser respeitadas no código; o `TZ` do Heroku é o default do processo, não substitui fuso por conta.

### Variáveis Web

| Var | Notas |
|-----|--------|
| `EXPO_PUBLIC_API_URL` | URL HTTPS da API (antes do build / `expo export`) |
| `EXPO_PUBLIC_APP_ENV` | `local` \| `qa` \| `production` — faixa de ambiente no topo (omitir ou `production` em prod; some a faixa). Rebuild obrigatório. Fallback web: hostname (`qa.sof.solutions`, `localhost`) e heurística da API URL |
| `NODE_ENV` | `production` |

QA web: `EXPO_PUBLIC_APP_ENV=qa` em `sof-solutions-web-qa` (+ redeploy/`expo export`). Prod: sem a var (ou `production`).

### Variáveis Admin API (`sof-solutions-admin-api`)

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

### Variáveis Admin Web (`sof-solutions-admin-web`)

| Var | Notas |
|-----|--------|
| `APP_BASE` | `admin/frontend` |
| `EXPO_PUBLIC_API_URL` | URL HTTPS da admin-api (antes do build) |
| `NODE_ENV` | `production` |

Guias HTML públicos (sem auth): `/guides`, `/guides/onboarding`, `/guides/bot` e estáticos `/guides/*.html` (onboarding, bot, `plano-solo|equipe|rede`) — gerados no build com `npm run sync-guides` a partir de `docs/guides/` + `docs/assets/onboarding/` (no Heroku usa o `public/guides` commitado).

Docs internos (auth): `/docs` no shell — markdown de `docs/*.md` sincronizado para `public/internal-docs/` via `npm run sync-docs` (manifest + arquivos). Build usa `npm run sync-content` (= guides + docs). No Heroku, `public/internal-docs` commitado é obrigatório. `serve.json` desliga `cleanUrls` para o `.html` não virar SPA.

### Deploy por tag (GitHub Actions) — caminho padrão

Publicar = criar uma tag. O sufixo escolhe o ambiente:

| Sufixo | Workflow | Apps publicados |
|--------|----------|-----------------|
| `-stg` (ex. `v1.4.0-stg`) | `.github/workflows/deploy-qa.yml` | `sof-solutions-api-qa`, `sof-solutions-web-qa` |
| `-prod` (ex. `v1.4.0-prod`) | `.github/workflows/deploy-prod.yml` | `sof-solutions-api`, `sof-solutions-web`, `sof-solutions-admin-api`, `sof-solutions-admin-web` |

```bash
npm run release:qa                # próxima versão derivada da última tag *-stg
npm run release:qa -- v1.4.0      # cria e envia v1.4.0-stg → deploy QA
npm run release:prod -- v1.4.0    # cria e envia v1.4.0-prod → deploy produção
```

Também dá para criar a tag na mão (`git tag -a v1.4.0-stg -m ... && git push origin v1.4.0-stg`) ou rodar o workflow manualmente em Actions → *Run workflow* (escolhendo a tag; ref que não seja tag do sufixo certo só gera aviso, tag com sufixo errado falha na validação).

Em ambos os workflows a ordem é: **validação da tag → CI → API → demais apps → resumo**. A API do produto sai primeiro porque o release phase dela roda `prisma migrate deploy`. Cada deploy faz smoke test no health/URL pública.

#### CI (`.github/workflows/ci.yml`)

Reutilizável (`workflow_call`) e também disparado em PR e push na `main`. Jobs:

| Job | O que faz | Bloqueia? |
|-----|-----------|-----------|
| `build` (matriz dos 4 apps) | `npm ci` + `npm run heroku-postbuild` (mesmo comando da Heroku) | sim |
| `build` → testes | `npm test` em `saas/backend` | sim |
| `build` → lint/typecheck | eslint (backend) / `tsc --noEmit` (demais) | **não** (informativo; base tem violações herdadas) |
| `schema-sync` | `npm run admin:sync-schema` + diff | sim |
| `content-sync` | `scripts/check-content-sync.sh` (docs/guides sincronizados em `admin/frontend/public/`) | sim |

`prisma generate` roda com `DATABASE_URL`/`DIRECT_URL` fictícias — o CI não acessa banco.

Local: `npm run check:content-sync` reproduz o job `content-sync`.

#### Configuração no GitHub

Já configurado: secret de repositório `HEROKU_API_KEY`, gerado pela autorização Heroku **"GitHub Actions deploy Sof"** (`heroku authorizations`). Rotacionar:

```bash
heroku authorizations:revoke <id>          # a antiga
heroku authorizations:create -d "GitHub Actions deploy Sof" --json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).access_token.token))" \
  | gh secret set HEROKU_API_KEY --repo RenatoBS/sof
```

Os environments (`qa`, `production`) são criados sozinhos no primeiro run que os referencia. Em `production` vale abrir Settings → Environments e exigir *required reviewers*.

Detalhes de implementação: o push usa `git push --force https://git.heroku.com/<app>.git HEAD:refs/heads/main` com credential store (token nunca aparece em log); o checkout usa `fetch-depth: 0` porque a Heroku rejeita clone shallow. Se a tag apontar para o mesmo commit já publicado, a Heroku responde "Everything up-to-date" e não cria release novo.

### Deploy manual (fallback)

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
heroku run -a sof-solutions-api npx prisma db seed
```

Equivalente manual: `git push heroku-api HEAD:main` (e remotes `heroku-web`, `heroku-admin-api`, `heroku-admin-web`).

Smoke:

```bash
curl -sS https://sof-solutions-api-20faec08383c.herokuapp.com/api/health
curl -sS https://sof-solutions-admin-api-28e60756b423.herokuapp.com/api/health
# abrir webs produto e admin
```

### Stripe: modo live vs test

| App | Chave | Modo |
|-----|-------|------|
| `sof-solutions-api` | `STRIPE_SECRET_KEY` | **live** |
| `sof-solutions-admin-api` | `STRIPE_SECRET_KEY` | **live** (era test até 2026-07-31 — criava catálogo em sandbox) |
| `sof-solutions-api-qa` / local | `STRIPE_SECRET_KEY` | test (`sk_test_`) |

As duas apps de produção precisam da **mesma** chave: o admin cria Product/Price/Payment Link e a API do produto abre a Checkout Session com aquele `stripePriceId`. Chaves em modos diferentes = `No such price` no checkout.

Webhook live: endpoint `we_1TzHT2...` → `https://api.sof.solutions/api/payments/webhook`, eventos `checkout.session.completed` e `customer.subscription.created|updated|deleted`. `STRIPE_WEBHOOK_SECRET` da API prod é o desse endpoint.

Catálogo live (conta `acct_1Tte4l…`, criado em 2026-07-31):

| Plano | Preço | Product | Price |
|-------|-------|---------|-------|
| Solo | R$ 139/mês | `prod_UzGzJcQf12d5Mn` | `price_1TzIRNCwNmtUZFHwGLD5Ukfu` |
| Equipe | R$ 199/mês | `prod_UzGzAwApsaCrGd` | `price_1TzIRwCwNmtUZFHwTEWLxpXv` |
| Rede | R$ 259/mês | `prod_UzGzdCI4ciBGDG` | `price_1TzIRxCwNmtUZFHwsnm2lXAo` |

#### Pendência: ativação da conta Stripe

A conta está com `charges_enabled: false` e capabilities `card_payments` / `boleto_payments` / `transfers` em **`pending`** (análise da Stripe; `details_submitted: true`, nada em `currently_due`). Enquanto isso:

- Payment Links **não** podem ser criados (`payment_link_no_valid_payment_methods`) — os `paymentLinkUrl` dos planos ficam vazios;
- Checkout Sessions live também são recusadas pelo mesmo motivo, ou seja, **não é possível cobrar em produção ainda**.

Assim que a Stripe liberar (conferir em Dashboard → Configurações → Métodos de pagamento, ou `charges_enabled: true` em `GET /v1/account`), gerar os links sem deploy:

```bash
# painel admin → Planos → cada plano → botão "Sincronizar Stripe"
# equivalente por API: POST /api/plans/:id/sync-stripe (admin JWT)
```

O sync reaproveita o Product/Price já existentes e só cria o Payment Link que falta.

### Auth cross-origin em produção

Front e API em hosts diferentes ⇒ front envia **Bearer**; cookie com `SameSite=None; Secure`.

### Domínio custom (Hostinger + Heroku)

Registrar na Hostinger; DNS aponta para targets `*.herokudns.com`. Apps:

| Hostname | App Heroku | Tipo DNS |
|----------|------------|----------|
| `sof.solutions` | `sof-solutions-web` | ALIAS/ANAME (ou redirect → `www`) |
| `www.sof.solutions` | `sof-solutions-web` | CNAME |
| `api.sof.solutions` | `sof-solutions-api` | CNAME |
| `painel-admin.sof.solutions` | `sof-solutions-admin-web` | CNAME |

Targets atuais: `heroku domains -a sof-solutions-web` / `-a sof-solutions-api` / `-a sof-solutions-admin-web`. SSL: `heroku certs:auto` (ACM).

DNS Hostinger para o painel admin:

| Tipo | Nome | Destino |
|------|------|---------|
| CNAME | `painel-admin` | `darwinian-falls-v0ckxy5sdvju0hfc1v4udihb.herokudns.com` |

Após DNS + certificado OK, atualizar envs:

| App | Vars |
|-----|------|
| `sof-solutions-web` | `EXPO_PUBLIC_API_URL=https://api.sof.solutions` (+ **rebuild**/redeploy) |
| `sof-solutions-api` | `PUBLIC_URL=https://www.sof.solutions`, `CORS_ORIGIN=https://www.sof.solutions,https://sof.solutions`, `API_PUBLIC_URL=https://api.sof.solutions` |
| `sof-solutions-admin-api` | `PUBLIC_URL=https://painel-admin.sof.solutions`, `CORS_ORIGIN=https://painel-admin.sof.solutions` (+ opcional URL Heroku legada) |

Admin API segue em `*.herokuapp.com` até ter subdomínio próprio (ex. `api-admin.sof.solutions`).

## Alternativa: Render

Arquivo: `render.yaml` — serviço Node `sof-solutions-api`, health `/api/health`.  
Usar se o destino de deploy mudar; manter este doc sincronizado.

## Docker (apenas local)

Não é o runtime de produção atual. Ver [`local-development.md`](local-development.md).
