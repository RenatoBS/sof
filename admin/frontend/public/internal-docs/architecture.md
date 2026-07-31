# Arquitetura — Sof

Documento vivo. Atualize junto com mudanças estruturais.  
Índice geral: [`../AGENTS.md`](../AGENTS.md).

## Visão geral

Sof é um monorepo com:

1. **saas/backend/** — API HTTP NestJS (`/api/*`) + Prisma + PostgreSQL (produto)  
2. **saas/frontend/** — Expo (Web, iOS, Android) com expo-router (produto)  
3. **admin/backend/** — API NestJS do painel interno Sof (mesmo Postgres)  
4. **admin/frontend/** — Expo Web do painel interno  

Fluxo principal: cliente agenda pelo WhatsApp (ou simulador) → API persiste `Appointment` → painel recebe via SSE e lista na agenda semanal.

## Backend (`saas/backend/`)

### Stack

- NestJS 11, Express, Helmet, cookie-parser  
- Prisma 6 + PostgreSQL  
- JWT (`jsonwebtoken`) para sessão  
- bcryptjs para senhas  
- Throttling global + limites no login  

### Bootstrap

Arquivo: `saas/backend/src/main.ts`

- CORS com allowlist (`CORS_ORIGIN`) e `credentials: true`  
- `trust proxy` (Heroku)  
- body JSON com `rawBody` (webhooks)  
- Porta: `process.env.PORT` (local default 3001)  

### Módulos

Registrados em `saas/backend/src/app.module.ts`:

| Módulo | Responsabilidade |
|--------|------------------|
| `PrismaModule` | Cliente Prisma |
| `AuthModule` | login / logout / me / esqueci senha (conta) |
| `MailModule` | SMTP transacional (nodemailer; global) |
| `AccountModule` | conta + status integrações |
| `EmployeesModule` | profissionais |
| `ServicesModule` | serviços (cardápio) |
| `AppointmentsModule` | agendamentos |
| `PlansModule` | catálogo público `GET /api/plans` + `PlansService` para checkout |
| `EntitlementsModule` | gate por plano: catálogo de keys + `EntitlementsService` |
| `PromoCouponsModule` | resgate de cupons, pausa por expiração, scheduler |
| `BillingModule` | renovação / mudança de plano (Stripe ou cupom) para conta logada |
| `CheckoutModule` | assinatura / Checkout Session Stripe (+ cupom no create) |
| `PaymentsModule` | webhook Stripe |
| `WhatsappModule` | webhook Meta/Uazapi + bot + simulador; copy/persona em `whatsapp/bot-copy.ts` ([`docs/brand.md`](brand.md)) |
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

Arquivo: `saas/backend/prisma/schema.prisma`

```text
Account  (plan / planPrice snapshot + planId → Plan)
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
Plan          (catálogo Sof ↔ stripeProductId / stripePriceId / paymentLinkUrl / entitlements)
```

Campos relevantes em `Account`: `businessName`, `email`, `phone` (responsável; dígitos com DDD), `passwordHash`, `plan`, `planPrice`, `planId` (FK opcional a `Plan`), `address` (opcional, informado pelo bot), `logoBase64` (data URL do logo; até 5 MB), `whatsappPhoneNumberId` (Instance ID Uazapi ou Phone Number ID Meta), `whatsappInstanceToken` (segredo Uazapi, nunca na API pública), `whatsappConnectedAt`, `whatsappReminderMinutes` (0=off; default 120), `timezone` (IANA; default `America/Sao_Paulo`), `botPausedPermanent` / `botPausedUntil` (pausa global do bot), `openingHours` (JSON 7 dias, 0=domingo), `status` (`active` | `suspended` | `paused`), `billingSource` (`paid` | `promo`), `promoExpiresAt`.

`Plan`: `name`/`slug` únicos, `price`, `stripeProductId`, `stripePriceId`, `paymentLinkUrl`, `features` (JSON marketing `string[]`), `entitlements` (JSON mapa featureKey → boolean | number | null), `active`, `sortOrder`. Admin com Stripe cria Product + Price + Payment Link juntos; `DELETE` desativa o link e remove/arquiva o produto na Stripe antes de apagar o registro. Checkout e pricing leem planos ativos; fallback em `common/plans.ts` (Solo/Equipe/Rede) se a tabela estiver vazia.

`PromoCoupon`: código único, `planId`, `freeDays` (7|30|60), `maxUses` / `usedCount`, `active`. `PromoCouponRedemption` registra uso por conta (`@@unique([couponId, accountId])`) e `expiresAt`.

`Account.planId` referencia o catálogo para resolução de entitlements; `plan`/`planPrice` permanecem como snapshot de display. Resolução: `Plan.entitlements` mergeado com defaults do slug; sem `planId`, aliases de nome (Essencial→Solo, Estúdio→Equipe) ou defaults Solo. Enforcement no backend (`assertFeature` / `assertLimit`); front consome `account.entitlements` em login/`GET /api/auth/me`. Catálogo de keys: `saas/backend/src/entitlements/feature-catalog.ts` (espelho no admin/backend).

`AdminUser`: email/senha dos operadores do `admin/backend`.

`Employee`: além de nome/cor/serviços/`phone`, tem `email` único, `passwordHash` (null até o profissional definir via link) e `mustChangePassword`. Convites/resets usam `EmployeePasswordToken` (hash SHA-256 do token, `expiresAt` 2h, `usedAt`). JWT distingue `role: account | employee`.

`Employee` não tem mais `specialty`; a especialização é a lista de `Service` via `EmployeeService`.

`Client`: nome, telefone (único por conta); `botPausedPermanent` e `botPausedUntil` silenciam o bot WhatsApp para aquele número (`clients/client-bot-pause.ts`); `botUnresolvedCount` conta "não entendi" consecutivos para escalonamento.

`WhatsappHandoff`: alerta de atendimento humano por conversa — `party` (`client` | `employee`), `clientId` / `employeeId` opcionais, `reason` (`unresolved` | `human_requested`), `status` (`open` | `resolved`), `lastMessage`, `openedAt`, `humanRepliedAt`, `resolvedAt`. Um aberto por telefone (refresh em novas falhas). Contadores: `Client.botUnresolvedCount` e `Employee.botUnresolvedCount`. `Account.whatsappHandoffThreshold` (1|2|3|5, default 2) define quantas falhas abrem alerta (cliente e prof). Fluxo: webhook detecta `fromMe` sem `wasSentByApi` → `onHumanReply`: em cliente pausa bot 1 h e resolve; em profissional só resolve (sem pausar o bot operacional). Webhook Uazapi **sem** excluir `fromMe` (só `wasSentByApi` + grupos); `GET /api/account/whatsapp/status` ressincroniza a config no máx. 1x/hora por instância.

`Appointment`: `kind` (`service` | `block`), data/hora, `status` (`scheduled` | `completed` | `cancelled`), `completedAt`, `source` (`manual` | `whatsapp`). Em `service`: cliente, `serviceId`, preço; valida vínculo N:N e **expediente**. Em `block`: `title` + `durationMinutes` (sem cliente/serviço); **não** exige expediente. Ambos usam conflito de agenda (`durationMinutes` ou duração do serviço; `appointments/schedule-conflict.ts` — só `scheduled` ocupa slot). Recorrência materializa ocorrências com o mesmo `recurrenceGroupId` (`appointments/recurrence.ts`). Conclusão: manual (conta sem restrição de janela; profissional só em [início, fim]) ou job `AppointmentCompletionsScheduler` (~5 min) quando `now >= endAt`; SSE `appointment:updated`. Cancelamento usa soft-cancel (`cancelled`). Lembrete WhatsApp: `reminderClaimedAt` / `reminderSentAt` (no máximo 1 envio bem-sucedido; job em `reminders/`; só `scheduled`). Aviso imediato ao profissional: `EmployeeBookingNotifyService` (WhatsApp da conta → `Employee.phone`) após create de `kind=service`.

### Lembretes WhatsApp

`RemindersModule` (`@nestjs/schedule`): tick no bootstrap + a cada 30 minutos. Interpreta `Appointment.date`/`time` no `Account.timezone`, calcula due = início − `whatsappReminderMinutes`, envia via `WhatsappApiService.sendText` com o token da conta. Claim atômico no Postgres evita double-send entre dynos/ticks; falha de envio libera o claim para retry.

### Aviso de agendamento ao profissional

`EmployeeBookingNotifyService` (em `WhatsappModule`): após create de agendamento `kind=service` (API da conta, bot do cliente; portal/bot do profissional pula com `skipEmployeeId`), envia texto via instância da conta para o telefone do `Employee`. Best-effort (erro só no log). Recorrência: uma mensagem listando os horários.

Datasource usa:

- `url = env("DATABASE_URL")` — runtime (pooler ok)  
- `directUrl = env("DIRECT_URL")` — migrations  

### Integrações externas

| Integração | Sem credencial | Com credencial |
|------------|----------------|----------------|
| Stripe | Checkout demo (aprova em fluxo mock) | Checkout Session + webhook real |
| WhatsApp (Uazapi, default) | Bot off; simulador em `/simulator` | `WHATSAPP_BASE_URL` + admin token (multi-conta) ou token de instância; QR/código na Conta; menus via `/send/menu`; áudio transcrito via `/message/download` + `OPENAI_API_KEY`; se o telefone for de um `Employee`, FSM em `whatsapp-employee-bot.service.ts` (agenda / marcar / evento / concluir / cancelar / falar com estabelecimento + NLU próprio) |
| OpenAI (NLU do bot) | Frases livres caem no fluxo guiado | `OPENAI_API_KEY`: transcrição de áudio (via Uazapi) + extração de intenção/serviço/data/hora com `gpt-4o-mini` (`whatsapp/booking-nlu.service.ts`) |
| WhatsApp Cloud (Meta) | Bot off; simulador | `WHATSAPP_PROVIDER=meta` + token + Phone Number ID (sem QR no painel); menus `interactive` |

URLs:

- `PUBLIC_URL` → retorno checkout (`/checkout-return`)  
- `API_PUBLIC_URL` → webhook WhatsApp (`/api/whatsapp/webhook`) e Stripe  
- Webhook local Stripe: `stripe listen --forward-to localhost:3001/api/payments/webhook`  

### Tempo real

`GET /api/events/stream` (SSE). Front usa `react-native-sse` com header Bearer (`saas/frontend/src/hooks/useRealtime.ts`). Eventos tipados: `appointment:created|updated|deleted` e `whatsapp-handoff:opened|updated|resolved`.

## Frontend (`saas/frontend/`)

### Stack

- Expo SDK ~57, expo-router, React Native + react-native-web  
- TypeScript  
- Fontes: Hanken Grotesk + Inter  
- Tokens: `src/theme/marketing.ts`, `src/theme/dashboard.ts`  

### Rotas (`app/`)

| Rota | Papel |
|------|--------|
| `/` | Landing |
| `/pricing` | Planos + checkout modal (cupom opcional) |
| `/(dashboard)/choose-plan` | Escolher/alterar plano ou aplicar cupom (obrigatório se `paused`) |
| `/about` | Quem somos |
| `/login` | Entrar (conta ou profissional) |
| `/forgot-password` | Esqueci senha (conta ou profissional) |
| `/set-password` | Definir senha da conta (`?token=`) |
| `/employee/set-password` | Definir senha do profissional (`?token=`) |
| `/checkout-return` | Retorno Stripe → auto-login agenda |
| `/(dashboard)/agenda` | Agenda semanal |
| `/(dashboard)/simulator` | Simulador WhatsApp (`noindex`; fora das tabs) |
| `/(dashboard)/employees` | Profissionais |
| `/(dashboard)/services` | Serviços |
| `/(dashboard)/handoffs` | Atendimentos (alertas de escalonamento + config) |
| `/(dashboard)/support` | Tickets de suporte Sof |
| `/(dashboard)/billing` | Faturamento |
| `/(dashboard)/account` | Conta / horários / integrações |
| `/employee/login` | Redirect → `/login` |
| `/(employee)/agenda` | Agenda do profissional |
| `/(employee)/support` | Tickets da conta (comentar / status) |
| `/(employee)/change-password` | Troca de senha (obrigatória no 1º acesso) |

Gate do dashboard: sem `account` → redirect `/login`; com `needsPlanSelection` (`status=paused`) → `/(dashboard)/choose-plan` (abas ocultas).  
Gate do portal profissional: sem sessão employee → `/login`; com `mustChangePassword` → `change-password`.

### Estado

- `AuthProvider` — sessão da conta  
- `EmployeeAuthProvider` — sessão do profissional  
- `DashboardProvider` — employees, services, clients, appointments, handoffs  
- `ToastProvider` — toasts (ex.: novo WA)  

### API client

`saas/frontend/src/api/client.ts`: base `EXPO_PUBLIC_API_URL`, path `/api…`, Bearer + `credentials: 'include'`.

Token storage: web `localStorage` chave `sof_token`; native SecureStore.

### UI

Temas: `src/theme/marketing.ts` (`m`) e `src/theme/dashboard.ts` (`d`) — identidade Sof da logo: verde floresta `#3D4743` + cobre `#C19A6B`, fundos claros (`paper` `#F4F4F6` / `surface` branco).

Kit compartilhado em `src/components/ui.tsx`: `SofButton` (pressed/hover/`loading`), `SofInput`, `SofCard`, `SofPageHeader`, `SofEmptyState`, `SofErrorBanner`, `SofAuthCard`, `SofLoadingGate`, `SofListRow`, `SofIconAction` / `SofRowActions` (Editar/Remover com ícone; só ícone abaixo de 720px), `Eyebrow`, `Wrap`. Marketing: `MarketingNav` (menu mobile), `SiteFooter`, `SofChatCard`, `FeatureIcon`.

Toast dismissível no root layout. Shell do dashboard usa tabs com accent Sof, `SofLoadingGate` e `BusinessLogo` (logo da conta antes do nome). Body JSON da API: limite `8mb` (para upload de logo em base64).

## Infraestrutura

| Ambiente | Banco | API | Front |
|----------|-------|-----|--------|
| Local | Docker `sof-postgres` :5433 | :3001 (+ admin :3011) | Expo web :8081 (+ admin :8091) |
| Staging/prod | Supabase (pooler + direct) | Heroku `sof-solutions-api` (+ `sof-solutions-admin-api`) | Heroku `sof-solutions-web` (+ `sof-solutions-admin-web`) |

Heroku monorepo: buildpack subdirectory (`APP_BASE`) + Node.  
Procfiles: `saas/backend/Procfile` (release migrate + web), `saas/frontend/Procfile` / `admin/frontend/Procfile` (serve static export), `admin/backend/Procfile` (web; sem release migrate).

Alternativa documentada: `render.yaml` (API only).

## Diagrama de autenticação (produção)

```text
[sof-solutions-web]                     [sof-solutions-api]
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

## Painel admin (`admin/backend/` + `admin/frontend/`)

Apps separados do produto, **mesmo Postgres**. Schema/migrations continuam em `saas/backend/prisma/`; o admin copia o schema via `npm run admin:sync-schema` e gera o client no próprio `admin/backend`. O generator `adminClient` no schema do produto é só local (output dentro de `saas/backend/node_modules`); no Heroku a API produto roda `prisma generate --generator client`.

### admin/backend

- Porta local **3011**; prefixo `/api/*`; health `GET /api/health`.
- Auth: `POST /api/auth/login|logout`, `GET /api/auth/me` — JWT `role: admin`, cookie `sof_admin_session`, segredo `ADMIN_JWT_SECRET`.
- Contas: `GET/POST /api/accounts`, `GET/PUT /api/accounts/:id`, `POST /api/accounts/:id/reset-password`.
- WhatsApp ops (suporte): `GET /api/accounts/:id/whatsapp` (status ao vivo), `POST …/connect` (QR ou código), `POST …/disconnect`, `POST …/clear`, `POST …/recreate`. Usa as mesmas envs Uazapi do produto; webhook continua em `API_PUBLIC_URL/api/whatsapp/webhook` (API produto). Não expõe `whatsappInstanceToken` ao front.
- Planos: `GET/POST /api/plans`, `GET/PUT /api/plans/:id` — com `STRIPE_SECRET_KEY`, cria/atualiza Product e Price (preço novo = Price novo; anterior arquivado). Body aceita `entitlements`. `GET /api/feature-catalog` lista keys gateáveis. `POST /api/plans/:id/sync-stripe` força Product+Price+Payment Link alinhados ao preço do Sof (também corrige planos `seed_*`).
- Cupons: `GET/POST /api/coupons`, `GET/PUT/DELETE /api/coupons/:id` — plano + 7/30/60 dias + máx. usos.
- Tickets: `GET /api/tickets`, `GET/POST/PATCH /api/tickets/:id…` (comentários e status).
- Envs: ver `admin/backend/.env.example`.

### admin/frontend

- Expo Web porta **8091**; `EXPO_PUBLIC_API_URL` → admin API.
- Rotas autenticadas: `/login`, `/accounts`, `/new-account`, `/edit-account`, `/tickets`, `/edit-ticket`, `/plans`, `/new-plan`, `/edit-plan`, `/coupons`, `/new-coupon`, `/edit-coupon`.
- **Rotas públicas (sem login):** `/guides` (hub), `/guides/onboarding`, `/guides/bot` + HTMLs estáticos (`onboarding-cliente`, `bot-whatsapp`, `plano-solo|equipe|rede`) em `public/guides/` (sync via `npm run sync-guides` no build). Nav **Guias** no shell abre `/guides` em nova aba.
- **Docs internos (login admin):** `/docs` + `/docs/[slug]` — lê `public/internal-docs/` (sync `npm run sync-docs` a partir de `docs/*.md`). Hub com busca + TOC no leitor. Nav **Docs**. Build: `sync-content`.
- UI kit próprio (não compartilha código com `saas/frontend/`): tokens em `src/theme/admin.ts` (`colors`, `space`, `radius`, `shadow.soft`, `fonts` — mesmas famílias Hanken/Inter e mesma cromia Sof: verde floresta + cobre) e componentes em `src/components/ui.tsx` (`Field`, `Button` com `loading`/`size='sm'`/hover-pressed, `PageHeader`, `ListRow`, `EmptyState`, `ErrorText`, `SearchField`). Telas de listagem (`accounts`, `tickets`, `plans`, `coupons`) usam esses componentes; formulários usam `ErrorText` + `Button loading` mantendo a lógica original.
