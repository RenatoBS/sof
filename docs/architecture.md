# Arquitetura — Sof

Documento vivo. Atualize junto com mudanças estruturais.  
Índice geral: [`../AGENTS.md`](../AGENTS.md).

## Visão geral

Sof é um monorepo com:

1. **backend/** — API HTTP NestJS (`/api/*`) + Prisma + PostgreSQL  
2. **frontend/** — Expo (Web, iOS, Android) com expo-router  

Fluxo principal: cliente agenda pelo WhatsApp (ou simulador) → API persiste `Appointment` → painel recebe via SSE e lista na agenda semanal.

## Backend (`backend/`)

### Stack

- NestJS 11, Express, Helmet, cookie-parser  
- Prisma 6 + PostgreSQL  
- JWT (`jsonwebtoken`) para sessão  
- bcryptjs para senhas  
- Throttling global + limites no login  

### Bootstrap

Arquivo: `backend/src/main.ts`

- CORS com allowlist (`CORS_ORIGIN`) e `credentials: true`  
- `trust proxy` (Heroku)  
- body JSON com `rawBody` (webhooks)  
- Porta: `process.env.PORT` (local default 3001)  

### Módulos

Registrados em `backend/src/app.module.ts`:

| Módulo | Responsabilidade |
|--------|------------------|
| `PrismaModule` | Cliente Prisma |
| `AuthModule` | login / logout / me |
| `AccountModule` | conta + status integrações |
| `EmployeesModule` | profissionais |
| `ServicesModule` | serviços (cardápio) |
| `AppointmentsModule` | agendamentos |
| `CheckoutModule` | assinatura / sessão MP |
| `PaymentsModule` | webhook Mercado Pago |
| `WhatsappModule` | webhook Meta + simulador |
| `EventsModule` | SSE de appointments |
| `HealthController` | `GET /api/health` |

### Auth

1. Login valida email/senha → emite JWT → seta cookie `sof_session` + body `{ account, token }`.  
2. Requests autenticados: `AuthGuard` lê cookie **ou** Bearer (`common/auth-request.ts`).  
3. Produção cross-origin: cookie `sameSite=none` + `secure`; o front **sempre** envia Bearer.  

### Modelo de dados (Prisma)

Arquivo: `backend/prisma/schema.prisma`

```text
Account
  ├── Employee[]
  │     └── EmployeeService[] ──► Service
  ├── Service[]
  ├── Appointment[]  (employeeId + serviceId; employee deve oferecer o serviço)
  ├── CheckoutSession[]
  └── WhatsappSession[]
```

Campos relevantes em `Account`: `businessName`, `email`, `passwordHash`, `plan`, `planPrice`, `whatsappPhoneNumberId`.

`Employee` não tem mais `specialty`; a especialização é a lista de `Service` via `EmployeeService`.

`Appointment`: data/hora, cliente, preço, `status`, `source` (`manual` | `whatsapp`), etc. Create/update validam o vínculo N:N e conflito de agenda do profissional (overlap por duração do serviço; ver `appointments/schedule-conflict.ts`).

Datasource usa:

- `url = env("DATABASE_URL")` — runtime (pooler ok)  
- `directUrl = env("DIRECT_URL")` — migrations  

### Integrações externas

| Integração | Sem credencial | Com credencial |
|------------|----------------|----------------|
| Mercado Pago | Checkout demo (aprova em fluxo mock) | Cobrança / webhook real |
| WhatsApp Cloud | Bot off; painel tem simulador | Mensagens reais no número |

URLs:

- `PUBLIC_URL` → retorno checkout (`/checkout-return`)  
- `API_PUBLIC_URL` → `notification_url` do MP  

### Tempo real

`GET /api/events/stream` (SSE). Front usa `react-native-sse` com header Bearer (`frontend/src/hooks/useRealtime.ts`). Eventos tipados: created / updated / deleted de appointment.

## Frontend (`frontend/`)

### Stack

- Expo SDK ~57, expo-router, React Native + react-native-web  
- TypeScript  
- Fontes: Hanken Grotesk + Inter  
- Tokens: `src/theme/marketing.ts`, `src/theme/dashboard.ts`  

### Rotas (`app/`)

| Rota | Papel |
|------|--------|
| `/` | Landing |
| `/pricing` | Planos + checkout modal |
| `/about` | Quem somos |
| `/login` | Entrar |
| `/checkout-return` | Retorno MP |
| `/(dashboard)/agenda` | Agenda semanal + simulador WA |
| `/(dashboard)/employees` | Profissionais |
| `/(dashboard)/services` | Serviços |
| `/(dashboard)/billing` | Faturamento |
| `/(dashboard)/account` | Conta / integrações |

Gate do dashboard: sem `account` → redirect `/login` (`(dashboard)/_layout.tsx`).

### Estado

- `AuthProvider` — sessão  
- `DashboardProvider` — employees, services, appointments  
- `ToastProvider` — toasts (ex.: novo WA)  

### API client

`frontend/src/api/client.ts`: base `EXPO_PUBLIC_API_URL`, path `/api…`, Bearer + `credentials: 'include'`.

Token storage: web `localStorage` chave `sof_token`; native SecureStore.

### UI

Componentes de marca: `SofButton`, `SofInput`, `SofChatCard`, `FeatureIcon`, `MarketingNav`.  
Visual alinhado ao HTML legado (tokens `#F4F4F6`, `#6B6FB5`).

## Infraestrutura

| Ambiente | Banco | API | Front |
|----------|-------|-----|--------|
| Local | Docker `sof-postgres` :5433 | :3001 | Expo web :8081 |
| Staging/prod | Supabase (pooler + direct) | Heroku `sof-agendamento-api` | Heroku `sof-agendamento-web` |

Heroku monorepo: buildpack subdirectory (`APP_BASE`) + Node.  
Procfiles: `backend/Procfile` (release migrate + web), `frontend/Procfile` (serve static export).

Alternativa documentada: `render.yaml` (API only).

## Diagrama de autenticação (produção)

```text
[sof-agendamento-web]                     [sof-agendamento-api]
        │                                          │
        │  POST /api/auth/login                    │
        │ ───────────────────────────────────────► │
        │  ◄──── Set-Cookie sof_session            │
        │  ◄──── JSON { account, token }           │
        │                                          │
        │  store sof_token (localStorage)          │
        │                                          │
        │  GET /api/*  Authorization: Bearer …     │
        │ ───────────────────────────────────────► │
```

Hosts diferentes ⇒ Bearer é a fonte confiável; cookie auxiliar com `SameSite=None`.
