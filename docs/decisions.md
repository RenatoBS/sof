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

## 2026-07-28 — Conta: máscara de telefone, save único, gate WA

- **Contexto:** Telefone na Conta sem máscara; pausa do bot e lembretes apareciam sem WhatsApp conectado; telefone e endereço tinham botões separados.  
- **Decisão:** Máscara BR `(DD) NNNNN-NNNN` no input; um botão Salvar envia `phone`+`address`; seções pausa/lembretes só com `waLinked` (+ entitlements).  
- **Consequências:** UI coerente com o estado real da integração; menos cliques no cadastro do estabelecimento.  
- **Alternativas descartadas:** Manter saves separados; esconder só via entitlement.

---

## 2026-07-28 — Validação de cadastro de conta no front

- **Contexto:** CheckoutModal só desabilitava o botão sem feedback; e-mail não era checado; admin Nova conta e Conta (telefone/horários) iam direto à API.  
- **Decisão:** Helpers em `frontend/src/lib/validation.ts` espelhando backend; `SofInput`/`Field` com prop `error`; validação por campo no submit (checkout, admin nova conta, telefone/horários na Conta). Botão permanece clicável para exibir erros.  
- **Consequências:** Usuário vê o que corrigir antes do round-trip; backend continua como fonte de verdade.  
- **Alternativas descartadas:** Manter só `disabled` silencioso; biblioteca de forms pesada.

---

## 2026-07-28 — Conta: UI por seções + hero do estabelecimento

- **Contexto:** A tela Conta era uma pilha longa de cards sem hierarquia (telefone/endereço separados, status WhatsApp só em texto, logout como card).  
- **Decisão:** Hero com iniciais/nome/plano/status WA; labels de seção; telefone+endereço no mesmo card; preview de expediente com pills Dom–Sáb; status servidor/dispositivo em cards; logout em zona de sessão no rodapé. Tokens e componentes do dashboard (`d`, `SofButton`/`SofInput`) mantidos.  
- **Consequências:** Mesmo contrato de API e comportamento; navegação visual mais clara sem mudar fluxos.  
- **Alternativas descartadas:** Tabs internas (mais estado); redesign fora do design system do painel.

---

## 2026-07-28 — Sync Stripe de planos seed + Payment Link alinhado ao preço

- **Contexto:** Planos Solo/Equipe/Rede no DB tinham `stripeProductId=seed_*` e Payment Links/Prices antigos (R$99/197/249) enquanto o catálogo mostrava R$139/199/259; Solo sem link; seed sobrescrevia IDs Stripe; save no admin sempre mandava `paymentLinkUrl` e bloqueava regeneração.  
- **Decisão:** `syncPlanCatalog` cria/reusa Product+Price+Payment Link pelo preço do Sof; `POST /api/plans/:id/sync-stripe` + botão no admin; update sincroniza também planos `seed_*` / link vazio; seed **não** sobrescreve campos Stripe no update.  
- **Consequências:** Checkout e Payment Links passam a cobrar o valor do plano; admin pode re-sincronizar a qualquer momento.  
- **Alternativas descartadas:** Corrigir só à mão no Dashboard Stripe; manter Prices legados.

---

## 2026-07-28 — Cupons promocionais (dias grátis sem Stripe)

- **Contexto:** Precisávamos dar 7/30/60 dias grátis de um plano selecionado, com limite de usos, sem passar pelo Checkout Stripe; ao vencer, a conta pausa e o dono escolhe plano de novo.  
- **Decisão:** Modelos `PromoCoupon` + `PromoCouponRedemption`; admin CRUD; checkout aceita `couponCode` → `promo-approved` (pula Stripe); conta com `billingSource=promo` + `promoExpiresAt`; expiração lazy + job 15 min → `status=paused` + `needsPlanSelection` no front; `POST /api/billing/checkout|redeem-coupon` para renovar/mudar plano; botão “Alterar plano” na Conta.  
- **Consequências:** Promo não cria subscription Stripe; após o período o tenant deve pagar ou usar outro cupom. `paused` é distinto de `suspended` (admin). Mesmo cupom só 1× por conta.  
- **Alternativas descartadas:** Stripe Coupons/Trials (exigiria subscription desde o dia 1); trial genérico sem vínculo a plano.

