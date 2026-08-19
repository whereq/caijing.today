# Prompt — Add a finance hot-ranking (个股热榜) feed for caijing.today

caijing.today now has a read-only `cj_hot_stock` mirror + `/market/hotstocks`
endpoint + a "Hot Stocks / 个股热榜" home panel, all wired to **degrade to nothing
until this table is populated** (the panel hides while the feed returns `[]`). This
prompt asks the **whereq-collector** side (the sole writer of the `cj_*` tables, in
the whereq-data-platform repo) to produce that feed.

It captures the design we settled on after studying tophub.today: a **layered**
approach — ship **Path A** (aggregate external finance hot-lists) first to light up
the panel, and in parallel start **Path B** (a native, time-decayed heat score over
our own ingested articles) so we graduate from passthrough to a finance-specific
signal nobody else has.

Copy everything in the fence into a Claude Code session opened in the
whereq-collector / whereq-data-platform repo.

---

````text
You are working in the whereq-collector repo (the writer of the shared whereq-db
`cj_*` tables). A sibling product, **caijing.today**, is a bilingual (中文/English)
finance-news site that only READS this database. It has just added a read-only
mirror, endpoint, and GUI panel for a finance hot-ranking and needs you to populate
the source table. Your job: **produce a `cj_hot_stock` snapshot feed (Path A) and,
as a follow-up, a native decayed heat score (Path B).** Do not break any existing
collector job.

## 0. Read first (do not skip)
- This repo's CLAUDE.md / scheduler / Alembic setup and the existing `cj_*` writers
  (cj_market_quote, cj_sector_heat, cj_trending_keyword…) — match their conventions:
  snapshot tables carry an `as_of`, no hard deletes, additive migrations only, free/
  no-key providers preferred (AKShare, yfinance), market-hours awareness where it
  matters.
- caijing.today/backend/caijing/models/caijing_market.py :: `CjHotStock` — the EXACT
  column contract you must satisfy (names + types below).
- caijing.today/backend/api/schemas/market.py :: `HotStock` — the response shape the
  GUI consumes (`rank, symbol, name_cn, name_en, market, heat, change_pct, trend,
  url`).

## 1. Target table (Path A) — `cj_hot_stock`
One row per ranked stock per snapshot batch. Create via a NEW Alembic revision
(bump from current head); never create_all. Suggested DDL:

    CREATE TABLE cj_hot_stock (
        id          BIGSERIAL PRIMARY KEY,
        as_of       TIMESTAMP        NOT NULL,   -- snapshot batch instant, naive UTC
        rank        INTEGER          NOT NULL,   -- 1..N within (as_of, market)
        symbol      VARCHAR          NOT NULL,   -- 600519 | 00700 | AAPL
        name_cn     VARCHAR,
        name_en     VARCHAR,
        market      VARCHAR,                      -- cn | hk | us
        heat        DOUBLE PRECISION,            -- NORMALIZED 0..100 (see §3)
        change_pct  DOUBLE PRECISION,            -- price change %, sign meaningful
        price       VARCHAR,                      -- optional pre-formatted display
        source      VARCHAR,                      -- xueqiu | eastmoney | cls | blended
        trend       SMALLINT,                     -- 1 new / 0 steady / -1 cooling vs prev batch
        url         TEXT,                         -- link to quote/discussion (optional)
        updated_at  TIMESTAMP
    );
    CREATE INDEX ix_cj_hot_stock_as_of ON cj_hot_stock (as_of);
    CREATE INDEX ix_cj_hot_stock_as_of_rank ON cj_hot_stock (as_of, rank);

caijing reads only the latest `as_of` batch, ordered by `rank`. Keep history for
trend/decay; prune old batches on your own retention policy (e.g. keep 7 days).

## 2. Sources & fetchers (Path A — aggregation, ~every 5 min, market-hours aware)
Prefer AKShare (already a dependency, free, no key). It wraps the finance hot-lists
directly — use these as the input rankings:
- **雪球 人气/热帖**  → `ak.stock_hot_follow_xq` / `ak.stock_hot_tweet_xq` (股票热度-雪球)
- **东方财富 股吧人气榜** → `ak.stock_hot_rank_em` (A股) / `ak.stock_hk_hot_rank_em` (港股)
- **热搜股票**          → `ak.stock_hot_search_baidu`
- (optional US) yfinance / a free most-active endpoint for `market='us'`.
Each source yields (symbol, name, some raw popularity metric, maybe change_pct).
Fetch on the collector schedule; run cn/hk during their market hours + a relaxed
off-hours cadence; treat any source failing as non-fatal (skip it, keep the rest).

## 3. Blend + normalize + trend (the only real "algorithm")
tophub.today just passes each platform's number through; we do slightly better:
1. **Dedup across sources** by (market, normalized symbol). Keep a per-source rank.
2. **Blend** into one score. Ranks are more comparable than raw heats across
   sources, so combine by reciprocal rank with source weights:
       blended = Σ_source  w_source · 1 / (rank_source + k)      (k≈10)
   (w defaults: eastmoney 1.0, xueqiu 0.9, baidu 0.7; tune later.)
3. **Normalize** blended → `heat` in 0..100 (min-max or percentile within the batch)
   so the GUI heat bar is meaningful.
4. **Rank** = order by heat desc, assign 1..N (cap N at 50).
5. **trend**: compare symbol's rank vs the previous batch → 1 if new/rising sharply,
   -1 if falling out, else 0. (Powers the "新" badge.)
6. Write the batch with a single `as_of` = now (naive UTC via the repo's time util).

## 4. Path B (follow-up) — native decayed heat over our OWN articles
Independent of Path A. Goal: make caijing's existing `/news/hot` (which ranks by
`cj_news_meta.heat`) a real time-decayed signal instead of a static score.
- Compute, per ingested finance article, a rolling score:
      score = (w_s·log1p(views) + w_i·log1p(comments+reposts)
               + w_x·log1p(cross_source_mentions)) · source_weight · e^(−λ·age_hours)
  Start with whatever engagement signals you already have; if none, seed from
  cross-source mention count + recency (λ chosen so ~24h halves the score).
- Write the normalized 0..100 result into `cj_news_meta.heat` on your existing news
  cadence. This needs NO caijing change — `/news/hot` already reads it.
- If you begin logging real engagement (view/click counters), add an additive
  `cj_news_engagement` table; do not alter flowdesk's `market_news_items`.

## 5. Acceptance
- New Alembic revision creates `cj_hot_stock` (+ indexes); `alembic upgrade head`
  clean; downgrade drops it. No change to existing tables' behavior.
- A scheduled job writes ≥1 fresh `as_of` batch with rank 1..N, `heat` in 0..100,
  correct `market`, and sane `trend`. Missing/late sources degrade gracefully.
- Column names/types match caijing's `CjHotStock` exactly (its schema-drift guard
  and the panel both key off them).
- (Path B) `cj_news_meta.heat` reflects a decayed score; `/news/hot` reorders over
  time without any caijing deploy.

## 6. Coordinate back
If you rename/add a `cj_hot_stock` column, tell the caijing side so it updates the
mirror (caijing.today/backend/caijing/models/caijing_market.py) + `HotStock` schema
+ the panel together. Until this table exists, caijing serves `[]` and hides the
panel — so deploying this is a transparent, no-downtime switch.
````
