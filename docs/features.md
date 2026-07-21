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

A senha é definida no modal (mín. 8 caracteres), armazenada só como hash na `CheckoutSession` até o provisionamento; não há mais senha temporária gerada.

Planos (`plans.ts` + `CheckoutModal`): Essencial 99 / Estúdio 197 / Rede 249 — assinatura mensal Stripe; Payment Links em `paymentLinkUrl` no backend.

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

### Profissionais

- Listagem em cards (cor de identificação).  
- CRUD: adicionar / **editar** / remover.  
- Campos: nome, **e-mail de acesso** e **um ou mais serviços** do cardápio (obrigatório).  
- Se a conta **não tem serviços**, “Adicionar Profissional” redireciona para Serviços com o formulário de criação aberto (`?create=1`); após salvar o primeiro serviço, volta para Profissionais.  
- Ao criar (ou resetar senha), o painel gera senha temporária e exibe uma vez; no 1º login o profissional troca a senha.  
- `PUT /api/employees/:id` substitui nome, e-mail e a lista de serviços (`resetPassword` opcional).  
- No modal de agendamento e no WhatsApp, só aparecem profissionais que realizam o serviço escolhido.

### Área do profissional

- Login unificado em `/login` (`POST /api/auth/login` ou `/api/employee-auth/login` conforme o e-mail).  
- Portal `/(profissional)/agenda`: só os agendamentos `confirmed` daquele profissional; no celular, chips de dia + lista do dia; no desktop, colunas da semana.  
- Pode **cancelar** (`POST /api/employee/appointments/:id/cancel` → `status=cancelled`).  
- Se `mustChangePassword`, redireciona para `/(profissional)/trocar-senha`.

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

- Cards: Hoje / Esta Semana / Este Mês (confirmed).  
- Lista “Agendamentos Confirmados”.  
- Copy: “Acompanhe a receita de seus serviços”.

### Conta

- Assinatura (plano, email, desde).  
- **Endereço** do estabelecimento (opcional); `PUT /api/account` com `address`; o bot informa na conversa.  
- **Horário de funcionamento** (7 dias: aberto/fechado + abre/fecha); `PUT /api/account` com `openingHours`.  
- **Bot WhatsApp (Uazapi):** pareamento na Conta — QR ou código (`POST /api/account/whatsapp/connect`, poll `GET …/status`, `POST …/disconnect`). Token da instância fica só no servidor.  
- **Lembrete WhatsApp:** card na Conta com antecedência (`Desativado` / `1h` / `2h` default / `3h` / `6h` / `24h`) e fuso horário da conta; `PUT /api/account` com `whatsappReminderMinutes` + `timezone`. Job a cada 30 min envia no máximo 1 lembrete por agendamento confirmado pela instância conectada.  
- Sair da conta.

## WhatsApp (bot)

Provedor padrão: **Uazapi** (`WHATSAPP_PROVIDER=uazapi` se omitido).

Com Uazapi (`WHATSAPP_BASE_URL` + `WHATSAPP_ADMIN_TOKEN` **ou** `WHATSAPP_TOKEN` de instância):