---

## 2026-07-28 — Gate por plano (entitlements configuráveis no admin)

- **Contexto:** Planos Solo/Equipe/Rede definidos no pricing; features existiam no produto mas sem enforcement; admin só editava bullets de marketing.  
- **Decisão:** Catálogo tipado de keys no código (`feature-catalog.ts`); valores por plano em `Plan.entitlements` (JSON); `Account.planId` FK; `EntitlementsService.assertFeature` / `assertLimit` (403 `PLAN_FEATURE_REQUIRED` / `PLAN_LIMIT_REACHED`); admin edita matriz; `/auth/me` e login expõem `entitlements`; front esconde tabs/settings. Seed/fallback: Solo R$139 / Equipe R$199 / Rede R$259.  
- **Stubs documentados:** `maxWhatsappNumbers` (produto ainda 1 número; connect efetivo `min(limit,1)`); `clientReschedule` (débito técnico — fluxo de remarcar no bot ainda não existe); `supportPriority` só UI (badge).  
- **Consequências:** Admin muda limites/features sem deploy de lógica; novas keys exigem hook no código. Contas sem `planId` resolvem por nome/alias (Essencial→Solo, Estúdio→Equipe) ou defaults Solo.  
- **Alternativas descartadas:** Feature flags globais sem plano; entitlements só no front; multi-WhatsApp e remarcação nesta entrega.

---

## 2026-07-23 — Bot: nome+sobrenome no 1º contato e matching de profissionais

- **Contexto:** 1º contato aceitava só um nome; texto digitado (ex. “João”, sem acento, título truncado) não batia com o profissional.  
- **Decisão:** `awaiting_name` exige ≥2 palavras; `resolveChoice` normaliza acentos, casa primeiro nome/parcial e títulos truncados; botões de prof usam 1º nome quando único.  
- **Consequências:** Clientes novos com nome completo; menos “não entendi” na escolha de profissional. Ambíguo (dois “João”) pede de novo.  
- **Alternativas descartadas:** Sempre mostrar nome completo truncado com reticências; forçar só número do menu.

---

## 2026-07-23 — `TZ=America/Sao_Paulo` no dyno da API Heroku

- **Contexto:** Bot usava `new Date()` local do servidor; dyno em UTC fazia “amanhã” virar o dia seguinte após 21h BRT (ex.: pediu 24/07 e marcou 25/07).  
- **Decisão:** Config var `TZ=America/Sao_Paulo` em `sof-agendamento-api` para o Node interpretar data/hora local no fuso BR.  
- **Consequências:** Hoje/amanhã no bot alinhados ao Brasil sem redeploy de código. Contas com fuso diferente de SP ainda podem divergir até o bot usar `Account.timezone` de ponta a ponta.  
- **Alternativas descartadas:** Só corrigir código agora (melhor a médio prazo; pode coexistir com `TZ`).

---

## 2026-07-23 — Aviso WhatsApp ao profissional no novo agendamento

- **Contexto:** Profissional só via SSE no painel; cliente/painel marcavam horário no nome dele sem WhatsApp.  
- **Decisão:** `EmployeeBookingNotifyService` envia mensagem da instância da conta para `Employee.phone` após create `kind=service` (bot cliente + API conta). Skip se o próprio prof criou (portal/bot). Best-effort (não falha o create).  
- **Consequências:** Exige WhatsApp conectado na conta + telefone válido no profissional; recorrência vira uma mensagem com lista de horários.  
- **Alternativas descartadas:** Template HSM Meta; toggle por conta; notificar também em `kind=block`.

---

## 2026-07-23 — Apagar plano no admin limpa Stripe via API

- **Contexto:** Product/Payment Link criados por API só se removem por API; o admin não tinha exclusão e deixava órfãos na Stripe.  
- **Decisão:** `DELETE /api/plans/:id` desativa Payment Links (`active: false` — Stripe não tem DELETE), arquiva Prices, tenta `products.del` e se a Stripe recusar (ex.: Price associado) arquiva o Product. Só então apaga o `Plan` local. Erro da Stripe → `502` com a mensagem no front; plano permanece.  
- **Consequências:** Botão **Apagar plano** em `/edit-plan`; sem `STRIPE_SECRET_KEY` não apaga planos que tenham IDs/URL Stripe.  
- **Alternativas descartadas:** Soft-delete só no Sof; apagar DB sem tocar Stripe; exigir `stripePaymentLinkId` no schema antes de limpar.

