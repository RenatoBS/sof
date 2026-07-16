# Decisões — Sof (ADR leve)

Documento vivo. **Toda decisão relevante entra aqui**, entrada mais recente no **topo**.

Formato sugerido:

```md
## YYYY-MM-DD — Título curto

- **Contexto:** …
- **Decisão:** …
- **Consequências:** …
- **Alternativas descartadas:** …
```

Índice geral: [`../AGENTS.md`](../AGENTS.md).

---

## 2026-07-16 — Limpeza de envs não usadas (Uazapi + Stripe)

- **Contexto:** `.env` e Heroku acumulavam vars Meta (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`) e `STRIPE_PUBLISHABLE_KEY` que o runtime não lê (Checkout usa só secret + webhook).  
- **Decisão:** Remover essas três do `.env` local e da Heroku; `SEED_DEMO_*` ficam só para seed; Meta vars documentadas como opcionais no `.env.example`.  
- **Consequências:** Menos superfície de config; UI Conta não menciona publishable key.  
- **Alternativas descartadas:** Manter publishable “por se um dia usar Elements”.

## 2026-07-16 — Provider WhatsApp padrão = Uazapi

- **Contexto:** Meta Cloud API exigia Phone Number ID + app secret; o produto já opera com Uazapi (QR/código na Conta).  
- **Decisão:** Default de `WHATSAPP_PROVIDER` passou a `uazapi`; Meta permanece opcional via env. Pareamento na Conta aceita admin token (multi-tenant) ou `WHATSAPP_TOKEN` de instância única (legado), com fallback se o admin for inválido.  
- **Consequências:** `.env.example` e docs locais enfatizam Uazapi; `WHATSAPP_ADMIN_TOKEN` ≠ token da instância.  
- **Alternativas descartadas:** Manter default `meta`; exigir sempre admin token mesmo em dev com uma instância.

## 2026-07-16 — Pareamento WhatsApp por conta (QR/código Whazap)

- **Contexto:** O painel só gravava Instance ID manualmente; o QR ficava no Whazap e um único `WHATSAPP_TOKEN` no servidor não escalava multi-tenant.  
- **Decisão:** Com `WHATSAPP_ADMIN_TOKEN` + `WHATSAPP_BASE_URL`, cada `Account` cria/reusa uma instância Uazapi; Conta exibe QR ou código de pareamento; persistir `whatsappInstanceToken` (strip em `publicAccount`) + `whatsappPhoneNumberId`; envio/webhook usam o token da conta.  
- **Consequências:** Novos endpoints `/api/account/whatsapp/connect|status|disconnect`; `API_PUBLIC_URL` obrigatória em prod para registrar webhook; simulador na Agenda permanece.  
- **Alternativas descartadas:** Continuar colando Instance ID; um token global para todas as contas; Evolution API.

## 2026-07-15 — Planos Sof como assinaturas Stripe (sandbox)

- **Contexto:** Precisávamos de produtos recorrentes mensais e links de pagamento no sandbox.  
- **Decisão:** Criar Product + Price (`recurring.interval=month`) + Payment Link para Essencial (R$ 99), Estúdio (R$ 197) e Rede (R$ 249); Checkout da API passou a `mode: subscription` com `stripePriceId`.  
- **Consequências:** IDs e URLs em `backend/src/common/plans.ts`; Payment Links usáveis fora do app; webhook continua em `checkout.session.completed`.  
- **Alternativas descartadas:** Manter pagamento único (`mode: payment`); só Payment Links sem Checkout Session no app.

## 2026-07-16 — Gateway de pagamento: Stripe no lugar do Mercado Pago

- **Contexto:** Produto precisava trocar o gateway; Preference/MP era one-shot com redirect.  
- **Decisão:** Stripe Checkout Sessions (`mode: payment`) + webhook `checkout.session.completed`; envs `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY`; sem token → modo demo igual ao antigo; `preferenceId` no DB passa a guardar o id `cs_…` da sessão Stripe.  
- **Consequências:** Removido `mercadopago.service`; painel Conta e docs atualizados; webhook exige raw body + assinatura.  
- **Alternativas descartadas:** Payment Element embutido; Subscriptions Billing (próximo passo se quiser renovação automática de verdade).

## 2026-07-16 — Login unificado conta + profissional

- **Contexto:** Duas telas de login confundiam o fluxo.  
- **Decisão:** Um único `/login`; tenta `POST /api/auth/login` e, se o e-mail não existir na conta, tenta `POST /api/employee-auth/login`; redireciona ao painel ou à agenda do profissional. `/profissional/login` vira redirect.  
- **Consequências:** Copy e gates apontam só para `/login`.  
- **Alternativas descartadas:** Toggle Empresa/Profissional; manter duas URLs.

## 2026-07-16 — Login do profissional (agenda própria)

- **Contexto:** Só o dono da conta tinha acesso; profissionais precisavam ver a própria agenda e cancelar horários.  
- **Decisão:** `Employee.email` (único), `passwordHash`, `mustChangePassword`; JWT com `role: employee` + cookie `sof_employee_session`; portal `/(profissional)/*`; create gera senha temporária; 1º acesso força troca de senha; cancelamento do profissional marca `status=cancelled` (libera slot). Login unificado em `/login` (tenta conta, depois profissional se o e-mail não existir na conta).  
- **Consequências:** Cadastro de profissional exige e-mail; painel mostra senha gerada uma vez; endpoints `/api/employee-auth/*` e `/api/employee/appointments`.  
- **Alternativas descartadas:** Telas de login separadas; mesmo login da conta com role; hard delete no cancelamento do profissional; senha escolhida pelo dono sem geração automática.

## 2026-07-16 — Horário de funcionamento semanal da conta

- **Contexto:** Sugestões e agendamentos usavam janela fixa 09–18; o estabelecimento precisava escolher dias/horários.  
- **Decisão:** Campo `Account.openingHours` (JSON, 7 dias, índice 0=domingo); default seg–sáb 09:00–18:00 e domingo fechado; UI em Conta; create/update de appointments e bot WhatsApp só aceitam slots em que o serviço cabe inteiro no expediente; sugestões usam o open/close do dia.  
- **Consequências:** Migration `20260716010000_account_opening_hours`; `PUT /api/account` aceita `openingHours`; contas novas (seed/checkout) e existentes recebem o default.  
- **Alternativas descartadas:** Horário por profissional; múltiplos intervalos no mesmo dia; timezone por conta (fica no fuso do servidor/cliente parseando a data).

## 2026-07-15 — Bloquear horário ocupado do profissional

- **Contexto:** O simulador/WhatsApp e o create de appointments permitiam marcar o mesmo profissional no mesmo intervalo.  
- **Decisão:** Helper `schedule-conflict` com overlap por duração do serviço; API `POST/PUT /api/appointments` rejeita conflito; bot WA em `awaiting_datetime` e na confirmação sugere horários livres e mantém o passo até o cliente escolher outro.  
- **Consequências:** Só `status=confirmed` ocupa agenda; update exclui o próprio appointment do check; sugestões no dia usam o expediente da conta (antes era 09–18 fixo).  
- **Alternativas descartadas:** Só validar na API sem UX no bot; travar o dia inteiro sem sugestões; considerar `cancelled` como ocupado.

## 2026-07-15 — Scripts npm de deploy Heroku

- **Contexto:** Deploy de dois apps exigia lembrar remotes e dois `git push`.  
- **Decisão:** Scripts na raiz: `deploy:api`, `deploy:web`, `deploy` (api depois web), e `heroku:remotes`.  
- **Consequências:** Um comando `npm run deploy` publica back e front da HEAD atual para `main` nos remotes Heroku.  
- **Alternativas descartadas:** script shell separado; deploy paralelo (ordem api→web facilita falha da API antes do front).

## 2026-07-15 — Edição de serviços no painel

- **Contexto:** Só existia create/delete de serviços; preço/duração/nome precisavam ser alteráveis.  
- **Decisão:** `PUT /api/services/:id` com os mesmos campos do create; UI reutiliza o formulário em modo edição; ao salvar, sincroniza cópias do serviço embutidas em `employee.services` no estado do front.  
- **Consequências:** Cards ganham “Editar”; appointments existentes mantêm o `serviceId` e passam a refletir o preço novo só em novos agendamentos (create copia `service.price`).  
- **Alternativas descartadas:** Recriar serviço e migrar vínculos; editar preço retroativo em appointments antigos.

## 2026-07-15 — Remover telefone do profissional

- **Contexto:** Telefone do profissional não era usado no fluxo de agenda/WhatsApp.  
- **Decisão:** Dropar `Employee.phone` do schema, API e UI; cadastro fica nome + serviços.  
- **Consequências:** Migration `20260715234500_employee_drop_phone`.  
- **Alternativas descartadas:** Manter campo opcional oculto.

## 2026-07-15 — Edição de profissionais no painel

- **Contexto:** Só existia create/delete; era preciso alterar serviços de um profissional já cadastrado.  
- **Decisão:** `PUT /api/employees/:id` com os mesmos campos do create (`name`, `serviceIds` ≥ 1); replace dos vínculos `EmployeeService` em transaction; UI reutiliza o formulário em modo edição.  
- **Consequências:** Cards ganham ação “Editar”; lista na agenda/WhatsApp usa os serviços atualizados no próximo fetch.  
- **Alternativas descartadas:** PATCH parcial; edição só de nome sem mexer nos serviços.

## 2026-07-15 — Profissionais vinculados a serviços (N:N)

- **Contexto:** Especialidade como string livre não refletia o cardápio real nem filtrava quem podia realizar cada serviço.  
- **Decisão:** Remover `Employee.specialty`; criar `EmployeeService`; cadastro exige ≥ 1 `serviceId` da conta; WhatsApp e modal de agenda filtram profissionais pelo serviço; appointments validam o vínculo.  
- **Consequências:** Migration `20260715233000_employee_services` com backfill best-effort; API `POST /employees` recebe `serviceIds`; front usa multi-select de chips.  
- **Alternativas descartadas:** Manter specialty + serviços opcionais; só filtrar no painel sem mudar WhatsApp.

## 2026-07-15 — Documentação viva obrigatória para agentes

- **Contexto:** Novos agentes precisam entender o monorepo sem depender do histórico de chat.  
- **Decisão:** Criar `AGENTS.md` + pasta `docs/` com pacto de atualização contínua; regra Cursor `alwaysApply`.  
- **Consequências:** Features/arquitetura/deploy e ADRs devem ser editados na mesma sessão da mudança.  
- **Alternativas descartadas:** README único gigante sem índice; docs só no Notion.

## 2026-07-15 — Deploy em dois apps Heroku + Supabase

- **Contexto:** Separar front estático Expo e API Nest; banco já existia no Supabase.  
- **Decisão:** `sof-agendamento-api` (`APP_BASE=backend`) e `sof-agendamento-web` (`APP_BASE=frontend`); sem add-on Heroku Postgres; `DATABASE_URL` + `DIRECT_URL`.  
- **Consequências:** `EXPO_PUBLIC_API_URL` no build do web; CORS/PUBLIC_URL apontam para o web; deploy via `git push` para remotes `heroku-api` / `heroku-web`.  
- **Alternativas descartadas:** app único servindo static+API; Render-only (fica como opção em `render.yaml`).

## 2026-07-15 — Auth Bearer no web + cookie SameSite=None

- **Contexto:** Front e API em origens Heroku diferentes; cookie `SameSite=Lax` não autentica XHR cross-site.  
- **Decisão:** Front sempre envia `Authorization: Bearer`; cookie prod `secure` + `sameSite: 'none'`.  
- **Consequências:** `sof_token` no localStorage/SecureStore é caminho principal; SSE já usava Bearer.  
- **Alternativas descartadas:** proxy same-origin; subdomínios custom compartilhados (ainda não).

## 2026-07-15 — Prisma `DIRECT_URL` + encode de senha

- **Contexto:** Pooler Supabase (6543) + senha com `&` / `+` / `/` quebrava migrate e ferramentas JDBC.  
- **Decisão:** `directUrl` no schema; encode de senha nas config vars; DataGrip via campos separados + SSL na 5432.  
- **Consequências:** `.env.example` documenta `DIRECT_URL`; deploy precisa das duas URLs.  
- **Alternativas descartadas:** só `DATABASE_URL` no pooler para migrate.

## 2026-07-15 — Frontend Expo (RN + Web) com paridade visual

- **Contexto:** Frontend legado HTML; necessidade de iOS/Android + web.  
- **Decisão:** Migrar UI para Expo Router mantendo tokens/copy do HTML original; HTML legado só como referência visual.  
- **Consequências:** Um codebase; export estático para Heroku web; dependência `serve`.  
- **Alternativas descartadas:** manter site HTML separado do painel RN.

## 2026-07-15 — Separação NestJS + Prisma + Postgres

- **Contexto:** Backend acoplado / estático insuficiente para sessões, WhatsApp e MP.  
- **Decisão:** API Nest em `backend/`, Postgres (Docker local), Prisma migrations, módulos por domínio.  
- **Consequências:** Monorepo com scripts na raiz; seed demo; throttle e guards.  
- **Alternativas descartadas:** serverless only sem ORM; SQLite.

## 2026-07-15 — Renomear marca Soft → Sof

- **Contexto:** Produto se chama Sof.  
- **Decisão:** Branding, packages, cookie `sof_session`, token `sof_token`, Docker `sof`, componentes `Sof*`. Tokens CSS `accentSoft` / `shadow.soft` permanecem (adjetivo “suave”).  
- **Consequências:** Atualizar copy, README, Mercado Pago descriptor, WhatsApp greeting.  
- **Alternativas descartadas:** manter Soft só em infra.
