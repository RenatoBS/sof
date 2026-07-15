# Features — Sof

Documento vivo. Atualize quando alterar comportamento de produto ou contratos de API.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Produto (visão)

Sof ajuda salões/barbearias a:

1. Receber agendamentos pelo **WhatsApp** (conversa guiada).  
2. Ver a **semana** de todos os profissionais num painel.  
3. Gerir **equipe**, **cardápio de serviços** e **faturamento**.  
4. Assinar planos via **Mercado Pago** (ou fluxo demo).

## Site institucional (marketing)

| Feature | Tela | Notas |
|---------|------|--------|
| Landing | `/` | Hero, chat mock Sof, features com ícones SVG, passos |
| Planos | `/pricing` | Essencial / Estúdio / Rede; CTA abre checkout |
| Quem somos | `/about` | Valores Leveza / Confiança / Proximidade |
| Entrar | `/login` | Credenciais → dashboard |
| Nav / footer | global | Wordmark `sof`, CTAs |

Copy e tokens devem permanecer alinhados à marca Sof.

## Checkout e assinatura

| Feature | Onde | API |
|---------|------|-----|
| Escolher plano | modal no pricing / home flow | — |
| Criar sessão | CheckoutModal | `POST /api/checkout/create` |
| Retorno MP | `/checkout-return?ref=` | `GET /api/checkout/status/:sessionId` |
| Webhook pagamento | backend | `POST /api/payments/webhook` |
| Credenciais pós-aprovação | UI retorno | email + senha temporária (quando aplicável) |

Sem `MP_ACCESS_TOKEN`: modo **demonstração** (não cobra de verdade).

Planos hardcodeados no front (`CheckoutModal` / `PLANS`): Essencial 99, Estúdio 197, Rede 249.

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
- CRUD: adicionar / remover.  
- Campos: nome, especialidade, telefone.

### Serviços

- Cardápio (nome, duração, preço).  
- Copy: “Configure seu cardápio de serviços”.

### Faturamento

- Cards: Hoje / Esta Semana / Este Mês (confirmed).  
- Lista “Agendamentos Confirmados”.  
- Copy: “Acompanhe a receita de seus serviços”.

### Conta

- Assinatura (plano, email, desde).  
- Status Mercado Pago.  
- Status bot WhatsApp + Phone Number ID (`PUT /api/account`).  
- Sair da conta.

## WhatsApp (bot)

Com credenciais Meta + Phone Number ID na conta:

- Webhook `GET/POST /api/whatsapp/webhook`.  
- Fluxo conversacional escolhe serviço / profissional / horário e cria `Appointment` (`source=whatsapp`).

Sem credenciais: simulador no painel cobre o mesmo caminho de domínio para demos.

## Conta demo (seed)

Quando `SEED_DEMO_ENABLED=true`, o seed cria (ou recria padrão de demo):

- Email: `SEED_DEMO_EMAIL` (default `demo@sof.com`)  
- Senha: `SEED_DEMO_PASSWORD`  
- Negócio exemplo “Santa Madalena”, plano Estúdio, profissionais/serviços/agendamento de exemplo  

Arquivo: `backend/prisma/seed.ts`.

## API — mapa rápido

| Área | Métodos principais |
|------|-------------------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET me` |
| Account | `PUT /api/account`, `GET /api/account/integrations` |
| Employees | `GET/POST /api/employees`, `DELETE …/:id` |
| Services | `GET/POST /api/services`, `DELETE …/:id` |
| Appointments | `GET/POST /api/appointments`, `PUT/DELETE …/:id` |
| Checkout | `POST /api/checkout/create`, `GET …/status/:sessionId` |
| Payments | `POST /api/payments/webhook` |
| WhatsApp | webhooks + `POST /api/whatsapp/simulate` |
| Events | `GET /api/events/stream` |

Detalhes de arquitetura: [`architecture.md`](architecture.md).
