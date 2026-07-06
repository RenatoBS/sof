# Soft — agendamento pelo WhatsApp

Site institucional + checkout de assinatura + dashboard de agendamentos, com bot de
WhatsApp que lança agendamentos confirmados direto no painel em tempo real.

Este projeto substitui os dois prototypes estáticos originais (site com login/checkout
em `localStorage` e um dashboard React via CDN) por uma aplicação real: back-end Node/Express
com autenticação de verdade (senha com hash, cookie de sessão assinado), front-ends
estruturados em módulos JS (sem CDN, sem `onclick` inline), integração com o gateway
**Mercado Pago** e com o **WhatsApp Cloud API** (Meta).

## Como rodar

```bash
npm install
cp .env.example .env   # ajuste os valores conforme necessário
npm start               # ou: npm run dev (reinicia sozinho ao salvar)
```

Acesse `http://localhost:3000`. Uma conta de demonstração é criada automaticamente no
primeiro start:

- **E-mail:** `demo@soft.com`
- **Senha:** `demo123`

Os dados ficam em `server/data/db.json` (arquivo local, ignorado pelo git). Para
recomeçar do zero, apague esse arquivo e reinicie o servidor.

## Arquitetura

```
server/            back-end Express
  src/
    app.js          monta middlewares, rotas e serve os front-ends estáticos
    config.js       variáveis de ambiente
    db.js           armazenamento em arquivo JSON (coleções simples com CRUD)
    seed.js         cria a conta de demonstração no primeiro start
    lib/            regras de negócio (senha, JWT, Mercado Pago, WhatsApp, SSE...)
    middleware/     autenticação
    routes/         endpoints REST (auth, checkout, pagamentos, agenda, whatsapp...)
public/
  site/             site institucional + checkout (SPA leve, sem framework)
  dashboard/        painel de agendamentos (SPA leve, sem framework)
```

Login e checkout usam **cookies httpOnly assinados com JWT** (não há mais senha nem
sessão guardada em `localStorage`). Depois do login, o navegador é redirecionado para
`/dashboard/`, que roda como uma aplicação separada no mesmo domínio e reaproveita o
mesmo cookie de sessão.

## Pagamento — Mercado Pago

Sem credenciais configuradas, o checkout roda em **modo demonstração**: a assinatura é
aprovada na hora (sem cobrança real) só para você testar o fluxo ponta a ponta.

Para cobrar de verdade:

1. Crie/entre na sua conta em https://www.mercadopago.com.br/developers
2. Em **Suas integrações > Credenciais**, copie o `Access Token` e a `Public Key`.
3. Em **Suas integrações > Webhooks**, cadastre a URL
   `https://SEU_DOMINIO/api/payments/webhook` e copie a **assinatura secreta**.
4. Preencha no `.env`: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` e
   `PUBLIC_URL` (a URL pública onde a aplicação roda).
5. Reinicie o servidor. O checkout passa a redirecionar para o Checkout Pro do
   Mercado Pago; a confirmação chega pelo webhook e libera o acesso automaticamente.

O preço cobrado nunca é aceito do navegador — o servidor sempre usa a tabela de
planos definida em `server/src/lib/plans.js`.

## Bot de WhatsApp

Sem credenciais configuradas, o bot fica desligado, mas o dashboard tem um
**simulador** (aba Agenda) que roda exatamente a mesma lógica de conversa, sem
depender da Meta — útil para testar o fluxo de ponta a ponta.

Para ligar o bot de verdade:

1. Crie um app em https://developers.facebook.com/ com o produto **WhatsApp**.
2. Gere um token de acesso (de preferência um token permanente de System User) e
   anote o **Phone Number ID** do número de teste/produção.
3. Preencha no `.env`: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_VERIFY_TOKEN` (um valor que você escolhe) e `WHATSAPP_APP_SECRET`.
4. Em **WhatsApp > Configuration**, cadastre o webhook
   `https://SEU_DOMINIO/api/whatsapp/webhook` usando o mesmo `WHATSAPP_VERIFY_TOKEN`,
   e assine os eventos `messages`.
5. No painel (**aba Conta**), cole o mesmo Phone Number ID em "WhatsApp Phone Number
   ID" — é assim que o servidor sabe a qual conta/dashboard pertence cada número.

Quando um cliente confirma um horário pelo WhatsApp, o agendamento é criado com
`source: "whatsapp"` e aparece imediatamente no painel (via Server-Sent Events),
com um aviso e um destaque visual diferenciando-o dos agendamentos manuais.

## Segurança

- Senhas com hash `bcrypt` (nunca texto puro em disco).
- Sessão via cookie `httpOnly` + `SameSite=Lax`, assinado com JWT (`JWT_SECRET`).
- `helmet` com Content-Security-Policy restritiva; nenhum `onclick` inline — toda
  interação é ligada via `addEventListener` em módulos JS externos.
- Preço do plano sempre validado no servidor, nunca aceito do cliente.
- Assinatura dos webhooks (Mercado Pago `x-signature`, Meta `X-Hub-Signature-256`)
  verificada quando os respectivos segredos estão configurados.
- Rate limiting nos endpoints de login, checkout e webhook do WhatsApp.