---

## 2026-07-23 — Admin cria Payment Link junto com Product/Price

- **Contexto:** Ao criar plano no painel admin com Stripe, só Product + Price eram sincronizados; `paymentLinkUrl` ficava vazio e o link tinha que ser colado à mão.  
- **Decisão:** `StripeCatalogService.createProductAndPrice` também cria `paymentLinks.create` e grava a URL no plano. Ao trocar preço/intervalo (novo Price), gera um Payment Link novo e atualiza `paymentLinkUrl` (salvo override manual no mesmo request).  
- **Consequências:** Novo plano já nasce com link `buy.stripe.com`; edição de preço renova o link. Links antigos na Stripe não são desativados (não há `paymentLinkId` no schema).  
- **Alternativas descartadas:** Só Checkout Session no app sem Payment Links; botão separado “gerar link” no admin.

---

## 2026-07-23 — Menu do bot do profissional: concluir condicional + criar unificado

- **Contexto:** “Concluir” no menu poluía quando o prof não estava em atendimento; agendamento e evento eram duas entradas redundantes.  
- **Decisão:** **Concluir agendamento** só aparece (e em 1º) se houver horário `scheduled` na janela atual. **Novo na agenda** pergunta se é agendamento de cliente ou evento (almoço/médico). NLU/atalhos de `book`/`event` seguem diretos.  
- **Consequências:** Menu mais curto no dia a dia; conclusão antecipada continua liberando o slot.  
- **Alternativas descartadas:** Manter dois botões fixos; concluir sempre visível com erro se fora da janela.

---

## 2026-07-23 — Handoff humano também para profissionais

- **Contexto:** Profissionais no bot WhatsApp precisavam pedir ajuda da conta; a aba Atendimentos só cobria clientes e o webhook ignorava telefone de `Employee`.  
- **Decisão:** `WhatsappHandoff.party` (`client` | `employee`) + `employeeId`; `Employee.botUnresolvedCount`. Bot do prof: menu **Falar com estabelecimento**, regex/NLU `human`, e `unresolved` no fallback do menu. `afterBotResult` escala ambos. UI: badge Cliente (azul) vs Profissional (lilás). Resposta `fromMe` em prof resolve sem pausar o bot operacional.  
- **Consequências:** Mesmo threshold da conta; não cria `Client` fantasma para o telefone do prof.  
- **Alternativas descartadas:** Canal separado só para prof; silenciar bot do prof após handoff como no cliente.

---

## 2026-07-23 — Status `scheduled` / `completed` e liberação antecipada de slot

- **Contexto:** Precisávamos distinguir horário ainda ativo de atendimento já feito, auto-fechar quando a janela acaba, e permitir que o profissional liberasse o restante do slot se terminasse antes.  
- **Decisão:** Renomear `confirmed` → `scheduled`; adicionar `completed` + `completedAt`. Só `scheduled` entra em `listBusySlots`. Job a cada 5 min (`AppointmentCompletionsService`) marca `completed` quando `now >= endAt` (fuso da conta). Conta conclui via `POST /api/appointments/:id/complete` sem restrição de janela; profissional (web/bot) só dentro de [início, fim]. Bot: menu **Concluir horário** + intent NLU `complete`.  
- **Consequências:** Conclusão antecipada libera o horário restante para novos agendamentos; concluídos continuam visíveis na agenda com badge. Lembretes e conflitos ignoram `completed`/`cancelled`.  
- **Alternativas descartadas:** Manter `confirmed` só como label; encurtar `durationMinutes` em vez de mudar status; permitir conclusão do prof fora da janela.

---

## 2026-07-23 — Reset de senha do profissional (web + bot)

