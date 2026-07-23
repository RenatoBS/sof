# Features — Sof

Documento vivo. Atualize quando alterar comportamento de produto ou contratos de API.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produto (visão)

Sof ajuda salões/barbearias a:

1. Receber agendamentos pelo **WhatsApp** (conversa guiada).  
2. Ver a **semana** de todos os profissionais num painel.  
3. Gerir **equipe**, **cardápio de serviços** e **faturamento**.  
4. Assinar planos via **Stripe** (ou fluxo demo).

## Site institucional (marketing)

| Feature | Tela | Notas |
|---------|------|--------|
| Landing | `/` | Hero, chat mock Sof, features com ícones SVG, passos |
| Planos | `/pricing` | Essencial / Estúdio / Rede; CTA abre checkout |
| Quem somos | `/about` | Valores Leveza / Confiança / Proximidade |
| Entrar | `/login` | Conta ou profissional (mesmo formulário) → painel / agenda |
| Nav / footer | global | Wordmark `sof`, CTAs |

Copy e tokens devem permanecer alinhados à marca Sof.

## Checkout e assinatura

| Feature | Onde | API |
|---------|------|-----|
| Escolher plano | modal no pricing / home flow | — |
| Criar sessão | CheckoutModal (nome, e-mail, **senha**) | `POST /api/checkout/create` |
| Retorno Stripe | `/checkout-return?ref=` | `GET /api/checkout/status/:sessionId` → JWT + agenda |
| Webhook pagamento | backend | `POST /api/payments/webhook` |
| Pós-pagamento | auto-login | token na 1ª consulta de status; redireciona `/(dashboard)/agenda` |

Sem `STRIPE_SECRET_KEY`: modo **demonstração** (não cobra de verdade) — provisiona na hora e já entra na agenda.

A senha é definida no modal (mín. 8 caracteres), armazenada só como hash na `CheckoutSession` até o provisionamento; não há mais senha temporária gerada. O checkout também exige **telefone** (DDD, só dígitos), gravado em `Account.phone`.

Planos: tabela `Plan` (seed + painel admin); marketing consome `GET /api/plans`. Fallback legado em `common/plans.ts` / `CheckoutModal` se a API/DB estiver vazia. Assinatura mensal Stripe; Payment Links opcionais em `paymentLinkUrl`.

## Painel admin Sof (plataforma)

Superfície interna (não é o dashboard do tenant). Apps `admin-frontend` + `admin-backend`.

| Feature | UI | API |
|---------|-----|-----|
| Login admin | `/login` | `POST /api/auth/login` |
| Listar / buscar contas | `/accounts` | `GET /api/accounts?q=` |
| Criar conta manual | `/accounts/new` | `POST /api/accounts` |
| Editar conta / plano / status | `/edit-account` | `PUT /api/accounts/:id` |
| Resetar senha | detalhe da conta | `POST /api/accounts/:id/reset-password` |
| Listar planos | `/plans` | `GET /api/plans` |
| Criar / editar plano (+ Stripe) | `/new-plan`, `/edit-plan` | `POST/PUT /api/plans` |
| Tickets de suporte (lista) | `/tickets` | `GET /api/tickets` (default abertos/em andamento) |
| Ticket detalhe / comentários / status | `/edit-ticket` | `GET/POST/PATCH /api/tickets/:id…` |

Seed: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (default `admin@sof.com`).

## Painel (dashboard)

Shell: topbar (negócio + email + Sair) + abas horizontais.

### Agenda

- **Desktop (≥720px):** grade semanal por profissional × dia.  
- **Celular (<720px):** seletor de dia (chips Dom–Sáb) + lista vertical por profissional do dia escolhido (evita scroll horizontal da grade).  
- Navegação: semana anterior / hoje / próxima.  
- Clique numa célula (ou “+ Agendar”) abre o modal; clique num horário edita.  
- **Recolher / expandir** (desktop) no final de cada linha do profissional; recolhido mostra só o 1º horário do dia e `+N` se houver mais.  
- Modal com dois tipos:
  - **Serviço** — cliente + serviço + profissional (como antes).
  - **Evento / bloqueio** — título livre (almoço, médico, etc.), duração e horário livres; sem cliente/serviço; ocupa a agenda do profissional (conflito).
