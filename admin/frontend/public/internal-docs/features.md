# Features — Sof

Documento vivo. Atualize quando alterar comportamento de produto ou contratos de API.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produto (visão)

Sof ajuda negócios a:

1. Receber agendamentos pelo **WhatsApp** (conversa guiada).  
2. Ver a **semana** de todos os profissionais num painel.  
3. Gerir **equipe**, **cardápio de serviços** e **faturamento**.  
4. Assinar planos via **Stripe** (ou fluxo demo).

**Onboarding do cliente (com prints):** [`onboarding-cliente.md`](onboarding-cliente.md) · HTML: [`guides/onboarding-cliente.html`](guides/onboarding-cliente.html).  
**Bot WhatsApp (cliente + profissional):** [`guides/bot-whatsapp.html`](guides/bot-whatsapp.html).  
**Funções por plano:** [`planos-funcoes.md`](planos-funcoes.md) · [`plano-solo.html`](guides/plano-solo.html) · [`plano-equipe.html`](guides/plano-equipe.html) · [`plano-rede.html`](guides/plano-rede.html).

## Site institucional (marketing)

| Feature | Tela | Notas |
|---------|------|--------|
| Landing | `/` | Hero (“negócio”), chat mock Sof; “A partir de R$ …” = menor preço de `GET /api/plans` (fallback Solo) |
| Planos | `/pricing` | Solo / Equipe / Rede; CTA abre checkout |
| Quem somos | `/about` | Valores Leveza / Confiança / Proximidade |
| Entrar | `/login` | Conta ou profissional (mesmo formulário) → painel / agenda |
| Esqueci senha | `/forgot-password` | Conta ou profissional; e-mail + WhatsApp (se disponível); link 2h |
| Definir senha (conta) | `/set-password?token=` | Reset da conta dona |
| Definir senha (prof) | `/employee/set-password?token=` | Convite/reset do profissional |
| Nav / footer | global | Wordmark `sof`, CTAs; menu mobile abaixo de 860px |

Copy e tokens devem permanecer alinhados à marca Sof (verde floresta + cobre, fundos claros). Auth usa `SofAuthCard`; painel usa `SofPageHeader` / `SofCard` / `SofEmptyState`. Tabbar do painel: ícone + label por aba (`DashboardTabIcon`).

## Checkout e assinatura

| Feature | Onde | API |
|---------|------|-----|
| Escolher plano | modal no pricing / home flow | — |
| Criar sessão | CheckoutModal (nome, e-mail, telefone, senha) com validação por campo no front | `POST /api/checkout/create` |
| Retorno Stripe | `/checkout-return?ref=` | `GET /api/checkout/status/:sessionId` → JWT + agenda |
| Webhook pagamento | backend | `POST /api/payments/webhook` |
| Pós-pagamento | auto-login | token na 1ª consulta de status; redireciona `/(dashboard)/agenda` |

Sem `STRIPE_SECRET_KEY`: modo **demonstração** (não cobra de verdade) — provisiona na hora e já entra na agenda.

A senha é definida no modal (mín. 8 caracteres), armazenada só como hash na `CheckoutSession` até o provisionamento; não há mais senha temporária gerada. O checkout também exige **telefone** (DDD, 10–15 dígitos). No front, nome/e-mail/telefone/senha são validados por campo (borda + mensagem) antes do POST — alinhado às regras do backend. Em **nova conta**, após provisionar, a API envia e-mail de **boas-vindas** (`MailService`, SMTP) com link de login.

### Cupons promocionais

| Feature | Onde | API |
|---------|------|-----|
| Criar cupom (plano + 7/30/60 dias + máx. usos) | Admin `/coupons`, `/new-coupon` | `POST /api/coupons` |
| Usar no signup (pula Stripe) | CheckoutModal campo cupom | `POST /api/checkout/create` + `couponCode` → `mode: promo-approved` |
| Renovar / mudar plano (pago) | `/(dashboard)/choose-plan` | `POST /api/billing/checkout` |
| Aplicar outro cupom (conta logada) | choose-plan | `POST /api/billing/redeem-coupon` |
| Expiração | job 15 min + lazy no login/`me` | `Account.status = paused` |
| Tela obrigatória pós-expiração | redirect no shell do dashboard | `account.needsPlanSelection` |
| Alterar plano (conta ativa) | Conta → “Alterar plano” → `ChoosePlanModal` | mesma API de `choose-plan` |

