# Sof API (NestJS + Prisma)

```bash
# na raiz do monorepo
docker compose up -d

cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3001` — health em `/api/health`.
