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

Scripts úteis: `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `start:prod`.

## Frontend

```bash
cd frontend
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:3001
npm install
npm run web          # http://localhost:8081
# npm run start      # Expo Go
```

## Conta de teste

- Email: `demo@sof.com` (ou `SEED_DEMO_EMAIL`)  
- Senha: valor de `SEED_DEMO_PASSWORD` no `backend/.env`  
- Profissional demo (após seed): `marcelo@demo.sof` / mesma senha — em `/login` (troca no 1º acesso)  

Não commitar `.env`.

## Variáveis locais importantes

Ver lista completa em `backend/.env.example` e `frontend/.env.example`.

| Variável | Uso local típico |
|----------|------------------|
| `CORS_ORIGIN` | `http://localhost:8081` |
| `PUBLIC_URL` | `http://localhost:8081` |
| `JWT_SECRET` | qualquer string longa em dev |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3001` |

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
```
