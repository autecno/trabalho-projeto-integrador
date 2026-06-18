# AI Agent Instructions

## Project overview
- Monorepo with two main apps:
  - `frontend/`: Next.js 16 + React 19 + TypeScript UI
  - `backend/`: Node.js + Fastify + TypeScript API
- Local environment is containerized via `docker-compose.yml`.
- Key docs:
  - [readme.md](./readme.md): project overview and Docker run instructions
  - [docs/descricao_sistema.md](./docs/descricao_sistema.md): system description

## Recommended work paths
- Full local startup:
  - `docker compose up --build -d`
- Frontend development:
  - `cd frontend && npm run dev`
- Backend development:
  - `cd backend && npm run dev`
- Backend tests:
  - `cd backend && npm test`
- Frontend lint:
  - `cd frontend && npm run lint`

## Architecture notes
- `frontend/src/app/` uses the Next.js App Router.
- `(public)` and `(private)` route groups separate unauthenticated and authenticated pages.
- Backend routes live in `backend/src/routes/`.
- Background work is implemented with BullMQ and Redis under `backend/src/queues/` and `backend/src/workers/`.
- Database is MySQL, configured in `docker-compose.yml`.

## Conventions and cautions
- Keep backend TypeScript files in `backend/src/` and prefer existing service/repository structure.
- The backend startup flow is in `backend/src/server.ts`.
- The frontend uses Tailwind CSS and Next.js page components under `frontend/src/app/`.
- Do not assume environment variables are present unless added to `.env` or `docker-compose.yml`.
- Use the Docker Compose setup for integrated changes involving frontend, backend, database, or Redis.

## What this file is for
- Help AI coding agents understand the repo structure quickly.
- Provide the correct commands for local development and testing.
- Point agents at the important source directories and architecture patterns.
