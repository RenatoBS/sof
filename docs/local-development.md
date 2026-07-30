# Desenvolvimento local — Sof

Documento vivo. Atualize ao mudar portas, scripts ou fluxo de setup.  
Índice: [`../AGENTS.md`](../AGENTS.md).

## Pré-requisitos

- Node.js 22.x (recomendado; Heroku usa 22.x)  
- Docker (Postgres)  
- npm  

## Subir o banco

Na raiz do monorepo:

```bash
docker compose up -d
# ou: npm run db:up
```

| Item | Valor |
|------|--------|
| Host | `localhost` |
| Porta host | `5433` |
| User / senha / DB | `sof` / `sof` / `sof` |
| Container | `sof-postgres` |

`.env` do backend (local Docker):

```env
DATABASE_URL=postgresql://sof:sof@localhost:5433/sof?schema=public
DIRECT_URL=postgresql://sof:sof@localhost:5433/sof?schema=public
```

## Backend

```bash
cd backend
cp .env.example .env   # se necessário
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3001`  
Health: `http://localhost:3001/api/health`

Scripts úteis: `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `prisma:reset-seed`, `start:prod`.

### Reset + seed (local)

Apaga contas/dados demo e recria **uma conta por plano** (Solo / Equipe / Rede), com a mesma senha `SEED_DEMO_PASSWORD`:

```bash
# na raiz
npm run backend:reset-seed

# ou no backend
npm run prisma:reset-seed
```

Não usa `migrate reset` (não dropa o schema / migrations).

## Frontend

```bash
cd frontend
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:3001
npm install
npm run web          # http://localhost:8081
# npm run start      # Expo Go
```

Sem `STRIPE_SECRET_KEY` no `.env`, o checkout continua em **modo demo**.

Para testar Stripe de verdade em local:

1. Preencha `STRIPE_SECRET_KEY` (sandbox `sk_test_…` ou restricted `rk_…`)
2. Em outro terminal: `stripe listen --forward-to localhost:3001/api/payments/webhook`
3. Cole o `whsec_…` em `STRIPE_WEBHOOK_SECRET`
4. Reinicie a API

## Admin (painel Sof)

```bash
# API admin (porta 3011)
cd admin-backend && cp .env.example .env && npm install && npm run start:dev

# UI admin (porta 8091)
cd admin-frontend && cp .env.example .env && npm install && npm run web
```

Na raiz: `npm run admin-backend:dev` / `npm run admin-frontend:web`.  
Use o **mesmo** `DATABASE_URL` do produto. Seed cria `AdminUser` + catálogo `Plan` (Solo / Equipe / Rede com entitlements) e **uma conta demo por plano**.  
Login: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults `admin@sof.com` / `admin123`).

Guias públicos (sem login): `http://localhost:8091/guides` — HTML sincronizado de `docs/guides/` via `npm run sync-guides` (também no `export:web`).

## Contas de teste (após seed / reset-seed)

Senha padrão de todas: `SEED_DEMO_PASSWORD` (default `demo123`).

| Plano | Conta | Profissional (exemplo) |
|-------|-------|------------------------|
| Solo | `demo-solo@sof.com` | `marcelo@solo.demo.sof` |
| Equipe | `demo@sof.com` (ou `SEED_DEMO_EMAIL`) | `marcelo@demo.sof` |
| Rede | `demo-rede@sof.com` | `marcelo@rede.demo.sof` |

- Login profissional em `/login` (troca de senha no 1º acesso)  
- Admin Sof: `admin@sof.com` (ou `SEED_ADMIN_EMAIL`) — painel em `:8091`

Não commitar `.env`.

## Variáveis locais importantes

Ver lista completa em `backend/.env.example`, `frontend/.env.example`, `admin-backend/.env.example`, `admin-frontend/.env.example`.

| Variável | Uso local típico |
|----------|------------------|
| `CORS_ORIGIN` | `http://localhost:8081` (produto); admin: `http://localhost:8091` |
| `PUBLIC_URL` | `http://localhost:8081` |
| `API_PUBLIC_URL` | URL pública da API (webhook WA); local pode ficar vazio → `http://localhost:3001` |
| `JWT_SECRET` | qualquer string longa em dev |
| `ADMIN_JWT_SECRET` | segredo do painel admin (admin-backend) |
| `EXPO_PUBLIC_API_URL` | produto → `:3001`; admin-frontend → `:3011` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | operador do painel admin |
| `WHATSAPP_PROVIDER` | default `uazapi` (ou `meta`) |
| `WHATSAPP_BASE_URL` | URL do servidor Uazapi |
| `WHATSAPP_ADMIN_TOKEN` | admin token Uazapi (cria instância por conta) |
| `WHATSAPP_TOKEN` | token de instância (modo legado / envio) |
| `OPENAI_API_KEY` | transcrição de áudio + NLU de frases livres do bot (opcional; sem chave, áudio recebe fallback e frases caem no menu) |

### WhatsApp local (Uazapi)

1. Preencha `WHATSAPP_PROVIDER=uazapi` (default), `WHATSAPP_BASE_URL` e **ou** `WHATSAPP_ADMIN_TOKEN` (multi-conta) **ou** `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (instância única).  
2. O Admin Token é distinto do token da instância — copie o admin no painel Uazapi.  
3. Para webhook real, use túnel HTTPS (ex. ngrok) em `API_PUBLIC_URL`.  
4. No painel Conta → Bot do WhatsApp → Escanear QR ou Usar código.  
5. Sem essas envs, o simulador em `/simulator` continua disponível.  
6. Para áudio: configure `OPENAI_API_KEY` (custo ~US$ 0,006/min via Whisper na Uazapi).  
7. Lembretes: com a API no ar (`backend:dev`), o job roda no boot e a cada 30 min. Configure antecedência/fuso em Conta → Lembrete WhatsApp (default 2h, `America/Sao_Paulo`). Precisa de instância conectada para enviar de verdade.

## Cursor — Agent Skills de design

O repo versiona skills em `.cursor/skills/`:

| Skill | Uso |
|-------|-----|
| `impeccable` | Design UI/UX (audit, polish, typeset, animate…). Rodar `/impeccable init` uma vez por produto. |
| `frontend-design` | Skill Anthropic para direção visual distinta (anti-template). |

Hook: `.cursor/hooks.json` (detector Impeccable em `preToolUse`). Em Settings → Rules, deixe **Agent Skills** habilitado.

Atualizar Impeccable: `npx impeccable install --providers=cursor --scope=project`.

Depois do polish UI: no Agent, `/impeccable init` gera `PRODUCT.md` / `DESIGN.md` para futuras iterações de design.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| API não conecta no DB | Docker off / porta 5432 ocupada | Usar 5433; `docker compose ps` |
| CORS no browser | origem não listada | Incluir a URL do Expo em `CORS_ORIGIN` |
| Prisma migrate falha (Supabase) | URL pooler / senha com `&` | Usar `DIRECT_URL`; URL-encode senha |
| DataGrip “Incorrect driver/URL” | URL colada com senha especial | Campos separados + SSL Require + porta 5432 |
| Fundo preto no web | dark mode do shell HTML | `app/+html.tsx` força paper `#F4F4F6` |
| SSE não conecta | token ausente | Login de novo; Bearer no `useRealtime` |

## Scripts na raiz

```bash
npm run db:up
npm run db:down
npm run backend:dev
npm run frontend:web
npm run admin-backend:dev
npm run admin-frontend:web
```