- **Contexto:** Reset só existia pelo painel da conta; o profissional ficava dependente do responsável.  
- **Decisão:** `EmployeePasswordResetService` (issue + CTA WhatsApp) compartilhado entre painel, `POST /api/employee-auth/request-password-reset` (público, resposta genérica) e opção **Redefinir senha** no menu/NLU do bot. UI: `/profissional/esqueci-senha` + link em `/login`.  
- **Consequências:** Sempre invalida a senha atual ao emitir o link; exige telefone do prof + WhatsApp da conta conectado.  
- **Alternativas descartadas:** E-mail SMTP; reset só por token na web sem WhatsApp; exigir senha atual no forgot.

---

## 2026-07-23 — Bot WhatsApp para profissionais (telefone cadastrado)

- **Contexto:** Profissionais precisavam operar agenda pelo mesmo WhatsApp do salão, sem cair no fluxo de cliente.  
- **Decisão:** Se o remetente casa com `Employee.phone` da conta, `WhatsappBotService` delega a `WhatsappEmployeeBotService` (steps `emp:*`): ver agenda (hoje/outro dia), marcar serviço, criar evento/`block`, cancelar. Áudio segue a mesma transcrição do webhook; NLU próprio no menu inicial (`agenda|book|event|cancel`). Profissionais **não** são silenciados por pausa da conta nem por pausa de cliente.  
- **Consequências:** Telefone do profissional precisa estar cadastrado (com ou sem DDI 55). Simulador testa com o mesmo número.  
- **Alternativas descartadas:** Código/PIN especial; fluxo único com flag; silenciar prof junto com a pausa global.

---

## 2026-07-23 — Pausa global do bot na Conta (WhatsApp)

- **Contexto:** Dono precisava silenciar o bot por algumas horas/dias sem pausar cliente a cliente.  
- **Decisão:** `Account.botPausedPermanent` + `botPausedUntil`; UI na seção Bot do WhatsApp (presets 1h/8h/24h/3d/7d/permanente). Webhook/simulador checam pausa da conta antes da pausa por cliente; **exceção:** telefone de `Employee` continua no bot operacional.  
- **Consequências:** `PUT /api/account` aceita os campos; migration `20260723140000_account_bot_pause`.  
- **Alternativas descartadas:** Só pausa por cliente; flag booleana sem timer.

---

## 2026-07-22 — Envio do link de senha do profissional via WhatsApp

- **Contexto:** Conta gerava link para copiar; faltava disparar pelo bot com instruções e CTA.  
- **Decisão:** `POST /api/employees/:id/send-password-link` emite token, zera senha e chama `WhatsappApiService.sendCtaUrl` (Meta `interactive/cta_url`; Uazapi tenta CTA em `/send/menu` e faz fallback para texto com o link). UI: botão no card do link e “Enviar link WhatsApp” no card do profissional.  
- **Consequências:** Requer telefone do profissional + WhatsApp da conta conectado.  
- **Alternativas descartadas:** Só texto sem CTA; e-mail (fora do escopo).

---

## 2026-07-22 — Tickets de suporte (conta + admin + profissional)

- **Contexto:** Estabelecimento precisa falar com a Sof; admin precisa ver abertos e responder; profissional também participa.  
- **Decisão:** Modelos `SupportTicket` + `SupportTicketComment` (status string `open|in_progress|resolved|closed`). Conta abre ticket; conta, profissional e admin comentam e mudam status. API produto com `TenantAuthGuard` (cookie/Bearer de conta **ou** profissional); admin em `admin-backend` `/api/tickets`. UI: aba Suporte no dashboard, portal profissional, Tickets no admin.  
- **Consequências:** Migration `20260722220000_support_tickets`; comentário do admin em ticket `open` promove para `in_progress`.  
- **Alternativas descartadas:** Só e-mail externo; chat em tempo real (SSE) nesta versão.

---

## 2026-07-22 — Rotas planas no admin-frontend (sem `[id]` irmão de lista)

- **Contexto:** No Expo Router web, rotas dinâmicas sob o mesmo shell (`accounts/index` + `accounts/[id]`) faziam a URL virar `/…/undefined` e a UI ficava em branco após login. `FlatList`+`gap` no RN Web também crashava.  
- **Decisão:** Rotas planas: `/accounts`, `/new-account`, `/edit-account`, `/plans`, `/new-plan`, `/edit-plan` (id via search params). Listas com `ScrollView`. Nav do shell sem `Link asChild`.  
- **Consequências:** URLs de detalhe mudam; docs atualizados.  
- **Alternativas descartadas:** Manter pastas `[id]` com workarounds de href.

