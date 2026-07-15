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
backend/           NestJS + Prisma (API em /api/*)
frontend/          Expo + expo-router (RN + Web)
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
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API em `http://localhost:3001`.

### 3. Frontend (Expo)

```bash
cd frontend
cp .env.example .env
npm install
npm run web        # web em http://localhost:8081
# ou: npm run start  → Expo Go no celular (iOS/Android)
```

Configure `EXPO_PUBLIC_API_URL=http://localhost:3001` no `.env`.

### Conta de teste

- e-mail: `demo@sof.com`
- senha: valor de `SEED_DEMO_PASSWORD` no `backend/.env`

## Auth cross-platform

- **Web:** cookie `sof_session` + token no `localStorage` (SSE)
- **iOS/Android:** `Authorization: Bearer` com token no SecureStore
- Login retorna `{ account, token }` — web e mobile usam Bearer; cookie ajuda no mesmo domínio

## Variáveis principais

| Onde | Variável | Uso |
|------|----------|-----|
| backend | `DATABASE_URL` | Postgres (pooler em Supabase ok) |
| backend | `DIRECT_URL` | Postgres direto (migrations Prisma) |
| backend | `CORS_ORIGIN` | Origens do front |
| backend | `PUBLIC_URL` | URL do frontend (retorno Mercado Pago) |
| frontend | `EXPO_PUBLIC_API_URL` | URL da API |

## Scripts na raiz

```bash
npm run db:up
npm run backend:dev
npm run frontend:web
```

## Deploy Heroku (API + front web)

Dois apps no monorepo:

| App | Base | URL |
|-----|------|-----|
| `sof-agendamento-api` | `backend/` | https://sof-agendamento-api-105cf5acdd23.herokuapp.com |
| `sof-agendamento-web` | `frontend/` | https://sof-agendamento-web-34fd9a1e97f3.herokuapp.com |

Buildpacks (nessa ordem): monorepo (`APP_BASE`) + `heroku/nodejs`.

Banco: usar `DATABASE_URL` / `DIRECT_URL` já existentes (ex.: Supabase) — **não** exige add-on Heroku Postgres.

```bash
# remotes (uma vez)
npm run heroku:remotes

# deploy da branch atual → main do Heroku
npm run deploy:api   # só API
npm run deploy:web   # só front
npm run deploy       # API + front

# seed opcional
heroku run -a sof-agendamento-api npx prisma db seed
```

Variáveis críticas no API: `JWT_SECRET`, `PUBLIC_URL`, `CORS_ORIGIN`, `API_PUBLIC_URL`, `DATABASE_URL`, `DIRECT_URL`.  
No web: `EXPO_PUBLIC_API_URL` (precisa estar setada **antes** do build).
