# Sof — agendamento pelo WhatsApp

Site institucional + checkout + dashboard em **Expo (Web, iOS, Android)** com API **NestJS + Prisma + PostgreSQL**.

## Documentação (obrigatória / viva)

Para agentes de IA e visão completa do projeto, comece por:

**→ [`AGENTS.md`](AGENTS.md)** (documento central — deve crescer com cada mudança)

| Doc | Conteúdo |
|-----|----------|
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura |
| [`docs/features.md`](docs/features.md) | Features |
| [`docs/local-development.md`](docs/local-development.md) | Dev local |
| [`docs/deployment.md`](docs/deployment.md) | Deploy |
| [`docs/decisions.md`](docs/decisions.md) | Decisões (ADR) |

## Estrutura

```
saas/backend/      NestJS + Prisma (API produto /api/*)
saas/frontend/     Expo + expo-router (produto)
admin/backend/     NestJS (painel admin Sof, mesmo Postgres)
admin/frontend/    Expo Web (painel admin)
docker-compose.yml PostgreSQL 16 (dev local)
```

## Como rodar

### 1. Banco (Postgres)

```bash
docker compose up -d
```

Postgres em `localhost:5433` (usuário/senha/db: `sof`).

### 2. Backend

```bash
cd saas/backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API em `http://localhost:3001`.

### 3. Frontend (Expo)

```bash
cd saas/frontend
cp .env.example .env
npm install
npm run web        # web em http://localhost:8081
# ou: npm run start  → Expo Go no celular (iOS/Android)
```

Configure `EXPO_PUBLIC_API_URL=http://localhost:3001` no `.env`.

### Conta de teste

- e-mail: `demo@sof.com`
- senha: valor de `SEED_DEMO_PASSWORD` no `saas/backend/.env`

## Auth cross-platform

- **Web:** cookie `sof_session` + token no `localStorage` (SSE)
- **iOS/Android:** `Authorization: Bearer` com token no SecureStore
- Login retorna `{ account, token }` — web e mobile usam Bearer; cookie ajuda no mesmo domínio

## Variáveis principais

| Onde | Variável | Uso |
|------|----------|-----|
| saas/backend | `DATABASE_URL` | Postgres (pooler em Supabase ok) |
| saas/backend | `DIRECT_URL` | Postgres direto (migrations Prisma) |
| saas/backend | `CORS_ORIGIN` | Origens do front |
| saas/backend | `PUBLIC_URL` | URL do frontend (retorno Stripe Checkout) |
| saas/frontend | `EXPO_PUBLIC_API_URL` | URL da API |

## Scripts na raiz

```bash
npm run db:up
npm run backend:dev
npm run frontend:web
npm run admin-backend:dev
npm run admin-frontend:web
```

## Deploy Heroku (API + front web)

Dois apps no monorepo:

| App | Base | URL |
|-----|------|-----|
| `sof-solutions-api` | `saas/backend/` | https://sof-solutions-api-20faec08383c.herokuapp.com |
| `sof-solutions-web` | `saas/frontend/` | https://sof-solutions-web-c45a36088329.herokuapp.com |

Buildpacks (nessa ordem): monorepo (`APP_BASE`) + `heroku/nodejs`.

Banco: usar `DATABASE_URL` / `DIRECT_URL` já existentes (ex.: Supabase) — **não** exige add-on Heroku Postgres.

```bash
# remotes (uma vez)
npm run heroku:remotes

# deploy da branch atual → main do Heroku
npm run deploy:api   # só API
npm run deploy:web   # só front
npm run deploy       # API depois front (sequencial)
npm run deploy:together  # API + front em paralelo

# seed opcional
heroku run -a sof-solutions-api npx prisma db seed
```

Variáveis críticas no API: `JWT_SECRET`, `PUBLIC_URL`, `CORS_ORIGIN`, `API_PUBLIC_URL`, `DATABASE_URL`, `DIRECT_URL`.  
No web: `EXPO_PUBLIC_API_URL` (precisa estar setada **antes** do build).