---

## 2026-07-22 — Link de uso único para senha do profissional (2h)

- **Contexto:** Reset gerava senha temporária para a conta copiar; o profissional ainda precisava da “senha antiga” no 1º acesso.  
- **Decisão:** `EmployeePasswordToken` + endpoints públicos `GET/POST /api/employee-auth/password-setup`. Criar profissional ou `resetPassword` emite link `${PUBLIC_URL}/profissional/definir-senha?token=…` (uso único, 2h). A página mostra o e-mail de login; ao definir senha, marca o token usado, limpa `mustChangePassword` e devolve JWT (login automático). Reset invalida senha anterior (`passwordHash=null`).  
- **Consequências:** Conta só compartilha URL; seed demo continua com senha conhecida. `trocar-senha` autenticado permanece para troca voluntária / legado.  
- **Alternativas descartadas:** Manter senha temporária + troca forçada; magic link sem senha (fora do escopo).

---

## 2026-07-22 — Telefone no cadastro de conta e profissional

- **Contexto:** Conta e profissionais não tinham telefone próprio (só WhatsApp da instância e telefone de clientes).  
- **Decisão:** Campos `Account.phone`, `Employee.phone` e `CheckoutSession.phone` (dígitos, DDD; validação 10–15). Obrigatório no checkout, CRUD de profissionais, criação/edição no admin e editável em Conta.  
- **Consequências:** Contas/profissionais antigos ficam com `phone=""` até atualizar; formulários e APIs passam a exigir telefone em novos cadastros.  
- **Alternativas descartadas:** Reutilizar `whatsappPhoneNumberId` (é ID de instância, não telefone humano).

---

## 2026-07-22 — Painel admin separado (mesmo Postgres) + catálogo `Plan`

- **Contexto:** Operadores Sof precisavam listar/editar contas e criar/alterar planos na Stripe sem misturar isso no dashboard do tenant.  
- **Decisão:** Apps novos `admin-backend/` (Nest, porta 3011) e `admin-frontend/` (Expo web, 8091), **mesmo PostgreSQL**. Modelos `AdminUser` e `Plan` no schema do produto. Auth admin com JWT/`sof_admin_session` e `ADMIN_JWT_SECRET`. Criar/editar plano sincroniza Product/Price na Stripe (Prices imutáveis → novo Price + arquiva o anterior). Checkout do produto lê `Plan` via `PlansService` (`GET /api/plans` público); `FALLBACK_PLANS` só se a tabela estiver vazia.  
- **Consequências:** Migrations só em `backend/prisma/`; generator `adminClient` gera client em `admin-backend/node_modules/.prisma/client`. Seed cria admin (`SEED_ADMIN_*`) e upsert dos 3 planos. Deploy Heroku do admin ainda não provisionado.  
- **Alternativas descartadas:** Módulo admin dentro do `backend/` do produto (superfície de ataque maior); DB separado; só Dashboard Stripe (sem gestão de contas Sof).

---

## 2026-07-21 — Lembretes WhatsApp com job 30 min e timezone por conta

- **Contexto:** O bot prometia lembrete na confirmação, mas não havia envio. Precisávamos avisar o cliente antes do horário pela instância Uazapi da conta, 1× por agendamento, com antecedência configurável (padrão 2h).  
- **Decisão:** `Account.whatsappReminderMinutes` (0|60|120|180|360|1440; 0=off) + `Account.timezone` (IANA, default `America/Sao_Paulo`). Em `Appointment`: `reminderClaimedAt` / `reminderSentAt`. `RemindersModule` com `@nestjs/schedule` (`@Interval` 30 min + tick no bootstrap). Candidatos: `kind=service`, `confirmed`, telefone, ainda não enviados, conta ativa com instância conectada e lead > 0. `date`/`time` interpretados no fuso da conta; envia se `now ∈ [start−lead, start)`. Claim SQL atômico antes do `sendText`; em falha libera claim para retry; sucesso grava `reminderSentAt`. UI na Conta (chips de antecedência + dropdown de fuso). Copy do bot/marketing alinhada ao WhatsApp (não SMS).  
- **Consequências:** Precisão de até ~30 min após o horário estimado; multi-dyno coberto pelo claim; risco residual raro de duplicata se a Uazapi aceitar o envio e o processo cair antes de persistir `reminderSentAt` (sem idempotency key na API).  
- **Alternativas descartadas:** Worker Heroku separado (complexidade sem ganho no MVP); Redis/Bull (add-on extra); SMS (canal diferente do bot); fuso só no servidor UTC (quebra horários BR).