Cupom amarra um **plano** e N dias grátis; `maxUses` é o teto global; cada conta só pode resgatar o mesmo código uma vez. Conta promo: `billingSource=promo`, `promoExpiresAt`. Ao vencer → `paused` e UI de escolha de plano (Stripe ou novo cupom). Pagamento Stripe em conta existente limpa promo e seta `billingSource=paid`.

Planos: tabela `Plan` (seed + painel admin); marketing consome `GET /api/plans`. Fallback em `common/plans.ts` / `CheckoutModal` (Solo R$139 / Equipe R$199 / Rede R$259) se a API/DB estiver vazia. Assinatura mensal Stripe; Payment Links em `paymentLinkUrl`. Apagar plano no admin desativa o Payment Link e remove/arquiva o Product na Stripe via API.

### Gate por plano (entitlements)

Cada plano tem `entitlements` configuráveis no admin (matriz boolean/limite). Login e `GET /api/auth/me` devolvem `account.entitlements`. Backend bloqueia com 403 (`PLAN_FEATURE_REQUIRED` / `PLAN_LIMIT_REACHED`). Front esconde Faturamento/Atendimentos, recorrência, lembretes, pausa do bot, etc., conforme o mapa. Limite de profissionais enforced em `POST /api/employees`.

Keys stub (existem no catálogo, feature incompleta): `maxWhatsappNumbers` (ainda 1 número por conta), `clientReschedule` (remarcar no WhatsApp — backlog; cliente agenda/cancela). `supportPriority` é só badge na UI de tickets.

## Painel admin Sof (plataforma)

Superfície interna (não é o dashboard do tenant). Apps `admin/frontend` + `admin/backend`.

| Feature | UI | API |
|---------|-----|-----|
| Login admin | `/login` | `POST /api/auth/login` |
| Listar / buscar contas | `/accounts` | `GET /api/accounts?q=&planId=` |
| Criar conta manual | `/accounts/new` | `POST /api/accounts` |
| Editar conta / plano / status | `/edit-account` | `PUT /api/accounts/:id` |
| Ops WhatsApp (Uazapi) | `/edit-account` (seção WA) | `GET/POST /api/accounts/:id/whatsapp*` |
| Resetar senha | detalhe da conta | `POST /api/accounts/:id/reset-password` |
| Listar planos (com contagem de contas) | `/plans` | `GET /api/plans` (`accountCount`) |
| Criar / editar / apagar plano (+ Stripe Product/Price/Payment Link) | `/new-plan`, `/edit-plan` | `POST/PUT/DELETE /api/plans` |
| Contas de um plano | `/edit-plan` + filtro `/accounts?planId=` | `GET /api/accounts?planId=` |
| Sincronizar plano com Stripe (Price + Payment Link = preço Sof) | botão em `/edit-plan` | `POST /api/plans/:id/sync-stripe` |
| Cupons promocionais (7/30/60 dias) | `/coupons`, `/new-coupon`, `/edit-coupon` | `GET/POST /api/coupons`, `PUT/DELETE /api/coupons/:id` |
| Contas que usaram um cupom | `/edit-coupon` (seção Usos) | `GET /api/coupons/:id` (`redemptions`) |
| Guias públicos (onboarding + bot WA + planos) | `/guides` (+ HTML em `public/guides/`) | sem auth |
| Documentação interna (MD vivo) | `/docs`, `/docs/[slug]` (nav **Docs**) | auth admin; sync `docs/*.md` → `public/internal-docs/` |
| Tickets de suporte (lista) | `/tickets` | `GET /api/tickets` (default abertos/em andamento) |
| Ticket detalhe / comentários / status | `/edit-ticket` | `GET/POST/PATCH /api/tickets/:id…` |

