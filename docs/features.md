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

- Grade semanal por profissional × dia.  
- Navegação: semana anterior / hoje / próxima.  
- Clique edita agendamento (modal).  
- Empty state se não houver profissionais.  
- Bloco **Bot do WhatsApp — simulador** (telefone + mensagem → `POST /api/whatsapp/simulate`).  
- Toast + grade atualizam em tempo real via SSE.

### Profissionais

- Listagem em cards (cor de identificação).  
- CRUD: adicionar / **editar** / remover.  
- Campos: nome, **e-mail de acesso** e **um ou mais serviços** do cardápio (obrigatório).  
- Ao criar (ou resetar senha), o painel gera senha temporária e exibe uma vez; no 1º login o profissional troca a senha.  
- `PUT /api/employees/:id` substitui nome, e-mail e a lista de serviços (`resetPassword` opcional).  
- No modal de agendamento e no WhatsApp, só aparecem profissionais que realizam o serviço escolhido.

### Área do profissional

- Login unificado em `/login` (`POST /api/auth/login` ou `/api/employee-auth/login` conforme o e-mail).  
- Portal `/(profissional)/agenda`: só os agendamentos `confirmed` daquele profissional.  
- Pode **cancelar** (`POST /api/employee/appointments/:id/cancel` → `status=cancelled`).  
- Se `mustChangePassword`, redireciona para `/(profissional)/trocar-senha`.

### Serviços

- Cardápio (nome, duração, preço).  
- CRUD: adicionar / **editar** / remover (`PUT /api/services/:id`).  
- Copy: “Configure seu cardápio de serviços”.

### Faturamento

- Cards: Hoje / Esta Semana / Este Mês (confirmed).  
- Lista “Agendamentos Confirmados”.  
- Copy: “Acompanhe a receita de seus serviços”.

### Conta

- Assinatura (plano, email, desde).  
- **Horário de funcionamento** (7 dias: aberto/fechado + abre/fecha); `PUT /api/account` com `openingHours`.  
- **Bot WhatsApp (Uazapi):** pareamento na Conta — QR ou código (`POST /api/account/whatsapp/connect`, poll `GET …/status`, `POST …/disconnect`). Token da instância fica só no servidor.  
- Sair da conta.

## WhatsApp (bot)

Provedor padrão: **Uazapi** (`WHATSAPP_PROVIDER=uazapi` se omitido).

Com Uazapi (`WHATSAPP_BASE_URL` + `WHATSAPP_ADMIN_TOKEN` **ou** `WHATSAPP_TOKEN` de instância):

- Pareamento no painel Conta (QR ou código com telefone).  
- Ao conectar, a API configura o webhook da instância para `API_PUBLIC_URL/api/whatsapp/webhook`.  
- Webhook `GET/POST /api/whatsapp/webhook`.  
- Fluxo: serviço → profissionais **filtrados pelos serviços que realizam** → data/hora → confirmação → `Appointment` (`source=whatsapp`).  
- **Expediente:** só aceita data/hora em dias abertos e com o serviço cabendo no intervalo configurado em Conta; informa o resumo ao pedir horário.  
- **Conflito de agenda:** se o profissional já tem um horário confirmado que se sobrepõe (pela duração do serviço), o bot recusa, sugere até 3 horários livres **dentro do expediente** (passo 30 min) e pede outra data/hora; na confirmação há checagem de novo (corrida entre clientes).  
- Create/update na API de appointments aplicam expediente + conflito (painel e bot).

Meta Cloud API: `WHATSAPP_PROVIDER=meta` + `WHATSAPP_TOKEN` + Phone Number ID, sem QR no painel.

Sem credenciais: simulador no painel cobre o mesmo caminho de domínio para demos.

## Conta demo (seed)

Quando `SEED_DEMO_ENABLED=true`, o seed cria (ou recria padrão de demo):

- Email: `SEED_DEMO_EMAIL` (default `demo@sof.com`)  
- Senha: `SEED_DEMO_PASSWORD`  
- Negócio exemplo “Santa Madalena”, plano Estúdio, profissionais/serviços/agendamento de exemplo  
- Login profissional demo: `marcelo@demo.sof` (mesma senha do demo; troca no 1º acesso em `/login`)  

Arquivo: `backend/prisma/seed.ts`.

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
| Appointments | `GET/POST /api/appointments`, `PUT/DELETE …/:id` |
| Checkout | `POST /api/checkout/create`, `GET …/status/:sessionId` |
| Payments | `POST /api/payments/webhook` |
| WhatsApp | webhooks + `POST /api/whatsapp/simulate` + pareamento em `/api/account/whatsapp` |
| Events | `GET /api/events/stream` |

Detalhes de arquitetura: [`architecture.md`](architecture.md).