## 2026-07-21 — Escalonamento humano com pausa por resposta no WhatsApp

- **Contexto:** Quando o bot não resolve (cliente pede atendente ou o bot repete "não entendi"), o dono não ficava sabendo e o bot continuava atrapalhando a conversa se um humano assumisse.  
- **Decisão:** Novo modelo `WhatsappHandoff` (1 alerta aberto por telefone) + `Client.botUnresolvedCount` + `Account.whatsappHandoffThreshold` (1|2|3|5, default 2). Pedido explícito por humano (regex estrita + intent `human` do NLU) abre alerta imediato; N "não entendi" seguidos abrem por contagem — intents `cancel`/`list`/`book` continuam no bot. Alertas aparecem na aba **Atendimentos** (badge SSE na tabbar, link para WhatsApp Web/`wa.me`). Detecção de resposta humana: webhook Uazapi passa a receber `fromMe` (exclui só `wasSentByApi` + grupos); mensagem `fromMe` não-API pausa o bot 1 h (`botPausedUntil`), zera contador e resolve o alerta. `GET /account/whatsapp/status` ressincroniza a config do webhook (máx. 1x/h por instância) para cobrir instâncias pareadas antes da mudança.  
- **Consequências:** Todo envio manual do dono pelo WhatsApp silencia o bot por 1 h naquela conversa (comportamento desejado); mais eventos de webhook (`fromMe`) para processar; cliente recebe aviso "avisei a equipe" quando o alerta abre.  
- **Alternativas descartadas:** Detectar humano via app próprio (não existe inbox no painel); pausar bot permanente na resposta humana (dono teria que reativar manualmente); webhook separado para eventos `fromMe` (complexidade sem ganho).

## 2026-07-21 — NLU com LLM para frases livres no bot

- **Contexto:** Áudios transcritos chegavam como frases corridas ("quero marcar um corte amanhã ao meio-dia") e o fluxo guiado só entendia opções exatas de menu, respondendo "Não entendi".  
- **Decisão:** Novo `BookingNluService` (OpenAI `gpt-4o-mini`, JSON estrito, timeout 10s) extrai intenção (book/cancel/list), `serviceId`, data e hora. Chamado só em frases livres (≥ 3 palavras) nas etapas `start` e `awaiting_service`; o resultado reaproveita o fluxo existente (`proceedWithSlot`, `timeMenu`, `pathMenu`), mantendo validação de expediente e conflito. Falha do LLM ou frase vaga → fluxo guiado normal.  
- **Consequências:** Usa a mesma `OPENAI_API_KEY` da transcrição; custo por mensagem ínfimo; mais uma chamada externa no caminho de mensagens livres.  
- **Alternativas descartadas:** Matching heurístico de substring (frágil para variações); LLM em todas as etapas do fluxo (mais custo/latência sem ganho claro).

## 2026-07-21 — Transcrição de áudio no bot WhatsApp (Uazapi nativo)

- **Contexto:** Clientes mandam áudio no WhatsApp; o bot só processava texto e botões, ignorando `audio`/`ptt`.  
- **Decisão:** Com `WHATSAPP_PROVIDER=uazapi`, detectar áudio no webhook, chamar `POST /message/download` com `transcribe: true` e tratar `transcription` como mensagem de texto no fluxo existente. Chave `OPENAI_API_KEY` no servidor (Uazapi usa Whisper; pode persistir na instância). Sem chave ou falha → resposta pedindo texto/botões.  
- **Consequências:** Custo baixo por áudio curto (~US$ 0,006/min); Meta Cloud API continua sem áudio; dedupe por `messageId` antes de transcrever evita cobrança duplicada em retries do webhook.  
- **Alternativas descartadas:** Groq/Whisper direto no backend (mais barato, mais código); responder só “mande em texto”; transcrição só no simulador.