Seed: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (default `admin@sof.com`).

## Painel (dashboard)

Shell: topbar (negócio + email + Sair) + abas horizontais com **ícone + label** por seção (Agenda, Profissionais, Serviços, Clientes, Atendimentos, Faturamento, Conta).

### Agenda

- **Desktop (≥720px):** grade semanal por profissional × dia (**Separada**) ou uma linha com todos os horários (**Unificada**).  
- **Celular (<720px):** seletor de dia (chips Dom–Sáb) + lista por profissional (**Separada**) ou lista única do dia com nome do profissional (**Unificada**).  
- Toggle **Separada / Unificada** na toolbar (preferência em `localStorage`).  
- Cards de horário **não mostram preço** (só horário, cliente/serviço; na unificada, também o profissional).  
- Navegação: semana anterior / hoje / próxima.  
- Clique numa célula (ou “+ Agendar”) abre o modal; clique num horário edita.  
- **Recolher / expandir** (desktop, modo Separada) no final de cada linha do profissional; recolhido mostra só o 1º horário do dia e `+N` se houver mais.  
- Modal com dois tipos:
  - **Serviço** — cliente + serviço + profissional (como antes).
  - **Evento / bloqueio** — título livre (almoço, médico, etc.), duração e horário livres; sem cliente/serviço; ocupa a agenda do profissional (conflito).
- **Recorrência** na criação (serviço ou evento): diário / semanal / mensal até uma data (máx. 52 ocorrências); editar altera só a ocorrência; excluir pode ser “só esta” ou “série inteira” (`?scope=series`).  
- Empty state se não houver profissionais.  
- Página **Simulador WhatsApp** em `/(dashboard)/simulator` (`noindex`, fora das tabs) — telefone + mensagem → `POST /api/whatsapp/simulate`. Botão na Conta (seção WhatsApp) só se o dispositivo ainda não estiver conectado; a rota continua acessível pela URL.  
- Toast + grade atualizam em tempo real via SSE.
- Faturamento ignora eventos `kind=block` (preço 0).
- **Status:** `scheduled` (ocupa slot) → `completed` (libera slot; badge “Concluído”) ou `cancelled`. Auto-conclusão quando a hora de fim chega (job a cada 5 min). Conta pode marcar concluído a qualquer momento (`POST /api/appointments/:id/complete`); profissional só na janela do atendimento.

### Profissionais

- Listagem em cards (cor de identificação; telefone com máscara na UI).  
- CRUD: adicionar / **editar** / remover.  
- Criação e edição abrem em **modal** (mesmo padrão da agenda: overlay + Salvar / Fechar).  
- Form front: máscara de telefone `(11) 99999-8888` + validação por campo (nome, telefone 10–15 dígitos, e-mail, ≥1 serviço) antes do POST/PUT.  
- Campos: nome, **telefone**, **e-mail de acesso**, **cor na agenda** (presets + seletor nativo `input type=color` na web / hex no nativo; API aceita qualquer `#RGB`/`#RRGGBB`) e **um ou mais serviços** do cardápio (obrigatório).  
- Se a conta **não tem serviços**, “Adicionar Profissional” redireciona para Serviços com o formulário de criação aberto (`?create=1`); após salvar o primeiro serviço, volta para Profissionais.  
- Ao criar (ou resetar senha), o painel gera um **link de uso único** (válido 2h) para o profissional definir a senha em `/employee/set-password?token=…` — sem senha antiga; após salvar, login automático. A página mostra o e-mail de login.  
- **Enviar no WhatsApp:** `POST /api/employees/:id/send-password-link` gera (ou regenera) o link, invalida a senha atual e envia **somente pelo WhatsApp** da conta (não por e-mail). Exige telefone do profissional e WhatsApp conectado.  
- **Self-service:** o profissional também pode pedir o link — ver área do profissional e bot WhatsApp.
- `PUT /api/employees/:id` substitui nome, e-mail, telefone, cor e a lista de serviços (`resetPassword` opcional → novo link).  
- No modal de agendamento e no WhatsApp, só aparecem profissionais que realizam o serviço escolhido.

