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
| [`docs/features.md`](docs/features.md) | Features de produto e mapa de telas/APIs |
| [`docs/local-development.md`](docs/local-development.md) | Como rodar local, seed, portas, troubleshooting |
| [`docs/deployment.md`](docs/deployment.md) | Heroku, Supabase, envs de produção, deploys |
| [`docs/decisions.md`](docs/decisions.md) | Log vivo de decisões (ADR leve) |
| [`README.md`](README.md) | Quickstart humano |
| [`backend/README.md`](backend/README.md) | Notas da API |
| [`frontend/AGENTS.md`](frontend/AGENTS.md) | Nota Expo SDK 57 (ler docs oficiais da versão) |

---

## Resumo do sistema (1 minuto)

```text
Browser / Expo Go
       │
       ▼
┌──────────────────┐     EXPO_PUBLIC_API_URL      ┌──────────────────┐
│  frontend/       │ ───────────────────────────► │  backend/        │
│  Expo Router     │   Bearer + cookie (web)      │  NestJS /api/*   │
│  Web + iOS/And.  │ ◄─── SSE appointments ────── │  Prisma          │
└──────────────────┘                              └────────┬─────────┘
                                                           │
                                              DATABASE_URL / DIRECT_URL
                                                           ▼
                                                    PostgreSQL
                                              (Docker local :5433
                                               ou Supabase stg/prod)
```

- **API:** NestJS + Prisma, prefixo `/api/*`, health em `/api/health`.
- **Front:** Expo SDK ~57 + expo-router; marketing + dashboard.
- **Pagamentos:** Stripe Checkout (ou modo demo sem `STRIPE_SECRET_KEY`).
- **WhatsApp:** Uazapi (default) com pareamento QR/código na Conta; Meta Cloud API opcional; simulador se desligado.
- **Deploy atual:** dois apps Heroku (`APP_BASE=backend|frontend`) + Postgres Supabase.

---

## Estrutura do repositório

```text
Sof/
├── AGENTS.md                 ← você está aqui (documento central)
├── README.md
├── docs/                     ← documentação viva (cresce com o projeto)
├── package.json              ← scripts do monorepo
├── docker-compose.yml        ← Postgres local sof/sof/sof :5433
├── render.yaml               ← alternativa Render (API)
├── backend/                  ← NestJS + Prisma
│   ├── Procfile              ← Heroku release + web
│   ├── prisma/
│   └── src/
└── frontend/                 ← Expo + expo-router
    ├── Procfile              ← serve dist
    ├── app/                  ← rotas
    └── src/                  ← API, auth, UI, features
```

---

## Convenções críticas

| Tema | Regra |
|------|--------|
| Marca | **Sof** / `sof-*` / componentes `Sof*`. Nunca renomear de volta para Soft. |
| Auth API | Cookie `sof_session` **ou** `Authorization: Bearer`. Em front web+native: enviar Bearer. |
| Cookie prod | `secure` + `sameSite: 'none'` (front e API em hosts diferentes). |
| CORS | Whitelist `CORS_ORIGIN` (CSV); `credentials: true`. |
| URLs | `PUBLIC_URL` = front; `API_PUBLIC_URL` = API (webhooks MP); front usa `EXPO_PUBLIC_API_URL`. |
| Prisma | `DATABASE_URL` (pode ser pooler) + `DIRECT_URL` (migrations / conexão direta). |
| Senhas em URL | Caracteres especiais (`&`, `+`, `/`) devem ser **URL-encoded** em env de deploy. |
| Demo | Email padrão `demo@sof.com`; senha só via `SEED_DEMO_PASSWORD`. |
| Scope de diff | Mudanças focadas; não refatorar fora do pedido; não commitar `.env`. |

---

## Entradas rápidas de código

| Precisa de… | Onde olhar |
|-------------|------------|
| Módulos Nest | `backend/src/app.module.ts` |
| Config / env | `backend/src/config/configuration.ts`, `backend/.env.example` |
| Schema DB | `backend/prisma/schema.prisma` |
| Auth token/cookie | `backend/src/common/token.ts`, `auth-request.ts` |
| Client HTTP front | `frontend/src/api/client.ts`, `endpoints.ts` |
| Auth front | `frontend/src/auth/AuthProvider.tsx` |
| Rotas UI | `frontend/app/` |
| Tema marketing/dashboard | `frontend/src/theme/` |

---

## Checklist do agente (fim de tarefa)

- [ ] Código coerente com [`docs/architecture.md`](docs/architecture.md)
- [ ] Features novas/alteradas em [`docs/features.md`](docs/features.md)
- [ ] Decisão registrada em [`docs/decisions.md`](docs/decisions.md) (se houver trade-off)
- [ ] Deploy/env alterados → [`docs/deployment.md`](docs/deployment.md)
- [ ] Flow local alterado → [`docs/local-development.md`](docs/local-development.md)
- [ ] Índice / resumo deste `AGENTS.md` ainda correto
