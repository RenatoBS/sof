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

Acesse `http://localhost:3000`. Uma conta de teste é criada em silêncio no primeiro
start — ela **não aparece em nenhum lugar da interface**, só existe pra você logar e
testar (veja as variáveis `SEED_DEMO_*` no `.env.example`, e a seção
[Conta de teste](#conta-de-teste-oculta) abaixo).

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

## Conta de teste oculta

No primeiro start, o servidor cria uma conta de teste **só no banco de dados** — ela não
é mencionada em nenhuma tela, nem na página de login, nem em nenhuma resposta de API.
As credenciais padrão são `demo@soft.com` / `demo123` (definidas em
`server/src/config.js` via as variáveis `SEED_DEMO_EMAIL`/`SEED_DEMO_PASSWORD`).

Antes de divulgar o site publicamente:

1. Defina `SEED_DEMO_EMAIL` e `SEED_DEMO_PASSWORD` no `.env` com um e-mail/senha só seus
   (o padrão é só para o primeiro teste local).
2. Se o servidor já tiver rodado antes com os valores padrão, apague
   `server/data/db.json` (ou troque só a senha manualmente) para que a conta seja
   recriada com as novas credenciais.
3. Quando não precisar mais dela, desative de vez com `SEED_DEMO_ENABLED=false`.

## Checklist antes de subir em produção

- [ ] `NODE_ENV=production` na variável de ambiente do host.
- [ ] `JWT_SECRET` definido com um valor aleatório forte — o servidor recusa iniciar em
      produção sem isso (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- [ ] Domínio servido em **HTTPS** — o cookie de sessão só é salvo pelo navegador em
      conexões seguras quando `NODE_ENV=production`.
- [ ] `PUBLIC_URL` apontando para a URL pública real (usada nos links de retorno do
      Mercado Pago e no `notification_url` do webhook).
- [ ] Disco do host é **persistente** entre deploys/restarts — hoje o banco é o arquivo
      `server/data/db.json`; num filesystem efêmero os dados somem a cada redeploy.
- [ ] `SEED_DEMO_EMAIL`/`SEED_DEMO_PASSWORD` trocados (ou `SEED_DEMO_ENABLED=false`).
- [ ] Credenciais do Mercado Pago e do WhatsApp configuradas (opcional — sem elas o site
      continua no ar, só fica em modo demonstração/bot desligado).

## Deploy — por que não dá pra usar o Netlify

Esse projeto **não roda no Netlify**. O Netlify é feito para sites estáticos e funções
serverless de vida curta; esta aplicação é um servidor Node/Express de processo
contínuo, que precisa ficar escutando o tempo todo (login, checkout, o canal de tempo
real do WhatsApp via SSE) e que grava num arquivo local (`server/data/db.json`) que
precisa persistir entre requisições. Nenhuma dessas três coisas existe no modelo do
Netlify, então o deploy nunca vai "subir" lá — não é um bug no código.

Use um host que rode um servidor Node comum com disco persistente: **Render**,
Railway, Fly.io ou uma VPS qualquer (DigitalOcean, EC2 etc.) com Nginx na frente. O
projeto já vem com um `render.yaml` pronto para o Render (o mais simples dos quatro):

1. Crie uma conta em https://render.com e conecte o repositório do GitHub.
2. Em **New > Blueprint**, aponte para este repositório — o Render lê o `render.yaml`
   sozinho e já cria o serviço web com disco persistente montado em
   `server/data`.
3. Preencha as variáveis marcadas como "secretas" no painel do Render antes do primeiro
   deploy: `PUBLIC_URL` (a URL que o Render te dá, tipo `https://soft-agendamento.onrender.com`),
   `SEED_DEMO_EMAIL`/`SEED_DEMO_PASSWORD` (opcional) e, quando for cobrar/receber
   WhatsApp de verdade, as chaves do Mercado Pago e da Meta. `JWT_SECRET` já é gerado
   sozinho pelo Render (`generateValue: true` no blueprint).
4. Deploy. O `healthCheckPath: /api/health` já está configurado para o Render saber que
   o serviço subiu.

Sem Blueprint, também dá pra criar o serviço manualmente no Render (New > Web Service,
build command `npm install`, start command `npm start`) — só não esqueça de anexar um
disco persistente em `server/data`, senão o banco reseta a cada deploy.

## Segurança

- Senhas com hash `bcrypt` (nunca texto puro em disco).
- Sessão via cookie `httpOnly` + `SameSite=Lax`, assinado com JWT (`JWT_SECRET`).
- `helmet` com Content-Security-Policy restritiva; nenhum `onclick` inline — toda
  interação é ligada via `addEventListener` em módulos JS externos.
- Preço do plano sempre validado no servidor, nunca aceito do cliente.
- Assinatura dos webhooks (Mercado Pago `x-signature`, Meta `X-Hub-Signature-256`)
  verificada quando os respectivos segredos estão configurados.
- Rate limiting nos endpoints de login, checkout e webhook do WhatsApp.
