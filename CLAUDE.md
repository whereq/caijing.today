# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**财经今日 / Caijing Today** (`caijing.today`) is a **bilingual (Chinese/English) finance-news aggregation platform** — hot headline rankings, a 7×24 newsflash, category browsing, article pages, market-data panels (indices, sector heat, crypto, economic calendar), and search.

It is the **sibling of `flowdesk.top`** and deliberately reuses its stack and architecture. The one big difference: **caijing.today does not have its own data collector or database.** It **shares both with flowdesk.top** — the flowdesk collector populates the news tables, and this repo implements only the **read API + frontend GUI** on top of the same PostgreSQL. Treat `../flowdesk.top` as the reference implementation for anything not spelled out here.

## Repo layout

```
backend/          FastAPI read API (Python 3.12)
  caijing/        config, database, auth, models (read-only mirrors), taxonomy, seed, news_service, market_service, schema_check, timeutil
  api/            main.py + routes/ (health, categories, news, market, search) + schemas/
frontend/         React 19 + Vite + TypeScript SPA (inline-styled, CSS-var themed)
  src/pages/      Home, Category, Article, Search
  src/components/ Layout/Header/Footer/Ticker/SearchModal/Drawer + home/* section widgets
docker/           dev + prod compose, api & frontend Dockerfiles, nginx.conf
design/           the approved design mock (source of truth for the GUI) — see below
```

## Commands

```bash
# Frontend (from frontend/)
npm install
npm run dev          # Vite dev server on :5173 (proxies /api → caijing-api:8000)
npm run build        # tsc type-check + vite production build
npm run lint         # eslint, zero-warnings gate
npx tsc --noEmit     # type-check only

# Backend (from backend/)
pip install -r requirements.txt
uvicorn api.main:app --reload      # serves :8000, docs at /docs
python -m compileall caijing api   # quick syntax check
pytest                             # incl. schema-drift guard (skips if no DB)
ruff check .

# Full stack via Docker (from repo root). Requires flowdesk's shared db + network:
#   cd ../flowdesk.top && docker compose -f docker/docker-compose.postgres.yml up -d
docker compose -f docker/docker-compose.dev.yml up -d      # api :8001, frontend :5174
docker compose -f docker/docker-compose.yml up -d --build  # prod: api :8004, web :8084
```

Host ports are offset from flowdesk (api **8001**, dev web **5174**, prod web **8082**) so both apps coexist on the shared host.

## Architecture & key decisions

- **Shared DB, read-only.** `caijing/models/market_intelligence.py` is a *mirror* of flowdesk's `market_news_items` / `market_signals` / `sector_intelligence` tables (note `extend_existing=True`). This repo **never** runs migrations or writes these tables — Alembic in the flowdesk repo owns the schema. The collector (flowdesk) is the sole **writer**; caijing is a **reader** — the duplication is the table *shape*, not CRUD logic.
- **Schema-drift guard.** Because the mirror is hand-written against a schema another repo owns, `caijing/schema_check.py` compares each mirrored model's declared columns against the live DB. It runs as a `pytest` gate (`tests/test_schema_drift.py`, skips when no DB) and logs a non-fatal warning at API startup. When flowdesk ships the `cj_*` sidecar tables, add their read-model mirrors under `caijing/models/` **and** append them to `MIRRORED_MODELS`.
- **`cj_*` tables are LIVE.** The collector (**whereq-collector**, in the whereq-data-platform repo) writes 10 `cj_*` tables into the shared DB. caijing reads them via mirrors in `caijing/models/caijing_market.py`. `market_service.py` serves `/market/*` from `cj_market_quote` (ticker via `show_in_ticker`, mini-charts via `show_in_charts` + `sparkline`), `cj_sector_heat` (latest `as_of`), `cj_crypto_coin/chain/listing` + `cj_market_metric` (`group="crypto"`), `cj_econ_event` (today..+2d), `cj_trending_keyword` (latest `as_of`). `/news/*` reads the **`cj_news_feed` VIEW** (a flat `market_news_items ⨝ cj_news_meta ⨝ market_signals` join, mirror `CjNewsFeed`), preferring meta's `category`/`title_*`/`summary_*`/`heat`; `/news/flash` reads `cj_flash`. Note: `cj_market_metric.group` is a reserved word → mapped as attribute `group_`.
- **`cj_news_feed` view + fallback.** The view is owned/created by the platform migration (DDL: `docs/CJ_NEWS_FEED_VIEW.sql`) — caijing never runs DDL. `news_service` reads the view first; if it isn't deployed it detects the missing-relation error, falls back to the equivalent in-Python 3-way join, and re-probes every 5 min (`_view_state`), so creating the view is a no-downtime switch. If you change the view's columns, update `CjNewsFeed` and the DDL together.
- **Category taxonomy** (`caijing/taxonomy.py`): 12 categories — `macro, equities, us, bonds, fx, commodities, crypto, realestate, tech, companies, policy, opinion`. `cj_news_meta.category` is authoritative (all rows tagged); `classify()` is only the safety net for any untagged row. The **same 12 (id/cn/en/color)** are duplicated in `frontend/src/lib/categories.ts` for instant rendering — change both together.
- **Timestamps are naive UTC** (`timestamp WITHOUT time zone`). Serialize via `caijing/timeutil.iso_utc()` so the browser parses them as UTC, not local (otherwise "x minutes ago" skews by the client offset).
- **Seed fallback** (`caijing/seed.py`, `SEED_FALLBACK_ENABLED`, **default off**): only for offline/local dev with no DB. When a table is reachable-but-empty (e.g. `cj_sector_heat`, `cj_crypto_listing` can be empty), endpoints return `[]` and the GUI renders nothing — that is expected, not an error.
- **Auth is optional.** News browsing is public (`OptionalUser`), unlike flowdesk. caijing.today has its **own Keycloak realm** — realm `caijing.today-realm`, SPA client `caijing.today-spa`, admin role `cj-admin` — served at `https://keytomarvel.com` (non-www; www 301-redirects, which breaks OIDC). Use `CurrentUser` only where a signed-in user is genuinely required.
- **Frontend styling** intentionally does **not** use Tailwind (flowdesk does). The design is a self-contained inline-styled mock; the port keeps inline styles + the design's CSS custom properties in `src/index.css`. Finance colour convention: **`--up` = red (rising), `--down` = green (falling)** — the Chinese convention. Keep it.
- **i18n**: `react-i18next`, locales `zh`/`en` in `src/i18n/locales`. UI chrome comes from locale files; news/market content is bilingual from the API (`*_cn`/`*_en` fields) resolved by `src/lib/format.ts` helpers, which fall back to whichever language is present.

## The `design/` mock

`design/Finance-news-aggregation-platform.zip` extracts (to the git-ignored `design/extracted/`) a self-contained "dc" prototype (`Caijing Today.dc.html`) — the **authoritative visual + data-model reference**. The frontend is a faithful React port of it; `support.js` is its generated runtime and is prototype-only (do not build on it). When changing the GUI, reconcile against this mock.
