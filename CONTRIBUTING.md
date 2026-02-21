# Contributing

Thanks for your interest in contributing to **ValerPay**.

## Local setup (quick)
1. Install Node.js (LTS recommended).
2. Copy env templates:
   - `cp .env.example src/backend/.env`
   - `cp .env.example src/frontend/admin/.env.local`
   - `cp .env.example src/frontend/user/.env.local`
3. Install deps (per app):
   - `cd src/backend && npm install`
   - `cd ../frontend/admin && npm install`
   - `cd ../user && npm install`
4. Init DB (backend):
   - `cd src/backend`
   - `npx prisma migrate dev`
   - `npx prisma db seed`
5. Run:
   - Backend: `npm run start:dev` (port 3001)
   - Admin: `npm run dev -- -p 3000`
   - User:  `npm run dev -- -p 3002`

## Branching & PR rules
- Branch naming: `feat/...`, `fix/...`, `chore/...`, `docs/...`
- Keep PRs small and focused.
- CI must pass (build + lint + tests).
- Do **not** commit secrets, DB files, or build artifacts.