- **Recorrência** na criação (serviço ou evento): diário / semanal / mensal até uma data (máx. 52 ocorrências); editar altera só a ocorrência; excluir pode ser “só esta” ou “série inteira” (`?scope=series`).  
- Empty state se não houver profissionais.  
- Bloco **Bot do WhatsApp — simulador** (telefone + mensagem → `POST /api/whatsapp/simulate`).  
- Toast + grade atualizam em tempo real via SSE.
- Faturamento ignora eventos `kind=block` (preço 0).
- **Status:** `scheduled` (ocupa slot) → `completed` (libera slot; badge “Concluído”) ou `cancelled`. Auto-conclusão quando a hora de fim chega (job a cada 5 min). Conta pode marcar concluído a qualquer momento (`POST /api/appointments/:id/complete`); profissional só na janela do atendimento.

### Profissionais

- Listagem em cards (cor de identificação).  
- CRUD: adicionar / **editar** / remover.  
- Campos: nome, **telefone**, **e-mail de acesso** e **um ou mais serviços** do cardápio (obrigatório).  
- Se a conta **não tem serviços**, “Adicionar Profissional” redireciona para Serviços com o formulário de criação aberto (`?create=1`); após salvar o primeiro serviço, volta para Profissionais.  
- Ao criar (ou resetar senha), o painel gera um **link de uso único** (válido 2h) para o profissional definir a senha em `/profissional/definir-senha?token=…` — sem senha antiga; após salvar, login automático. A página mostra o e-mail de login.  
- **Enviar no WhatsApp:** `POST /api/employees/:id/send-password-link` gera (ou regenera) o link, invalida a senha atual e envia pelo WhatsApp da conta uma mensagem com instruções + botão/CTA **Redefinir senha** (Meta: `cta_url`; Uazapi: CTA se suportado, senão texto com o link). Exige telefone do profissional e WhatsApp conectado.  
- **Self-service:** o profissional também pode pedir o link — ver área do profissional e bot WhatsApp.
- `PUT /api/employees/:id` substitui nome, e-mail, telefone e a lista de serviços (`resetPassword` opcional → novo link).  
- No modal de agendamento e no WhatsApp, só aparecem profissionais que realizam o serviço escolhido.

### Área do profissional

- Login unificado em `/login` (`POST /api/auth/login` ou `/api/employee-auth/login` conforme o e-mail).  
- **Esqueci a senha:** `/profissional/esqueci-senha` (link em `/login`) → `POST /api/employee-auth/request-password-reset` (público, throttle). Resposta sempre genérica; se e-mail + telefone + WhatsApp da conta OK, envia CTA no WhatsApp e invalida a senha atual (`EmployeePasswordResetService`).  
- **Definir senha (convite/reset):** `/profissional/definir-senha?token=` — `GET/POST /api/employee-auth/password-setup` (público; token SHA-256, TTL 2h, uso único).  
- Portal `/(profissional)/agenda`: agendamentos `scheduled` e `completed` daquele profissional; no celular, chips de dia + lista do dia; no desktop, colunas da semana.  
- Pode **marcar como concluído** (`POST /api/employee/appointments/:id/complete`) **somente dentro da janela** [início, fim] do atendimento; conclusão antecipada libera o restante do slot.  
- Pode **cancelar** (`POST /api/employee/appointments/:id/cancel` → `status=cancelled`).  
- Se `mustChangePassword` (legado), redireciona para `/(profissional)/trocar-senha` (exige senha atual).

### Serviços

- Cardápio (nome, duração, preço).  
- CRUD: adicionar / **editar** / remover (`PUT /api/services/:id`).  
- Copy: “Configure seu cardápio de serviços”.

### Clientes