### Área do profissional

- Login unificado em `/login` (`POST /api/auth/login` ou `/api/employee-auth/login` conforme o e-mail).  
- **Esqueci a senha:** `/forgot-password` (link em `/login`) → `POST /api/auth/request-password-reset` (público, throttle). Resolve conta ou profissional pelo e-mail; envia link por **e-mail** e/ou **WhatsApp** (best-effort). Conta: `/set-password?token=`; profissional: mesmo fluxo legado em `/employee/set-password` (ou via endpoint employee). Resposta sempre genérica.
- **Definir senha (convite/reset profissional):** `/employee/set-password?token=` — `GET/POST /api/employee-auth/password-setup` (público; token SHA-256, TTL 2h, uso único).
- **Definir senha (conta):** `/set-password?token=` — `GET/POST /api/auth/password-setup`.
- Portal `/(employee)/agenda`: agendamentos `scheduled` e `completed` daquele profissional; no celular, chips de dia + lista do dia; no desktop, colunas da semana.
- Pode **marcar como concluído** (`POST /api/employee/appointments/:id/complete`) **somente dentro da janela** [início, fim] do atendimento; conclusão antecipada libera o restante do slot.  
- Pode **cancelar** (`POST /api/employee/appointments/:id/cancel` → `status=cancelled`).  
- Se `mustChangePassword` (legado), redireciona para `/(employee)/change-password` (exige senha atual).

### Serviços

- Cardápio (nome, duração, preço).  
- CRUD: adicionar / **editar** / remover (`PUT /api/services/:id`).  
- Criação e edição em **modal** (padrão agenda).  
- Copy: “Configure seu cardápio de serviços”.

### Clientes

- Listagem em cards (nome + telefone formatado).  
- CRUD: adicionar / editar / remover.  
- Criação e edição em **modal** (padrão agenda).  
- Form front (aba Clientes e cadastro rápido no `ClientPicker` da agenda): máscara `(11) 99999-0000` + validação por campo (nome, telefone 10–15 dígitos).  
- Na **edição**: pausar o bot WhatsApp para aquele cliente — **Bot ativo**, timer (1 h / 8 h / 24 h / 7 dias) ou **Permanente**.  
- Badge na lista: **Bot off** (permanente) ou **Bot pausado até …** (temporário).  
- Enquanto pausado, o webhook **não responde** (silêncio). Só vale para `Client` cadastrado (mesmo telefone da conversa).

### Atendimentos (escalonamento humano)

- Aba **Atendimentos** na tabbar (ícone + label; badge vermelho com alertas abertos em tempo real via SSE).  
- Alerta abre quando: (a) o interlocutor **pede atendente explicitamente** (regex + intent `human` do NLU) — imediato; ou (b) o bot responde "não entendi" **N vezes seguidas** (default 2; configurável na aba: 1 / 2 / 3 / 5, salvo em `Account.whatsappHandoffThreshold`). Vale para **cliente** e **profissional**.  
- Cada card mostra badge **Cliente** (azul) ou **Profissional** (lilás), nome/telefone, motivo (Pediu atendente / Bot não entendeu), última mensagem e desde quando; botões **Abrir no WhatsApp** (WhatsApp Web no navegador, `wa.me` no celular) e **Marcar resolvido**.  
- Quando o alerta abre, a pessoa recebe no WhatsApp: "Avisei a equipe — alguém vai te responder por aqui em breve."  
- **Resposta humana** (mensagem `fromMe` que não veio da API — celular ou WhatsApp Web): em **cliente**, pausa o bot **1 h** (`Client.botPausedUntil`), zera o contador e resolve o alerta; em **profissional**, só resolve o alerta e zera `Employee.botUnresolvedCount` (sem pausar o bot operacional).  
- Intents `cancel`/`list`/`book` do NLU (cliente) e intents operacionais do prof continuam pelo bot — só o pedido explícito por humano escala na hora.  
- Modelo: `WhatsappHandoff.party` (`client` | `employee`) + `employeeId` opcional.  
- API: `GET /api/whatsapp-handoffs` (`?status=open|resolved`), `GET/PUT …/settings`, `POST …/:id/resolve`. SSE: `whatsapp-handoff:opened|updated|resolved`.