- Pareamento no painel Conta (QR ou código com telefone).  
- Ao conectar, a API configura o webhook da instância para `API_PUBLIC_URL/api/whatsapp/webhook`.  
- Webhook `GET/POST /api/whatsapp/webhook`.  
- Fluxo: **serviço → profissional** (lista quem faz o serviço) **ou “Escolher horário”** → **dia** (Hoje / Amanhã / Outra data) → **horário** (até 5 do dia ou “Outro horário”) → (se horário primeiro) profissional disponível + **“Deixa a Sof escolher”** → confirmação → `Appointment` (`source=whatsapp`).  
- **Menu inicial:** se o cliente já tem agendamento **futuro** (`confirmed`), além dos serviços aparecem **Ver agendamentos** e **Cancelar horário**; sem futuro, só a lista de serviços. Cancelar pede confirmação (Sim/Não) e marca `status=cancelled` (SSE `appointment:updated`).  
- **Caminhos:** após o serviço, o bot lista os profissionais do serviço e, por último, **Escolher horário**. Se o cliente escolhe um profissional, os dias/horários são só dele. Se escolhe horário primeiro, depois pergunta quem está livre naquele slot (com opção da Sof escolher).  
- **Dia e horário (duas perguntas):** 1) Hoje, Amanhã (só se houver vaga) ou Outra data (`dd/mm`); 2) até 5 horários livres daquele dia + **Outro horário** (`hh:mm`).  
- **Menus interativos:** escolhas de serviço (com **preço**), caminho/profissional, dia, horário e confirmação (Sim/Não) vão como **botões** (até 3 opções) ou **lista** (mais de 3) via `POST /send/menu` (Uazapi) / `interactive` (Meta). Números e texto continuam válidos (simulador e fallback).  
- **Comandos:** `/reset` ou `reset` (e `cancelar`) reinicia a sessão; perguntas de **endereço** / “onde fica” / “como chegar” devolvem `Account.address` (se cadastrado).  
- **Áudio (Uazapi):** mensagens de voz (`audio` / `ptt`) são transcritas via `POST /message/download` (`transcribe: true`) e tratadas como texto no mesmo fluxo. Exige `OPENAI_API_KEY` no servidor (Whisper via Uazapi); sem chave ou se a transcrição falhar, o bot pede para escrever ou usar os botões.  
- **Frases livres (NLU):** com `OPENAI_API_KEY`, frases corridas (≥ 3 palavras) no início da conversa ou na escolha de serviço passam por um extrator LLM (`gpt-4o-mini`, JSON) que identifica intenção (marcar/cancelar/ver), serviço, data e hora — ex. "quero marcar um corte amanhã ao meio-dia" pula direto para a confirmação. Falha ou frase vaga caem no fluxo guiado normal (`whatsapp/booking-nlu.service.ts`).  
- **Endereço:** se cadastrado em Conta, aparece no cumprimento e na confirmação do agendamento.  
- **Pausa por cliente:** `Client.botPausedPermanent` / `botPausedUntil` — dono desativa na aba Clientes; webhook e simulador ignoram a conversa enquanto pausado.  
- **Escalonamento humano:** pedidos explícitos por atendente ou N "não entendi" seguidos abrem alerta na aba **Atendimentos**; resposta humana pelo WhatsApp pausa o bot 1 h e resolve o alerta (ver seção Atendimentos acima).  
- **Lembrete automático:** se `whatsappReminderMinutes > 0` e a instância está conectada, um job a cada 30 min avisa o cliente no WhatsApp antes do horário (1× por agendamento; fuso = `Account.timezone`). A confirmação do bot só promete lembrete quando a antecedência está ativa.  
- **Expediente:** só aceita data/hora em dias abertos e com o serviço cabendo no intervalo configurado em Conta.  
- **Conflito de agenda:** só mostra profissionais livres no horário; na confirmação há checagem de novo (corrida entre clientes) e, se necessário, volta à escolha de horário.  
- Create/update na API de appointments aplicam expediente + conflito (painel e bot).

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

Arquivo: `backend/prisma/seed.ts`. Conta já existente: use `npm run backend:reset-seed` (local) para apagar e semear de novo.

## API — mapa rápido

| Área | Métodos principais |
|------|-------------------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET me` |
| Employee auth | `POST /api/employee-auth/login`, `logout`, `GET me`, `POST change-password` |
| Employee portal | `GET /api/employee/appointments`, `POST …/:id/cancel` |
| Account | `PUT /api/account`, `GET /api/account/integrations`, `POST/GET /api/account/whatsapp/*` |
| Employees | `GET/POST /api/employees`, `PUT/DELETE …/:id` |
| Services | `GET/POST /api/services`, `PUT/DELETE …/:id` |
| Clients | `GET/POST /api/clients`, `PUT/DELETE …/:id` (pause do bot no PUT) |
| Appointments | `GET/POST /api/appointments`, `PUT/DELETE …/:id` (`DELETE ?scope=series` remove série) |
| WhatsApp handoffs | `GET /api/whatsapp-handoffs`, `GET/PUT …/settings`, `POST …/:id/resolve` |
| Checkout | `POST /api/checkout/create`, `GET …/status/:sessionId` |
| Payments | `POST /api/payments/webhook` |
| WhatsApp | webhooks + `POST /api/whatsapp/simulate` + pareamento em `/api/account/whatsapp` |
| Events | `GET /api/events/stream` |

Detalhes de arquitetura: [`architecture.md`](architecture.md).