- Listagem em cards (nome + telefone).  
- CRUD: adicionar / editar / remover.  
- Na **edição**: pausar o bot WhatsApp para aquele cliente — **Bot ativo**, timer (1 h / 8 h / 24 h / 7 dias) ou **Permanente**.  
- Badge na lista: **Bot off** (permanente) ou **Bot pausado até …** (temporário).  
- Enquanto pausado, o webhook **não responde** (silêncio). Só vale para `Client` cadastrado (mesmo telefone da conversa).

### Atendimentos (escalonamento humano)

- Aba **Atendimentos** com **badge vermelho** na tabbar contando alertas abertos (tempo real via SSE).  
- Alerta abre quando: (a) o cliente **pede atendente explicitamente** (regex + intent `human` do NLU) — imediato; ou (b) o bot responde "não entendi" **N vezes seguidas** (default 2; configurável na aba: 1 / 2 / 3 / 5, salvo em `Account.whatsappHandoffThreshold`).  
- Cada card mostra nome/telefone, motivo (Pediu atendente / Bot não entendeu), última mensagem e desde quando; botões **Abrir no WhatsApp** (WhatsApp Web no navegador, `wa.me` no celular) e **Marcar resolvido**.  
- Quando o alerta abre, o cliente recebe no WhatsApp: "Avisei a equipe — alguém vai te responder por aqui em breve."  
- **Resposta humana** (mensagem `fromMe` que não veio da API — celular ou WhatsApp Web): pausa o bot **1 h** para aquele cliente (`Client.botPausedUntil`), zera o contador e **resolve** o alerta automaticamente.  
- Intents `cancel`/`list`/`book` do NLU continuam tratadas pelo bot — só o pedido explícito por humano escala na hora.  
- API: `GET /api/whatsapp-handoffs` (`?status=open|resolved`), `GET/PUT …/settings`, `POST …/:id/resolve`. SSE: `whatsapp-handoff:opened|updated|resolved`.

### Faturamento

- Cards: Hoje / Esta Semana / Este Mês (`scheduled` + `completed`).  
- Lista “Agendamentos” (serviço; ignora `block`).  
- Copy: “Acompanhe a receita de seus serviços”.

### Conta

- Assinatura (plano, email, desde).  
- **Endereço** do estabelecimento (opcional); `PUT /api/account` com `address`; o bot informa na conversa.  
- **Horário de funcionamento** (7 dias: aberto/fechado + abre/fecha); `PUT /api/account` com `openingHours`.  
- **Bot WhatsApp (Uazapi):** pareamento na Conta — QR ou código (`POST /api/account/whatsapp/connect`, poll `GET …/status`, `POST …/disconnect`). Token da instância fica só no servidor.  
- **Pausa do bot (conta):** na seção Bot do WhatsApp — **Bot ativo**, timer (1 h / 8 h / 24 h / 3 dias / 7 dias) ou **Permanente**. Enquanto pausado, o webhook **não responde a clientes** (`Account.botPausedPermanent` / `botPausedUntil`). Profissionais com telefone cadastrado continuam no fluxo operacional. Pausa por cliente continua na aba Clientes.  
- **Lembrete WhatsApp:** card na Conta com antecedência (`Desativado` / `1h` / `2h` default / `3h` / `6h` / `24h`) e fuso horário da conta (botão que expande a lista de fusos); `PUT /api/account` com `whatsappReminderMinutes` + `timezone`. Job a cada 30 min envia no máximo 1 lembrete por agendamento confirmado pela instância conectada.  
- Sair da conta.

### Suporte

- Aba **Suporte** no dashboard da conta: abrir ticket (`title` + `description`), listar, comentar e mudar status (`open` | `in_progress` | `resolved` | `closed`).
- Portal do profissional: ver tickets da conta, comentar e mudar status (não abre ticket novo).
- Admin Sof: lista (filtro abertos por padrão), detalhe, responder e status.
- API produto: `GET/POST /api/tickets`, `GET /api/tickets/:id`, `POST …/comments`, `PATCH …/status` — `TenantAuthGuard` (conta **ou** profissional).

