# 财经今日 · caijing.today

Bilingual (中文/English) finance-news aggregation platform — hot rankings, a 7×24
newsflash, category browsing, article pages, market panels (indices, sector heat,
crypto, economic calendar) and search.

Sibling of [flowdesk.top](../flowdesk.top): same tech stack and architecture.
caijing.today **shares flowdesk's PostgreSQL database and data collector** — this
repo is the **read API + frontend GUI** only.

## Stack

- **Frontend** — React 19 + Vite + TypeScript, `@tanstack/react-query`,
  `react-router`, `react-i18next`, `keycloak-js`. Inline-styled, CSS-variable
  theming (dark/light), faithful port of the approved design in `design/`.
- **Backend** — FastAPI (Python 3.12) reading the shared DB async via SQLAlchemy;
  Keycloak JWT auth (public browsing, optional sign-in).
- **Auth** — its own Keycloak realm `caijing.today` on the shared KeyToMarvel.com
  server (to be provisioned).

## Quick start

```bash
# 1. Frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# 2. Backend (separate shell)
cd backend && pip install -r requirements.txt
uvicorn api.main:app --reload                    # http://localhost:8000/docs
```

The API serves bundled sample data when the shared news tables are empty
(`SEED_FALLBACK_ENABLED=true`), so the UI works end-to-end before the collector is
wired up. Copy `backend/.env.example` → `backend/.env` and
`frontend/.env.example` → `frontend/.env` to point at real infra.

## Docker

```bash
# Shared db + network live in the flowdesk repo — start them first:
cd ../flowdesk.top && docker compose -f docker/docker-compose.postgres.yml up -d

# Then, from this repo root:
docker compose -f docker/docker-compose.dev.yml up -d   # api :8001 · web :5174
```

## Layout

| Path | Purpose |
|------|---------|
| `backend/caijing/` | config, DB, auth, read-only model mirror, taxonomy, seed, news service |
| `backend/api/` | FastAPI app + routes (`news`, `market`, `categories`, `search`, `health`) |
| `frontend/src/pages/` | `Home`, `Category`, `Article`, `Search` |
| `frontend/src/components/` | chrome (`Header`/`Footer`/`Ticker`/…) + `home/*` widgets |
| `docker/` | dev + prod compose, Dockerfiles, nginx config |
| `design/` | approved design mock — GUI source of truth |

See [CLAUDE.md](./CLAUDE.md) for architecture notes and the shared-DB/collector arrangement.

> Aggregated content · not investment advice.
