# Soft — agendamento pelo WhatsApp

Site institucional + checkout de assinatura + dashboard de agendamentos, com bot de
WhatsApp que lança agendamentos confirmados direto no painel em tempo real.

## Estrutura

```
backend/           NestJS + Prisma (API em /api/*)
frontend/          site na raiz + dashboard/ (HTML/JS/CSS estático)
docker-compose.yml PostgreSQL 16
```

## Como rodar

### 1. Banco (Postgres)

```bash
docker compose up -d
```

Sobe o Postgres em `localhost:5433` (usuário/senha/db: `soft`).

### 2. Backend

```bash
cd backend
cp .env.example .env   # ajuste se necessário
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API em `http://localhost:3001`.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm start
# ou: npx serve -p 5500 .
```

Site em `http://localhost:5500`, dashboard em `http://localhost:5500/dashboard/`.
O front chama a API em `http://localhost:3001` com cookies (`credentials: 'include'`).
Dá para sobrescrever com `window.__SOFT_API__ = 'https://sua-api'`.

### Conta de teste

No seed, é criada uma conta **só no banco** (não aparece na interface):

- e-mail: `demo@soft.com` (ou `SEED_DEMO_EMAIL`)
- senha: valor de `SEED_DEMO_PASSWORD` no `.env`

Sem `MP_ACCESS_TOKEN`, o checkout roda em modo demonstração. Sem credenciais
WhatsApp, o bot fica desligado — use o simulador na aba Agenda do dashboard.

## Arquitetura

```
frontend/               landing + login + checkout (index.html)
frontend/dashboard/     painel (agenda, profissionais, serviços, conta)
backend/src/
  auth/ account/ checkout/ payments/
  employees/ services/ appointments/
  whatsapp/ events/ prisma/
```

Login e checkout usam cookie httpOnly `soft_session` (JWT). O dashboard consome
SSE em `/api/events/stream` para agendamentos em tempo real.

## Variáveis de ambiente (backend)

Veja [backend/.env.example](backend/.env.example). Principais:

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres |
| `PORT` | API (default `3001`) |
| `PUBLIC_URL` | URL do frontend (retorno Mercado Pago) |
| `CORS_ORIGIN` | Origem permitida (frontend) |
| `API_PUBLIC_URL` | URL pública da API (webhook MP) |
| `JWT_SECRET` | Assinatura do cookie |
| `MP_*` / `WHATSAPP_*` | Integrações opcionais |

## Deploy (Render)

O `render.yaml` aponta para o backend Nest. Você precisa de um Postgres
(Render Postgres ou externo) e configurar `DATABASE_URL`, `PUBLIC_URL` (URL do
frontend estático) e `CORS_ORIGIN`. O frontend pode ser hospedado como estático
(Netlify/Cloudflare Pages/S3) apontando `window.__SOFT_API__` ou rebuild com a
URL da API.

## Segurança

- Senhas com hash `bcrypt`
- Cookie `httpOnly` + `SameSite=Lax`
- Preço do plano só no servidor
- Assinatura de webhooks (MP / Meta) quando os segredos estão configurados
- Rate limiting em login, checkout e webhook WhatsApp