## WhatsApp (bot)

Provedor padrão: **Uazapi** (`WHATSAPP_PROVIDER=uazapi` se omitido).

Com Uazapi (`WHATSAPP_BASE_URL` + `WHATSAPP_ADMIN_TOKEN` **ou** `WHATSAPP_TOKEN` de instância):

- Pareamento no painel Conta (QR ou código com telefone).  
- Ao conectar, a API configura o webhook da instância para `API_PUBLIC_URL/api/whatsapp/webhook`.  
- Webhook `GET/POST /api/whatsapp/webhook`.  

### Fluxo do cliente
- Fluxo: **serviço → profissional** (lista quem faz o serviço) **ou “Escolher horário”** → **dia** (Hoje / Amanhã / Outra data) → **horário** (até 5 do dia ou “Outro horário”) → (se horário primeiro) profissional disponível + **“Deixa a Sof escolher”** → confirmação → `Appointment` (`source=whatsapp`).  
- **Menu inicial:** se o cliente já tem agendamento **futuro** (`scheduled`), além dos serviços aparecem **Ver agendamentos** e **Cancelar horário**; sem futuro, só a lista de serviços. Cancelar pede confirmação (Sim/Não) e marca `status=cancelled` (SSE `appointment:updated`).  
- **Caminhos:** após o serviço, o bot lista os profissionais do serviço e, por último, **Escolher horário**. Se o cliente escolhe um profissional, os dias/horários são só dele. Se escolhe horário primeiro, depois pergunta quem está livre naquele slot (com opção da Sof escolher).  
- **Dia e horário (duas perguntas):** 1) Hoje, Amanhã (só se houver vaga) ou Outra data (`dd/mm`); 2) até 5 horários livres daquele dia + **Outro horário** (`hh:mm`).  
- **Menus interativos:** escolhas de serviço (com **preço**), caminho/profissional, dia, horário e confirmação (Sim/Não) vão como **botões** (até 3 opções) ou **lista** (mais de 3) via `POST /send/menu` (Uazapi) / `interactive` (Meta). Números e texto continuam válidos (simulador e fallback).  
- **Comandos:** `/reset` ou `reset` (e `cancelar`) reinicia a sessão; perguntas de **endereço** / “onde fica” / “como chegar” devolvem `Account.address` (se cadastrado).  
- **Áudio (Uazapi):** mensagens de voz (`audio` / `ptt`) são transcritas via `POST /message/download` (`transcribe: true`) e tratadas como texto no mesmo fluxo. Exige `OPENAI_API_KEY` no servidor (Whisper via Uazapi); sem chave ou se a transcrição falhar, o bot pede para escrever ou usar os botões.  
- **Frases livres (NLU):** com `OPENAI_API_KEY`, frases corridas (≥ 3 palavras) no início da conversa ou na escolha de serviço passam por um extrator LLM (`gpt-4o-mini`, JSON) que identifica intenção (marcar/cancelar/ver), serviço, data e hora — ex. "quero marcar um corte amanhã ao meio-dia" pula direto para a confirmação. Falha ou frase vaga caem no fluxo guiado normal (`whatsapp/booking-nlu.service.ts`).  
- **Endereço:** se cadastrado em Conta, aparece no cumprimento e na confirmação do agendamento.  
- **Pausa por cliente:** `Client.botPausedPermanent` / `botPausedUntil` — dono desativa na aba Clientes; webhook e simulador ignoram a conversa enquanto pausado.  
- **Pausa da conta:** `Account.botPausedPermanent` / `botPausedUntil` — Conta → Bot do WhatsApp; silencia o bot para **clientes** até a data ou até reativar (profissionais cadastrados continuam no fluxo operacional).  
- **Escalonamento humano:** pedidos explícitos por atendente ou N "não entendi" seguidos abrem alerta na aba **Atendimentos**; resposta humana pelo WhatsApp pausa o bot **1 h** para aquele cliente (`Client.botPausedUntil`), zera o contador e resolve o alerta (ver seção Atendimentos acima).  
- **Lembrete automático:** se `whatsappReminderMinutes > 0` e a instância está conectada, um job a cada 30 min avisa o cliente no WhatsApp antes do horário (1× por agendamento; fuso = `Account.timezone`). A confirmação do bot só promete lembrete quando a antecedência está ativa.  
- **Expediente:** só aceita data/hora em dias abertos e com o serviço cabendo no intervalo configurado em Conta.  
- **Conflito de agenda:** só mostra profissionais livres no horário; na confirmação há checagem de novo (corrida entre clientes) e, se necessário, volta à escolha de horário.  
- Create/update na API de appointments aplicam expediente + conflito (painel e bot).

