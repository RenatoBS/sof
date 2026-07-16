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