## 2026-07-20 — Agenda responsiva no celular

- **Contexto:** A grade profissional × 7 dias forçava scroll horizontal e células estreitas no mobile.  
- **Decisão:** Abaixo de 720px, agenda do painel e do profissional usam chips de dia + lista vertical do dia selecionado; desktop mantém a grade/colunas.  
- **Consequências:** Menos overview da semana inteira de uma vez no celular; troca de dia é explícita.  
- **Alternativas descartadas:** Só zoom/scroll na grade; agenda diária sem chips da semana.

## 2026-07-20 — Menu WA: ver/cancelar se há agendamento futuro

- **Contexto:** Cliente que já tinha horário marcado só via serviços de novo; não havia caminho no bot para consultar ou cancelar.  
- **Decisão:** No cumprimento, se existirem agendamentos `confirmed` futuros do cliente, o menu inclui os serviços + **Ver agendamentos** + **Cancelar horário**. Sem futuro, só serviços. Cancelamento com confirmação Sim/Não e soft-cancel (`status=cancelled`) + SSE.  
- **Consequências:** Steps `awaiting_cancel_pick` / `awaiting_cancel_confirm`; comando global `cancelar` continua reiniciando a conversa (não cancela horário).  
- **Alternativas descartadas:** Menu separado Agendar/Gerenciar antes dos serviços; cancelar sem confirmação.

## 2026-07-20 — Fluxo WA: dia e horário em duas perguntas

- **Contexto:** Listar slots misturados de vários dias (ex. “Hoje 15:00”, “Amanhã 10:00”) deixava a escolha densa e pouco clara.  
- **Decisão:** Escolha em duas etapas: (1) **Hoje / Amanhã / Outra data** — Hoje e Amanhã só aparecem se houver ao menos 1 vaga; Outra data pede `dd/mm`; (2) até **5 horários** livres daquele dia + **Outro horário** (`hh:mm`). Steps `awaiting_day`, `awaiting_custom_date`, `awaiting_time`, `awaiting_custom_time`. Sessões antigas `awaiting_slot` / `awaiting_custom_datetime` redirecionam para o menu de dia.  
- **Consequências:** Fluxo mais longo em mensagens, mas menus menores e mais previsíveis; aceita atalho `dd/mm hh:mm` em vários steps.  
- **Alternativas descartadas:** Manter lista única de slots multi-dia; calendário com muitos dias sugeridos.

## 2026-07-20 — Fluxo WA: profissional ou horário após o serviço

- **Contexto:** Só horário → profissional escondia a preferência por um profissional; só profissional → horário não deixava o cliente priorizar disponibilidade.  
- **Decisão:** Após o serviço, menu com profissionais do serviço e, por último, **Escolher horário**. Caminho profissional → slots só desse profissional → confirmação. Caminho horário → slots de qualquer um → profissionais livres naquele horário + **Deixa a Sof escolher** (`emp:auto`, pega o primeiro livre) → confirmação. Se só 1 profissional livre no slot, confirma direto.  
- **Consequências:** Novo step `awaiting_path`; `awaiting_slot` / custom preservam `employeeId` quando já escolhido; menu de profissionais no caminho horário-primeiro inclui Sof.  
- **Alternativas descartadas:** Manter só horário → profissional; forçar sempre profissional antes do horário sem atalho.

## 2026-07-17 — Endereço da conta no painel e no bot

- **Contexto:** Cliente pergunta onde fica o salão; a conta precisava cadastrar endereço depois do signup.  
- **Decisão:** Campo `Account.address` (string opcional); edição na aba Conta; bot responde a “endereço/onde fica/como chegar”, inclui no cumprimento e na confirmação do agendamento.  
- **Consequências:** Contas sem endereço recebem mensagem pedindo para tentar depois; seed demo preenche um endereço de exemplo.  
- **Alternativas descartadas:** Endereço só no checkout; pin de mapa obrigatório.