### Fluxo do profissional
- Se o remetente casa com o **telefone** de um `Employee` da conta (exato ou sufixo BR com/sem DDI `55`), o bot **não** usa o fluxo de cliente — `WhatsappEmployeeBotService` (steps `emp:*`).  
- Menu: **Agenda de hoje** | **Agenda de outro dia** | **Novo agendamento** | **Novo evento** | **Concluir horário** | **Cancelar horário** | **Redefinir senha**.  
- Agendamento: serviço vinculado ao prof → dia → horário livre → nome/telefone do cliente → confirma → `kind=service` `source=whatsapp`.  
- Evento: título → duração (30/60/90/120) → dia → horário → confirma → `kind=block`.  
- **Concluir:** lista só atendimentos **dentro da janela** [início, fim]; confirma → `status=completed` + `completedAt` (libera o restante do slot).  
- Cancelar: lista próximos `scheduled` daquele profissional → confirma → `status=cancelled`.  
- **Redefinir senha:** envia o mesmo CTA/link de uso único (2h) no WhatsApp do profissional (`source=self`).  
- **Áudio + NLU:** mesma transcrição do webhook; NLU no menu e como interrupção no meio do fluxo. LLM + heurística (datas faladas: “28 do 7”, “terça que vem”; `clientName`; horário `9h30`; intents `complete` / `reset_password`). Cancelamento/conclusão com nome/data/hora tenta achar o horário direto. Log `NLU emp: …` no servidor.  
- Simulador: `POST /api/whatsapp/simulate` com o telefone do profissional.

Meta Cloud API: `WHATSAPP_PROVIDER=meta` + `WHATSAPP_TOKEN` + Phone Number ID, sem QR no painel.

Sem credenciais: simulador no painel cobre o mesmo caminho de domínio para demos.

## Conta demo (seed)

Quando `SEED_DEMO_ENABLED=true`, o seed cria (ou recria padrão de demo):

- Email: `SEED_DEMO_EMAIL` (default `demo@sof.com`)  
- Senha: `SEED_DEMO_PASSWORD`  
- Negócio exemplo “Santa Madalena”, plano Estúdio, 3 profissionais / 4 serviços  
- **10 clientes**, **10 agendamentos de serviço por cliente** (alguns em série semanal com `recurrenceGroupId`)  
- Bloqueios fixos por profissional: **Almoço** diário (série) + compromisso semanal (Médico / Reunião / Estoque)  
- Login profissional demo: `marcelo@demo.sof` (mesma senha do demo; troca no 1º acesso em `/login`)  

Arquivo: `backend/prisma/seed.ts`. Também faz upsert do catálogo `Plan` e cria `AdminUser` (`SEED_ADMIN_*`). Conta demo já existente: use `npm run backend:reset-seed` (local) para apagar e semear de novo.

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

### Admin API (`admin-backend`, porta 3011)

| Área | Métodos |
|------|---------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET me` |
| Accounts | `GET/POST /api/accounts`, `GET/PUT …/:id`, `POST …/:id/reset-password` |
| Plans | `GET/POST /api/plans`, `GET/PUT …/:id` |
| Tickets | `GET /api/tickets`, `GET …/:id`, `POST …/:id/comments`, `PATCH …/:id/status` |

Detalhes de arquitetura: [`architecture.md`](architecture.md).
