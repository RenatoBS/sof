# Sof — guia para agentes de IA e humanos

**Leia este arquivo primeiro.** É o documento central do monorepo Sof.

Marca: **Sof** (não “Soft”). Produto de agendamento via WhatsApp com site, checkout e painel.

---

## Pacto de documentação (obrigatório)

A documentação **DEVE crescer e atualizar-se com o projeto**. Não é opcional.

### Quando atualizar (sempre)

Qualquer mudança em:

- arquitetura, módulos, rotas, modelos Prisma, auth;
- features de produto (comportamento visível ou contrato de API);
- deploy, envs, bancos, apps Heroku/Supabase/Docker;
- convenções de código, naming, branding;
- decisões com trade-offs (por que A e não B).

### O que fazer

1. Atualizar o(s) arquivo(s) relevantes em [`docs/`](docs/).
2. Registrar a decisão em [`docs/decisions.md`](docs/decisions.md) (nova entrada no topo, data ISO).
3. Se a mudança afeta o “mapa mental” do repo, atualizar **este** `AGENTS.md` (índice, resumo ou links).
4. Manter [`README.md`](README.md) só como quickstart curto — detalhe fica em `docs/`.
5. Após alterar qualquer `docs/*.md`, em `admin/frontend` rodar `npm run sync-docs` e **commitar** `public/internal-docs/` (visível no painel em `/docs`, área logada).

### O que nunca fazer

- Commitar features/arquitetura relevantes **sem** atualizar docs.
- Deixar decisões só no chat / commit message sem ADR em `docs/decisions.md`.
- Documentar segredos (senhas, tokens, connection strings completas). Use só nomes de variáveis.

### Para agentes

Antes de implementar: leia este arquivo + as páginas `docs/` do tema.  
Ao terminar: atualize a documentação na **mesma** sessão de trabalho (não “deixar para depois”).

---

## Índice da documentação

| Documento | Conteúdo |
|-----------|----------|
| [`docs/architecture.md`](docs/architecture.md) | Monorepo, backend Nest, frontend Expo, dados, auth, tempo real |
| [`docs/brand.md`](docs/brand.md) | Persona verbal Sof (voz do bot e da marca) |
| [`docs/bot-messages.md`](docs/bot-messages.md) | Inventário de mensagens do bot WA (cliente + profissional) |
| [`docs/features.md`](docs/features.md) | Features de produto e mapa de telas/APIs |
| [`docs/onboarding-cliente.md`](docs/onboarding-cliente.md) | Guia do cliente: plano/cupom → WhatsApp + cadastros (com prints) |
| [`docs/planos-funcoes.md`](docs/planos-funcoes.md) | Funções por plano (Solo / Equipe / Rede) |
| [`docs/guides/onboarding-cliente.html`](docs/guides/onboarding-cliente.html) | Onboarding HTML (fonte; sync → admin `public/guides`) |
| [`docs/guides/bot-whatsapp.html`](docs/guides/bot-whatsapp.html) | Bot WA HTML (fonte; sync → admin) |
| [`docs/guides/plano-*.html`](docs/guides/plano-solo.html) | Guias HTML por plano (Solo / Equipe / Rede) |
| [`docs/local-development.md`](docs/local-development.md) | Como rodar local, seed, portas, troubleshooting |
| [`docs/deployment.md`](docs/deployment.md) | Heroku, Supabase, envs de produção, deploys |
| [`docs/decisions.md`](docs/decisions.md) | Log vivo de decisões (ADR leve) |
| [`README.md`](README.md) | Quickstart humano |
| [`saas/backend/README.md`](saas/backend/README.md) | Notas da API |
| [`saas/frontend/AGENTS.md`](saas/frontend/AGENTS.md) | Nota Expo SDK 57 (ler docs oficiais da versão) |

---

## Resumo do sistema (1 minuto)

```text
Browser / Expo Go                         Admin (web)
       │                                       │
       ▼                                       ▼
┌──────────────────┐  EXPO_PUBLIC_API_URL  ┌──────────────────┐
│  saas/frontend/  │ ────────────────────► │  saas/backend/   │
│  Expo Router     │   Bearer + cookie     │  NestJS /api/*   │
│  Web + iOS/And.  │ ◄── SSE appointments ─│  Prisma          │
└──────────────────┘                       └────────┬─────────┘
                                                    │
┌──────────────────┐  EXPO_PUBLIC_API_URL  ┌────────┴─────────┐
│  admin/frontend/ │ ────────────────────► │  admin/backend/  │
│  Expo (web)      │   Bearer admin JWT    │  NestJS /api/*   │
└──────────────────┘                       └────────┬─────────┘
                                                    │
                                       DATABASE_URL / DIRECT_URL
                                                    ▼
                                             PostgreSQL
                                       (mesmo DB · Docker :5433
                                        ou Supabase stg/prod)
```