## 2026-07-17 — Pausar bot WhatsApp por cliente

- **Contexto:** Dono precisa falar manualmente com um cliente sem o bot interferir, às vezes só por algumas horas.  
- **Decisão:** Campos `Client.botPausedPermanent` e `botPausedUntil`; UI na edição do cliente com presets (1h/8h/24h/7d) ou permanente; webhook/simulate silenciam se pausado (`isClientBotPaused`).  
- **Consequências:** Mute só para telefone já cadastrado como `Client`; sem auto-reply de “bot desativado”.  
- **Alternativas descartadas:** Mute global da conta; mensagem automática ao cliente; mute só na sessão WhatsApp sem flag no Client.

## 2026-07-17 — Fluxo WA: serviço → horário → profissional

- **Contexto:** Escolher profissional antes do horário forçava o cliente a decidir sem ver disponibilidade real.  
- **Decisão:** Novo fluxo: serviço → slots próximos (qualquer profissional do serviço livre) ou horário customizado → lista só profissionais disponíveis naquele slot → confirmação. Se só 1 profissional livre, pula direto para confirmar.  
- **Consequências:** Steps `awaiting_slot` / `awaiting_custom_datetime`; sessões antigas em `awaiting_datetime`/`awaiting_employee` sem data são redirecionadas.  
- **Alternativas descartadas:** Manter profissional primeiro; calendário de dias separados sem slots.

## 2026-07-17 — Botões/listas no bot WhatsApp

- **Contexto:** Escolhas eram só lista numerada em texto; no celular é mais natural tocar em botões.  
- **Decisão:** Enviar menus interativos (Uazapi `/send/menu`, Meta `interactive`): botões se ≤3 opções, lista se >3; webhook aceita id do botão/lista; números e título continuam como fallback (simulador).  
- **Consequências:** Confirmação usa Sim/Não em botões; se o envio do menu falhar, cai para texto numerado.  
- **Alternativas descartadas:** Só texto; só botões (quebraria com muitos serviços).

## 2026-07-17 — Eventos livres + recorrência materializada

- **Contexto:** A agenda só permitia atendimento com serviço/cliente; faltava bloquear horário com título livre (almoço, médico) e repetir agendamentos.  
- **Decisão:** `Appointment.kind` (`service` | `block`); em `block`, `serviceId`/cliente opcionais, `title` + `durationMinutes` obrigatórios, sem validação de expediente; recorrência diária/semanal/mensal materializa até 52 linhas com `recurrenceGroupId`; editar = 1 ocorrência; delete com `?scope=series` remove a série.  
- **Consequências:** Conflito de agenda usa `durationMinutes ?? service.duration`; faturamento ignora `block`; SSE emite um evento por ocorrência criada.  
- **Alternativas descartadas:** Modelo separado de “Block”; RRULE expandido só na leitura (mais complexo para conflito/UI).

## 2026-07-17 — Senha no checkout + agenda após pagamento

- **Contexto:** Conta era criada com senha temporária gerada; o retorno do Stripe mostrava credenciais e mandava para o login.  
- **Decisão:** Campo senha no modal de assinatura (hash na `CheckoutSession`); provisionamento usa essa senha; `GET /checkout/status` devolve JWT na 1ª leitura e o front entra direto em `/(dashboard)/agenda`.  
- **Consequências:** Coluna `tempPassword` renomeada para `passwordHash`; sem exibir senha na UI de retorno.  
- **Alternativas descartadas:** Manter senha gerada + tela de credenciais; login automático via e-mail/senha em plaintext na sessão.

## 2026-07-16 — Deduplicação de webhook Uazapi

- **Contexto:** Uazapi POSTava o mesmo evento em pares (~1 ms); bot respondia duas vezes. Possível empilhamento de webhooks sem `action: replace`.  
- **Decisão:** Ignorar eventos repetidos por `message.id` (fallback fingerprint); configurar webhook com `action: 'replace'`.  
- **Consequências:** Em multi-dyno a dedupe em memória não é compartilhada — ok com 1 dyno Heroku.  
- **Alternativas descartadas:** Persistência Redis só para dedupe.

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