### Faturamento

- Cards: Hoje / Esta Semana / Este Mês / **Ticket Médio (mês)** (`scheduled` + `completed`; ticket = receita do mês ÷ nº de agendamentos).  
- Lista “Agendamentos” (serviço; ignora `block`).  
- Copy: “Acompanhe a receita de seus serviços”.

### Conta

Layout em duas colunas em telas ≥ 900px (`maxWidth` ~1040, gap uniforme por coluna): **esquerda** Estabelecimento → Assinatura → Lembretes (se entitlement) → Ajuda; **direita** Horário → WhatsApp. Em mobile, uma coluna na mesma ordem visual (Estabelecimento, Horário, Assinatura, WhatsApp…). E-mail fica só no header do painel; status do WhatsApp só no card WhatsApp. Logout só no header do painel (não há card “Sair da conta” nesta tela).

- **Estabelecimento (resumo):** logo + nome + responsável + telefone + endereço (somente leitura) + `SofIconAction` editar → `EstablishmentModal` (logo upload/remoção web, telefone, endereço). `PUT /api/account` com `logoBase64` / `phone` / `address`. Logo: data URL, máx. 5 MB (front comprime); aparece no header do painel e do portal profissional.
- **Horário:** pills Dom–Sáb + preview `formatHoursSummary` + editar → `OpeningHoursModal` (`HH:mm` por dia). `PUT /api/account` com `openingHours`. Sem editor inline na página.
- **Assinatura:** plano + preço + desde (+ promo se houver); CTA “Alterar plano” abre `ChoosePlanModal` (cupom + catálogo / checkout Stripe). A rota `/(dashboard)/choose-plan` permanece para conta pausada / `needsPlanSelection`.
- **Bot WhatsApp (Uazapi):** cards de status servidor/dispositivo. Se o dispositivo não estiver pareado, o **QR abre sozinho** (sem botão “Escanear”) e **renova automaticamente** (~45s ou quando o status deixa de trazer QR). Alternativa: “Usar código” com telefone. Poll `GET …/status` detecta conexão; `POST …/disconnect` despareia. Token da instância fica só no servidor.
- **Pausa do bot (conta):** só aparece com WhatsApp conectado (+ entitlement `botPause`). Badge Ativo/Pausado/Desligado + presets (**Bot ativo**, 1 h / 8 h / 24 h / 3 dias / 7 dias ou **Permanente**). Enquanto pausado, o webhook **não responde a clientes** (`Account.botPausedPermanent` / `botPausedUntil`). Profissionais com telefone cadastrado continuam no fluxo operacional. Pausa por cliente continua na aba Clientes.
- **Lembrete WhatsApp:** só aparece com WhatsApp conectado (+ entitlement `reminders`). Antecedência (`Desativado` / `1h` / `2h` default / `3h` / `6h` / `24h`) e fuso horário (lista expansível); `PUT /api/account` com `whatsappReminderMinutes` + `timezone`. Job a cada 30 min envia no máximo 1 lembrete por agendamento confirmado pela instância conectada.
- **Suporte:** botão “Abrir suporte” (seção Ajuda) → `/(dashboard)/support`.

### Suporte

- Em **Conta → Abrir suporte** (não há mais aba no menu): abrir ticket (`title` + `description`), listar, comentar e mudar status (`open` | `in_progress` | `resolved` | `closed`). Rota `/(dashboard)/support` com botão “Voltar à Conta”.
- Portal do profissional: ver tickets da conta, comentar e mudar status (não abre ticket novo).
- Admin Sof: lista (filtro abertos por padrão), detalhe, responder e status.
- API produto: `GET/POST /api/tickets`, `GET /api/tickets/:id`, `POST …/comments`, `PATCH …/status` — `TenantAuthGuard` (conta **ou** profissional).