- **API produto:** NestJS + Prisma, prefixo `/api/*`, health em `/api/health`.
- **Front produto:** Expo SDK ~57 + expo-router; marketing + dashboard.
- **API admin:** NestJS separado (`admin/backend/`, porta local 3011); gerencia contas e catálogo de planos Stripe.
- **Front admin:** Expo web (`admin/frontend`, porta 8091). Docs internos autenticados em `/docs` (sync de `docs/*.md` → `public/internal-docs/`). Guias HTML do cliente em `/guides` (públicos).
- **Pagamentos:** Stripe Checkout (ou modo demo sem `STRIPE_SECRET_KEY`); catálogo em tabela `Plan` com entitlements de gate.
- **Gate por plano:** keys no código; valores no admin; enforcement no backend; front via `account.entitlements`.
- **WhatsApp:** Uazapi (default) com pareamento QR/código na Conta; Meta Cloud API opcional; simulador se desligado.
- **Deploy atual:** Heroku prod (`saas/*` + `admin/*`) + QA SaaS (`sof-solutions-*-qa`, Supabase staging). `APP_BASE=saas/backend|saas/frontend|admin/backend|admin/frontend`.
- **CI/CD:** GitHub Actions por tag — `*-stg` publica QA, `*-prod` publica produção (`npm run release:qa|release:prod`). CI roda em PR e antes de cada deploy.

---

## Estrutura do repositório

```text
Sof/
├── AGENTS.md                 ← você está aqui (documento central)
├── README.md
├── .github/                  ← CI e deploy por tag (workflows + action Heroku)
├── docs/                     ← documentação viva (cresce com o projeto)
├── package.json              ← scripts do monorepo
├── docker-compose.yml        ← Postgres local sof/sof/sof :5433
├── render.yaml               ← alternativa Render (API)
├── saas/
│   ├── backend/              ← NestJS + Prisma (produto)
│   │   ├── Procfile
│   │   ├── prisma/           ← schema + migrations (fonte única)
│   │   └── src/
│   └── frontend/             ← Expo + expo-router (produto)
└── admin/
    ├── backend/              ← NestJS (painel admin Sof)
    └── frontend/             ← Expo web (painel admin Sof)
```

---

## Convenções críticas

| Tema | Regra |
|------|--------|
| Marca | **Sof** / `sof-*` / componentes `Sof*`. Nunca renomear de volta para Soft. |
| Auth API | Cookie `sof_session` **ou** `Authorization: Bearer`. Em front web+native: enviar Bearer. |
| Auth admin | Cookie `sof_admin_session` **ou** Bearer; JWT `role: admin` (`ADMIN_JWT_SECRET`). |
| Cookie prod | `secure` + `sameSite: 'none'` (front e API em hosts diferentes). |
| CORS | Whitelist `CORS_ORIGIN` (CSV); `credentials: true`. |
| URLs | `PUBLIC_URL` = front; `API_PUBLIC_URL` = API (webhooks); front usa `EXPO_PUBLIC_API_URL`. |
| Prisma | `DATABASE_URL` (pode ser pooler) + `DIRECT_URL` (migrations / conexão direta). Schema só em `saas/backend/prisma/`; admin gera client via generator `adminClient`. |
| Senhas em URL | Caracteres especiais (`&`, `+`, `/`) devem ser **URL-encoded** em env de deploy. |
| Demo | Email padrão `demo@sof.com`; senha só via `SEED_DEMO_PASSWORD`. |
| Admin seed | `admin@sof.com` via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. |
| Scope de diff | Mudanças focadas; não refatorar fora do pedido; não commitar `.env`. |

---

## Entradas rápidas de código

| Precisa de… | Onde olhar |
|-------------|------------|
| Módulos Nest (produto) | `saas/backend/src/app.module.ts` |
| Módulos Nest (admin) | `admin/backend/src/app.module.ts` |
| Config / env | `saas/backend/src/config/configuration.ts`, `saas/backend/.env.example` |
| Schema DB | `saas/backend/prisma/schema.prisma` |
| Auth token/cookie | `saas/backend/src/common/token.ts`, `auth-request.ts` |
| Auth admin | `admin/backend/src/common/token.ts`, `auth/` |
| Catálogo planos | `Plan` no Prisma; `saas/backend/src/plans/`; painel admin |
| Entitlements / gate | `saas/backend/src/entitlements/`; `Plan.entitlements` + `Account.planId`; admin matriz |
| Cupons promocionais | `PromoCoupon` / `PromoCouponRedemption`; admin `/coupons`; checkout `couponCode`; `saas/backend/src/promo-coupons/`, `billing/` |
| Client HTTP front | `saas/frontend/src/api/client.ts`, `endpoints.ts` |
| Auth front | `saas/frontend/src/auth/AuthProvider.tsx` |
| Rotas UI | `saas/frontend/app/` |
| Rotas admin | `admin/frontend/app/` |
| Tema marketing/dashboard | `saas/frontend/src/theme/` |
| Persona / copy do bot WA | `docs/brand.md`; `docs/bot-messages.md`; `saas/backend/src/whatsapp/bot-copy.ts` |
| Cloud VM bootstrap (QA envs + ngrok) | `.cursor/environment.json`; `scripts/cloud-vm-bootstrap.sh` |
| CI / deploy por tag | `.github/workflows/` (`ci.yml`, `deploy-qa.yml`, `deploy-prod.yml`); `.github/actions/heroku-deploy/`; `scripts/release-tag.sh` |

---

## Checklist do agente (fim de tarefa)

- [ ] Código coerente com [`docs/architecture.md`](docs/architecture.md)
- [ ] Features novas/alteradas em [`docs/features.md`](docs/features.md)
- [ ] Decisão registrada em [`docs/decisions.md`](docs/decisions.md) (se houver trade-off)
- [ ] Deploy/env alterados → [`docs/deployment.md`](docs/deployment.md)
- [ ] Flow local alterado → [`docs/local-development.md`](docs/local-development.md)
- [ ] Índice / resumo deste `AGENTS.md` ainda correto
- [ ] Se `docs/*.md` mudou → `npm run sync-docs` em `admin/frontend` + `public/internal-docs/` commitado
