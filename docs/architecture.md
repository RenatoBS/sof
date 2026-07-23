# Arquitetura — Sof

Documento vivo. Atualize junto com mudanças estruturais.  
Índice geral: [`../AGENTS.md`](../AGENTS.md).

## Visão geral

Sof é um monorepo com:

1. **backend/** — API HTTP NestJS (`/api/*`) + Prisma + PostgreSQL (produto)  
2. **frontend/** — Expo (Web, iOS, Android) com expo-router (produto)  
3. **admin-backend/** — API NestJS do painel interno Sof (mesmo Postgres)  
4. **admin-frontend/** — Expo Web do painel interno  

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
| `PlansModule` | catálogo público `GET /api/plans` + `PlansService` para checkout |
| `CheckoutModule` | assinatura / Checkout Session Stripe |
| `PaymentsModule` | webhook Stripe |
| `WhatsappModule` | webhook Meta/Uazapi + bot + simulador |
| `WhatsappHandoffsModule` | alertas de atendimento humano (escalonamento do bot) |
| `RemindersModule` | job de lembretes WhatsApp (a cada 30 min) |
| `EventsModule` | SSE de appointments + handoffs |
| `SupportTicketsModule` | tickets de suporte (conta + profissional) |
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
  ├── Client[]  (botPausedPermanent / botPausedUntil / botUnresolvedCount)
  ├── Appointment[]  (kind=service → employeeId+serviceId; kind=block → título+duração livres)
  ├── CheckoutSession[]
  ├── WhatsappSession[]
  ├── WhatsappHandoff[]  (alerta de escalonamento: reason, status, humanRepliedAt)
  └── SupportTicket[]
        └── SupportTicketComment[]  (authorRole: account|employee|admin)

AdminUser     (operadores do painel Sof — não é tenant; comentários de suporte)
Plan          (catálogo Sof ↔ stripeProductId / stripePriceId)
```

Campos relevantes em `Account`: `businessName`, `email`, `phone` (responsável; dígitos com DDD), `passwordHash`, `plan`, `planPrice`, `address` (opcional, informado pelo bot), `whatsappPhoneNumberId` (Instance ID Uazapi ou Phone Number ID Meta), `whatsappInstanceToken` (segredo Uazapi, nunca na API pública), `whatsappConnectedAt`, `whatsappReminderMinutes` (0=off; default 120), `timezone` (IANA; default `America/Sao_Paulo`), `openingHours` (JSON 7 dias, 0=domingo), `status` (`active` | `suspended`).

`Plan`: `name`/`slug` únicos, `price`, `stripeProductId`, `stripePriceId`, `features` (JSON), `active`, `sortOrder`. Checkout e pricing leem planos ativos; fallback em `common/plans.ts` se a tabela estiver vazia.

`AdminUser`: email/senha dos operadores do `admin-backend`.

`Employee`: além de nome/cor/serviços/`phone`, tem `email` único, `passwordHash` (null até o profissional definir via link) e `mustChangePassword`. Convites/resets usam `EmployeePasswordToken` (hash SHA-256 do token, `expiresAt` 2h, `usedAt`). JWT distingue `role: account | employee`.

`Employee` não tem mais `specialty`; a especialização é a lista de `Service` via `EmployeeService`.

`Client`: nome, telefone (único por conta); `botPausedPermanent` e `botPausedUntil` silenciam o bot WhatsApp para aquele número (`clients/client-bot-pause.ts`); `botUnresolvedCount` conta "não entendi" consecutivos para escalonamento.

`WhatsappHandoff`: alerta de atendimento humano por conversa — `reason` (`unresolved` | `human_requested`), `status` (`open` | `resolved`), `lastMessage`, `openedAt`, `humanRepliedAt`, `resolvedAt`. Um aberto por telefone (refresh em novas falhas). `Account.whatsappHandoffThreshold` (1|2|3|5, default 2) define quantas falhas abrem alerta. Fluxo: webhook detecta `fromMe` sem `wasSentByApi` (humano respondeu pelo celular/WhatsApp Web) → `WhatsappHandoffsService.onHumanReply` pausa o bot 1 h (`botPausedUntil`), zera o contador e resolve os alertas; o webhook Uazapi é configurado **sem** excluir `fromMe` (só `wasSentByApi` + grupos) e o `GET /api/account/whatsapp/status` ressincroniza a config do webhook no máx. 1x/hora por instância.

`Appointment`: `kind` (`service` | `block`), data/hora, `status` (`confirmed` | `cancelled`), `source` (`manual` | `whatsapp`). Em `service`: cliente, `serviceId`, preço; valida vínculo N:N e **expediente**. Em `block`: `title` + `durationMinutes` (sem cliente/serviço); **não** exige expediente. Ambos usam conflito de agenda (`durationMinutes` ou duração do serviço; `appointments/schedule-conflict.ts`). Recorrência materializa ocorrências com o mesmo `recurrenceGroupId` (`appointments/recurrence.ts`). Cancelamento pelo profissional usa soft-cancel (`cancelled`). Lembrete WhatsApp: `reminderClaimedAt` / `reminderSentAt` (no máximo 1 envio bem-sucedido; job em `reminders/`).

### Lembretes WhatsApp

`RemindersModule` (`@nestjs/schedule`): tick no bootstrap + a cada 30 minutos. Interpreta `Appointment.date`/`time` no `Account.timezone`, calcula due = início − `whatsappReminderMinutes`, envia via `WhatsappApiService.sendText` com o token da conta. Claim atômico no Postgres evita double-send entre dynos/ticks; falha de envio libera o claim para retry.

Datasource usa:

- `url = env("DATABASE_URL")` — runtime (pooler ok)  
- `directUrl = env("DIRECT_URL")` — migrations  

### Integrações externas

| Integração | Sem credencial | Com credencial |
|------------|----------------|----------------|
| Stripe | Checkout demo (aprova em fluxo mock) | Checkout Session + webhook real |
| WhatsApp (Uazapi, default) | Bot off; simulador na Agenda | `WHATSAPP_BASE_URL` + admin token (multi-conta) ou token de instância; QR/código na Conta; menus via `/send/menu`; áudio transcrito via `/message/download` + `OPENAI_API_KEY` |
| OpenAI (NLU do bot) | Frases livres caem no fluxo guiado | `OPENAI_API_KEY`: transcrição de áudio (via Uazapi) + extração de intenção/serviço/data/hora com `gpt-4o-mini` (`whatsapp/booking-nlu.service.ts`) |
| WhatsApp Cloud (Meta) | Bot off; simulador | `WHATSAPP_PROVIDER=meta` + token + Phone Number ID (sem QR no painel); menus `interactive` |

URLs:

- `PUBLIC_URL` → retorno checkout (`/checkout-return`)  
- `API_PUBLIC_URL` → webhook WhatsApp (`/api/whatsapp/webhook`) e Stripe  
- Webhook local Stripe: `stripe listen --forward-to localhost:3001/api/payments/webhook`  

### Tempo real

`GET /api/events/stream` (SSE). Front usa `react-native-sse` com header Bearer (`frontend/src/hooks/useRealtime.ts`). Eventos tipados: `appointment:created|updated|deleted` e `whatsapp-handoff:opened|updated|resolved`.

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
| `/login` | Entrar (conta ou profissional) |
| `/checkout-return` | Retorno Stripe → auto-login agenda |
| `/(dashboard)/agenda` | Agenda semanal + simulador WA |
| `/(dashboard)/employees` | Profissionais |
| `/(dashboard)/services` | Serviços |
| `/(dashboard)/handoffs` | Atendimentos (alertas de escalonamento + config) |
| `/(dashboard)/support` | Tickets de suporte Sof |
| `/(dashboard)/billing` | Faturamento |
| `/(dashboard)/account` | Conta / horários / integrações |
| `/profissional/login` | Redirect → `/login` |
| `/(profissional)/agenda` | Agenda do profissional |
| `/(profissional)/support` | Tickets da conta (comentar / status) |
| `/(profissional)/trocar-senha` | Troca de senha (obrigatória no 1º acesso) |

Gate do dashboard: sem `account` → redirect `/login` (`(dashboard)/_layout.tsx`).  
Gate do portal profissional: sem sessão employee → `/login`; com `mustChangePassword` → `trocar-senha`.

### Estado

- `AuthProvider` — sessão da conta  
- `EmployeeAuthProvider` — sessão do profissional  
- `DashboardProvider` — employees, services, clients, appointments, handoffs  
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
| Local | Docker `sof-postgres` :5433 | :3001 (+ admin :3011) | Expo web :8081 (+ admin :8091) |
| Staging/prod | Supabase (pooler + direct) | Heroku `sof-agendamento-api` (+ `sof-agendamento-admin-api`) | Heroku `sof-agendamento-web` (+ `sof-agendamento-admin-web`) |

Heroku monorepo: buildpack subdirectory (`APP_BASE`) + Node.  
Procfiles: `backend/Procfile` (release migrate + web), `frontend/Procfile` / `admin-frontend/Procfile` (serve static export), `admin-backend/Procfile` (web; sem release migrate).

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

## Painel admin (`admin-backend/` + `admin-frontend/`)

Apps separados do produto, **mesmo Postgres**. Schema/migrations continuam em `backend/prisma/`; o generator `adminClient` emite o client Prisma em `admin-backend/node_modules/.prisma/client`.

### admin-backend

- Porta local **3011**; prefixo `/api/*`; health `GET /api/health`.
- Auth: `POST /api/auth/login|logout`, `GET /api/auth/me` — JWT `role: admin`, cookie `sof_admin_session`, segredo `ADMIN_JWT_SECRET`.
- Contas: `GET/POST /api/accounts`, `GET/PUT /api/accounts/:id`, `POST /api/accounts/:id/reset-password`.
- Planos: `GET/POST /api/plans`, `GET/PUT /api/plans/:id` — com `STRIPE_SECRET_KEY`, cria/atualiza Product e Price (preço novo = Price novo; anterior arquivado).
- Tickets: `GET /api/tickets`, `GET/POST/PATCH /api/tickets/:id…` (comentários e status).
- Envs: ver `admin-backend/.env.example`.

### admin-frontend

- Expo Web porta **8091**; `EXPO_PUBLIC_API_URL` → admin API.
- Rotas: `/login`, `/accounts`, `/new-account`, `/edit-account`, `/tickets`, `/edit-ticket`, `/plans`, `/new-plan`, `/edit-plan`.