## WhatsApp (bot)

Provedor padrão: **Uazapi** (`WHATSAPP_PROVIDER=uazapi` se omitido).

Com Uazapi (`WHATSAPP_BASE_URL` + `WHATSAPP_ADMIN_TOKEN` **ou** `WHATSAPP_TOKEN` de instância):

- Pareamento no painel Conta (QR ou código com telefone).  
- Ao conectar, a API configura o webhook da instância para `API_PUBLIC_URL/api/whatsapp/webhook`.  
- Webhook `GET/POST /api/whatsapp/webhook`.  

### Voz / persona
- A Sof fala com a persona definida em [`docs/brand.md`](brand.md): leve, confiante, calma e sofisticada (sem emoji, poucas exclamações).  
- Copy canônica em `saas/backend/src/whatsapp/bot-copy.ts` (cliente, profissional, lembrete, aviso ao prof, fallbacks de áudio/handoff).  
- Apresentação: “Aqui é a Sof, do {businessName}.” Confirmação: “Marcado.” Avanço: “Certo: …”. Mal-entendido: “Não entendi.” + próxima ação.  
- Gates de plano **não** aparecem na copy do WhatsApp (nem “não incluso no plano”); a Sof só redireciona (“prefiro texto”, “use o painel ou o portal”).  
- Inventário de strings: [`bot-messages.md`](bot-messages.md).

### Fluxo do cliente
- Fluxo: **serviço → profissional** (lista quem faz o serviço) **ou “Escolher horário”** → **dia** (Hoje / Amanhã / Outra data) → **horário** (até 5 do dia ou “Outro horário”) → (se horário primeiro) profissional disponível + **“Deixa a Sof escolher”** → confirmação → `Appointment` (`source=whatsapp`).  
- **1º contato:** se o telefone ainda não é `Client`, pede **nome e sobrenome** (mín. 2 palavras) antes do menu de serviços.  
- **Menu inicial:** se o cliente já tem agendamento **futuro** (`scheduled`), além dos serviços aparecem **Ver agendamentos** e **Cancelar horário**; sem futuro, só a lista de serviços. Cancelar pede confirmação (Sim/Não) e marca `status=cancelled` (SSE `appointment:updated`).  
- **Caminhos:** após o serviço, o bot lista os profissionais do serviço e, por último, **Escolher horário**. Se o cliente escolhe um profissional, os dias/horários são só dele. Se escolhe horário primeiro, depois pergunta quem está livre naquele slot (com opção da Sof escolher). Matching por texto aceita nome parcial, sem acento e título truncado do WhatsApp; no menu o botão usa o 1º nome quando é único.  
- **Dia e horário (duas perguntas):** 1) Hoje, Amanhã (só se houver vaga) ou Outra data (`dd/mm`); 2) até 5 horários livres daquele dia + **Outro horário** (`hh:mm`).  
- **Menus interativos:** escolhas de serviço (com **preço**), caminho/profissional, dia, horário e confirmação (Sim/Não) vão como **botões** (até 3 opções) ou **lista** (mais de 3) via `POST /send/menu` (Uazapi) / `interactive` (Meta). Números e texto continuam válidos (simulador e fallback).  
- **Comandos:** `/reset` ou `reset` (e `cancelar`) reinicia a sessão; perguntas de **endereço** / “onde fica” / “como chegar” devolvem `Account.address` (se cadastrado).  
- **Áudio (Uazapi):** mensagens de voz (`audio` / `ptt`) são transcritas via `POST /message/download` (`transcribe: true`) e tratadas como texto no mesmo fluxo. Exige `OPENAI_API_KEY` no servidor (Whisper via Uazapi); sem chave ou se a transcrição falhar, o bot pede para escrever ou usar os botões.  
- **Frases livres (NLU):** com `OPENAI_API_KEY`, frases corridas (≥ 3 palavras) no início da conversa ou na escolha de serviço passam por um extrator LLM (`gpt-4o-mini`, JSON) que identifica intenção (marcar/cancelar/ver), serviço, data e hora — ex. "quero marcar um corte amanhã ao meio-dia" pula direto para a confirmação. Falha ou frase vaga caem no fluxo guiado normal (`whatsapp/booking-nlu.service.ts`).  
- **Endereço:** se cadastrado em Conta, o bot responde a perguntas (“onde fica” / endereço) e inclui na **confirmação** do agendamento (e no lembrete). **Não** entra na saudação.  
- **Pausa por cliente:** `Client.botPausedPermanent` / `botPausedUntil` — dono desativa na aba Clientes; webhook e simulador ignoram a conversa enquanto pausado.  
- **Pausa da conta:** `Account.botPausedPermanent` / `botPausedUntil` — Conta → Bot do WhatsApp; silencia o bot para **clientes** até a data ou até reativar (profissionais cadastrados continuam no fluxo operacional).  
- **Escalonamento humano:** pedidos explícitos por atendente ou N "não entendi" seguidos abrem alerta na aba **Atendimentos**; resposta humana pelo WhatsApp pausa o bot **1 h** para aquele cliente (`Client.botPausedUntil`), zera o contador e resolve o alerta (ver seção Atendimentos acima).  
- **Lembrete automático:** se `whatsappReminderMinutes > 0` e a instância está conectada, um job a cada 30 min avisa o cliente no WhatsApp antes do horário (1× por agendamento; fuso = `Account.timezone`). A confirmação do bot só promete lembrete quando a antecedência está ativa.  
- **Aviso ao profissional:** ao criar agendamento `kind=service` (bot do cliente ou painel da conta), a conta envia WhatsApp ao telefone do profissional (`EmployeeBookingNotifyService`) com cliente, serviço e horário. Não envia se o próprio profissional criou (portal/bot operacional), se WhatsApp da conta estiver desconectado, ou se o telefone do prof for inválido. Falha de envio só no log — não bloqueia o agendamento.  
- **Expediente:** só aceita data/hora em dias abertos e com o serviço cabendo no intervalo configurado em Conta.  
- **Conflito de agenda:** só mostra profissionais livres no horário; na confirmação há checagem de novo (corrida entre clientes) e, se necessário, volta à escolha de horário.  
- Create/update na API de appointments aplicam expediente + conflito (painel e bot).

