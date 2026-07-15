# Sof — agendamento pelo WhatsApp

Site institucional + checkout + dashboard em **Expo (Web, iOS, Android)** com API **NestJS + Prisma + PostgreSQL**.

## Estrutura

```
backend/           NestJS + Prisma (API em /api/*)
frontend/          Expo + expo-router (RN + Web)
docker-compose.yml PostgreSQL 16
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
- Login retorna `{ account, token }` — mobile usa o token; web usa cookie + token

## Variáveis principais

| Onde | Variável | Uso |
|------|----------|-----|
| backend | `DATABASE_URL` | Postgres |
| backend | `CORS_ORIGIN` | Origens Expo (ex.: `http://localhost:8081`) |
| backend | `PUBLIC_URL` | URL do frontend (retorno Mercado Pago) |
| frontend | `EXPO_PUBLIC_API_URL` | URL da API |

## Scripts na raiz

```bash
npm run db:up
npm run backend:dev
npm run frontend:web
```