### Fluxo do profissional
- Se o remetente casa com o **telefone** de um `Employee` da conta (exato ou sufixo BR com/sem DDI `55`), o bot **não** usa o fluxo de cliente — `WhatsappEmployeeBotService` (steps `emp:*`).  
- Menu: **Concluir agendamento** (só se o prof estiver na janela de um atendimento) | **Agenda de hoje** | **Agenda de outro dia** | **Novo na agenda** (pergunta: agendamento de cliente ou evento) | **Cancelar horário** | **Falar com estabelecimento** | **Redefinir senha**.  
- Agendamento: serviço vinculado ao prof → dia → horário livre → nome/telefone do cliente → confirma → `kind=service` `source=whatsapp`.  
- Evento: título → duração (30/60/90/120) → dia → horário → confirma → `kind=block`.  
- **Concluir:** lista só atendimentos **dentro da janela** [início, fim]; confirma → `status=completed` + `completedAt` (libera o restante do slot).  
- Cancelar: lista próximos `scheduled` daquele profissional → confirma → `status=cancelled`.  
- **Falar com estabelecimento:** abre alerta na aba Atendimentos (`party=employee`, motivo `human_requested`); N “não entendi” no menu também escalam (`unresolved`), com o mesmo threshold da conta.  
- **Redefinir senha:** envia o mesmo CTA/link de uso único (2h) no WhatsApp do profissional (`source=self`).  
- **Áudio + NLU:** mesma transcrição do webhook; NLU no menu e como interrupção no meio do fluxo. LLM + heurística (datas faladas: “28 do 7”, “terça que vem”; `clientName`; horário `9h30`; intents `book`/`event`/`complete`/`human`/`reset_password`). Frases diretas de marcar/evento pulam a pergunta de tipo. Log `NLU emp: …` no servidor.  
- Simulador: `POST /api/whatsapp/simulate` com o telefone do profissional.

Meta Cloud API: `WHATSAPP_PROVIDER=meta` + `WHATSAPP_TOKEN` + Phone Number ID, sem QR no painel.

Sem credenciais: simulador no painel cobre o mesmo caminho de domínio para demos.

## Contas demo (seed)

Quando `SEED_DEMO_ENABLED=true`, o seed cria **uma conta por plano** (mesma senha `SEED_DEMO_PASSWORD`):

| Plano | Email | Negócio | Profissionais |
|-------|-------|---------|---------------|
| Solo | `demo-solo@sof.com` | Barbearia Solo | 2 (`marcelo@solo.demo.sof`, …) |
| Equipe | `SEED_DEMO_EMAIL` / `demo@sof.com` | Santa Madalena | 3 (`marcelo@demo.sof`, …) |
| Rede | `demo-rede@sof.com` | Rede Madalena | 3 (`marcelo@rede.demo.sof`, …) |

Cada conta: 4 serviços, 10 clientes, ~10 agendamentos/cliente, bloqueios (almoço + compromisso semanal). Login profissional em `/login` (troca de senha no 1º acesso).

O dashboard carrega handoffs à parte: plano sem `handoffs` (ex. Solo) recebe 403 nessa rota e **não** deve impedir o load de agenda/clientes/serviços.

Arquivo: `saas/backend/prisma/seed.ts`. Também faz upsert do catálogo `Plan` e cria `AdminUser` (`SEED_ADMIN_*`). Para apagar e semear de novo: `npm run backend:reset-seed`.

## API — mapa rápido

| Área | Métodos principais |
|------|-------------------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET me` |
| Employee auth | `POST /api/employee-auth/login`, `logout`, `GET me`, `POST change-password`, `GET/POST password-setup`, `POST request-password-reset` |
| Employee portal | `GET /api/employee/appointments`, `POST …/:id/cancel` |
| Account | `PUT /api/account`, `GET /api/account/integrations`, `POST/GET /api/account/whatsapp/*` |
| Employees | `GET/POST /api/employees`, `PUT/DELETE …/:id`, `POST …/:id/send-password-link` |
| Services | `GET/POST /api/services`, `PUT/DELETE …/:id` |
| Clients | `GET/POST /api/clients`, `PUT/DELETE …/:id` (pause do bot no PUT) |
| Appointments | `GET/POST /api/appointments`, `PUT/DELETE …/:id` (`DELETE ?scope=series` remove série) |
| WhatsApp handoffs | `GET /api/whatsapp-handoffs`, `GET/PUT …/settings`, `POST …/:id/resolve` |
| Checkout | `POST /api/checkout/create`, `GET …/status/:sessionId` |
| Plans (público) | `GET /api/plans` |
| Payments | `POST /api/payments/webhook` |
| WhatsApp | webhooks + `POST /api/whatsapp/simulate` + pareamento em `/api/account/whatsapp` |
| Events | `GET /api/events/stream` |
| Support tickets | `GET/POST /api/tickets`, `GET …/:id`, `POST …/:id/comments`, `PATCH …/:id/status` |

### Admin API (`admin/backend`, porta 3011)

| Área | Métodos |
|------|---------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET me` |
| Accounts | `GET/POST /api/accounts`, `GET/PUT …/:id`, `POST …/:id/reset-password` |
| WhatsApp ops (Uazapi) | `GET …/:id/whatsapp`, `POST …/connect|disconnect|clear|recreate` |
| Plans | `GET/POST /api/plans`, `GET/PUT/DELETE …/:id` (inclui `entitlements`) |
| Feature catalog | `GET /api/feature-catalog` |
| Tickets | `GET /api/tickets`, `GET …/:id`, `POST …/:id/comments`, `PATCH …/:id/status` |

Detalhes de arquitetura: [`architecture.md`](architecture.md).
