# Prompt — Extend the flowdesk.top collector to feed caijing.today

Copy everything inside the fence below into a Claude Code session opened in
`/home/whereq/git/flowdesk.top`. It is self-contained; the agent should read the
referenced files in both repos before writing code.

---

````text
You are working in the flowdesk.top repo (/home/whereq/git/flowdesk.top). A sibling
product, **caijing.today** (/home/whereq/git/caijing.today), is a bilingual
(中文/English) finance-NEWS aggregation site. It deliberately shares THIS project's
PostgreSQL database and data collector — it has no collector or DB of its own, only a
read API + GUI. Your job: **extend the flowdesk collector and evolve the shared schema
(via Alembic) so caijing.today can serve real data instead of its current seed
fallback.** flowdesk.top itself must keep working unchanged.

## 0. Read first (do not skip)

flowdesk (this repo):
- CLAUDE.md — architecture, golden rules, collector conventions, provider priority.
- backend/collector/scheduler.py — DataCollectionScheduler, how jobs are registered/named.
- backend/collector/market_hours.py — exchange open/close gating.
- backend/flowdesk/models/market_intelligence.py — MarketNewsItem / MarketSignal / SectorIntelligence (already populated).
- backend/flowdesk/models/__init__.py, backend/flowdesk/database.py — Base + model registration.
- backend/alembic/ + alembic.ini — migration setup and the latest revision number.
- backend/flowdesk/llm_gateway.py / llm_platform.py — existing LLM pipeline (for optional bilingual fill).

caijing (the consumer — read these to lock the exact contract you must satisfy):
- caijing.today/backend/caijing/taxonomy.py — the 12 categories (id/cn/en/color) + classify().
- caijing.today/backend/api/schemas/news.py and market.py — the EXACT response shapes/field names.
- caijing.today/backend/caijing/seed.py — the placeholder data you are replacing (shows every field, unit, and example value: 亿 for inflow, sparkline scale 0–30, per-coin/chain colors, importance 1–3, etc.).
- caijing.today/design/ — the approved GUI mock (unzip design/*.zip if needed) for visual/unit reference.

## 1. Hard constraints (flowdesk golden rules apply)

1. **Never break flowdesk.** Additive changes only. Do not alter existing columns/tables
   in a way that changes flowdesk behavior. New tables are `cj_`-prefixed and owned by caijing.
2. **Alembic owns the schema.** All schema changes go through a new migration. Never
   `create_all`. Bump to the next revision number after the current head.
3. **Free / no-key providers preferred**, per flowdesk's provider philosophy. Reuse
   existing deps first: **AKShare** (Chinese indices, sector money-flow, 7×24 flash,
   economic calendar, hot-search) and **yfinance** (global indices/FX/commodities).
   For crypto use free public APIs: CoinGecko (prices + global cap), DefiLlama (chain TVL),
   alternative.me (Fear & Greed). Anything requiring a paid key must be optional and
   degrade gracefully (leave rows stale rather than crash).
4. **Market-hours aware** where it matters (indices, sector flow) via market_hours.py;
   crypto and flash run 24/7. Off-hours cadences relax, like existing jobs.
5. **No hard deletes.** Snapshot tables carry `as_of`; the API reads the latest snapshot.
6. Match existing code style: SQLAlchemy 2.0 `Mapped`/`mapped_column`, one model file,
   register in models/__init__.py, jobs in scheduler.py with named tasks (add them to the
   "Scheduled Jobs — Named Task Vocabulary" table in CLAUDE.md).

## 2. What caijing needs (contract → target tables)

caijing's API currently fakes these; after your work it reads them from the shared DB.
Field names below MUST match caijing/backend/api/schemas so the read side is a drop-in swap.

| caijing endpoint | Needs | New table(s) |
|---|---|---|
| `/news/hot`, `/news/latest`, `/news/category/{cat}`, `/news/boards` | category + bilingual title/summary + heat per news item | `cj_news_meta` (sidecar on market_news_items) |
| `/news/{id}` (article) | same + body/tags (reuse existing summary/theme_tags) | `cj_news_meta` |
| `/news/flash` | 7×24 newswire, bilingual short text | `cj_flash` |
| `/market/quotes` (ticker + global) & `/market/charts` (mini sparklines) | indices, FX, commodities, crypto price, rates | `cj_market_quote` |
| `/market/sectors` | sector heat + net inflow (亿) | `cj_sector_heat` |
| `/market/crypto` | coins, chains (TVL/gas), new listings, stats (total cap, fear&greed) | `cj_crypto_coin`, `cj_crypto_chain`, `cj_crypto_listing`, `cj_market_metric` |
| `/market/calendar` | economic calendar w/ importance 1–3, forecast | `cj_econ_event` |
| `/market/keywords` | trending keywords (bilingual) | `cj_trending_keyword` |

## 3. Schema changes — new models + Alembic migration

Create `backend/flowdesk/models/caijing_market.py` with the models below (adapt types to
match repo conventions). Register them in `backend/flowdesk/models/__init__.py` so Alembic
autogenerate sees them. Then create ONE migration
(`alembic revision --autogenerate -m "caijing market data + news meta"`), review the
generated DDL against the spec, and `alembic upgrade head`.

```python
# backend/flowdesk/models/caijing_market.py
from datetime import date, datetime
from typing import Optional
from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, Index, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from flowdesk.database import Base

class CjNewsMeta(Base):
    """caijing presentation sidecar for a market_news_items row (1:1)."""
    __tablename__ = "cj_news_meta"
    __table_args__ = (
        UniqueConstraint("news_item_id", name="uq_cj_news_meta_item"),
        Index("ix_cj_news_meta_cat_heat", "category", "heat"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    news_item_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)  # FK market_news_items.id
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # one of caijing taxonomy ids
    title_cn: Mapped[Optional[str]] = mapped_column(Text)
    title_en: Mapped[Optional[str]] = mapped_column(Text)
    summary_cn: Mapped[Optional[str]] = mapped_column(Text)
    summary_en: Mapped[Optional[str]] = mapped_column(Text)
    heat: Mapped[float] = mapped_column(Float, default=0.0)   # 0–100 ranking score
    is_flash: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjFlash(Base):
    """7×24 newsflash wire (short items, high volume)."""
    __tablename__ = "cj_flash"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_cj_flash_source"),
        Index("ix_cj_flash_published", "published_at"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    text_cn: Mapped[Optional[str]] = mapped_column(Text)
    text_en: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[Optional[str]] = mapped_column(String(255))
    importance: Mapped[int] = mapped_column(SmallInteger, default=1)
    url: Mapped[Optional[str]] = mapped_column(Text)

class CjMarketQuote(Base):
    """Ticker / global-markets rows and mini-chart sparklines."""
    __tablename__ = "cj_market_quote"
    __table_args__ = (UniqueConstraint("symbol", name="uq_cj_quote_symbol"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. 000001.SS, CNY=X, GC=F, BTC-USD
    name_cn: Mapped[str] = mapped_column(String(64), nullable=False)
    name_en: Mapped[str] = mapped_column(String(64), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(16), nullable=False)  # index|fx|commodity|crypto|rate
    value: Mapped[str] = mapped_column(String(32), nullable=False)  # pre-formatted, e.g. "3,418.62"
    change: Mapped[str] = mapped_column(String(32), default="")     # e.g. "+1.24%" / "-2.1bp"
    direction: Mapped[int] = mapped_column(SmallInteger, default=0) # 1 up / -1 down
    sparkline: Mapped[Optional[list]] = mapped_column(JSONB)        # array of floats for /market/charts
    show_in_ticker: Mapped[bool] = mapped_column(Boolean, default=True)
    show_in_charts: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjSectorHeat(Base):
    __tablename__ = "cj_sector_heat"
    __table_args__ = (
        UniqueConstraint("name_en", "region", "as_of", name="uq_cj_sector_snapshot"),
        Index("ix_cj_sector_asof", "as_of"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name_cn: Mapped[str] = mapped_column(String(64), nullable=False)
    name_en: Mapped[str] = mapped_column(String(64), nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    net_inflow: Mapped[float] = mapped_column(Float, default=0.0)  # 亿 (hundred million CNY)
    region: Mapped[str] = mapped_column(String(10), default="CN")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjCryptoCoin(Base):
    __tablename__ = "cj_crypto_coin"
    __table_args__ = (UniqueConstraint("symbol", name="uq_cj_coin_symbol"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    name_cn: Mapped[str] = mapped_column(String(64), default="")
    name_en: Mapped[str] = mapped_column(String(64), default="")
    price: Mapped[str] = mapped_column(String(32), default="")
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    color: Mapped[str] = mapped_column(String(9), default="#888888")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjCryptoChain(Base):
    __tablename__ = "cj_crypto_chain"
    __table_args__ = (UniqueConstraint("name_en", name="uq_cj_chain_name"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name_cn: Mapped[str] = mapped_column(String(64), default="")
    name_en: Mapped[str] = mapped_column(String(64), nullable=False)
    tvl: Mapped[str] = mapped_column(String(16), default="")   # e.g. "$62.4B"
    gas: Mapped[str] = mapped_column(String(16), default="")   # gwei, e.g. "14"
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    color: Mapped[str] = mapped_column(String(9), default="#888888")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjCryptoListing(Base):
    __tablename__ = "cj_crypto_listing"
    __table_args__ = (UniqueConstraint("symbol", "venue_en", name="uq_cj_listing"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    venue_cn: Mapped[str] = mapped_column(String(64), default="")
    venue_en: Mapped[str] = mapped_column(String(64), default="")
    listed_date: Mapped[str] = mapped_column(String(10), default="")  # "08-11"
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjMarketMetric(Base):
    """Generic bilingual key/value metrics (crypto total cap, Fear & Greed, …)."""
    __tablename__ = "cj_market_metric"
    __table_args__ = (UniqueConstraint("metric_key", name="uq_cj_metric_key"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    metric_key: Mapped[str] = mapped_column(String(48), nullable=False)  # e.g. crypto_total_cap
    group: Mapped[str] = mapped_column(String(24), default="")           # e.g. crypto
    key_cn: Mapped[str] = mapped_column(String(48), default="")
    key_en: Mapped[str] = mapped_column(String(48), default="")
    value_cn: Mapped[str] = mapped_column(String(48), default="")
    value_en: Mapped[str] = mapped_column(String(48), default="")
    direction: Mapped[int] = mapped_column(SmallInteger, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjEconEvent(Base):
    __tablename__ = "cj_econ_event"
    __table_args__ = (
        UniqueConstraint("event_date", "name_en", "country", name="uq_cj_econ_event"),
        Index("ix_cj_econ_date", "event_date"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_time: Mapped[str] = mapped_column(String(8), default="")   # "21:30"
    importance: Mapped[int] = mapped_column(SmallInteger, default=1) # 1–3 stars
    name_cn: Mapped[str] = mapped_column(String(128), default="")
    name_en: Mapped[str] = mapped_column(String(128), default="")
    forecast: Mapped[str] = mapped_column(String(32), default="—")
    previous: Mapped[str] = mapped_column(String(32), default="")
    actual: Mapped[str] = mapped_column(String(32), default="")
    country: Mapped[str] = mapped_column(String(8), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CjTrendingKeyword(Base):
    __tablename__ = "cj_trending_keyword"
    __table_args__ = (
        UniqueConstraint("keyword_en", "as_of", name="uq_cj_kw_snapshot"),
        Index("ix_cj_kw_asof", "as_of"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    keyword_cn: Mapped[str] = mapped_column(String(64), default="")
    keyword_en: Mapped[str] = mapped_column(String(64), default="")
    rank: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

If autogenerate misbehaves, hand-write the migration: `op.create_table(...)` for each of
the above in `upgrade()`, and `op.drop_table(...)` in reverse order in `downgrade()`.

## 4. Collector jobs to add (scheduler.py)

Register each as a named task following existing patterns; gate with market_hours where noted.

1. **CaijingNewsTag** — every 15 min. For each market_news_items row lacking a
   cj_news_meta row (and each newly-processed one), upsert cj_news_meta:
   - `category`: import and reuse caijing's mapping logic (port `classify()` from
     caijing.today/backend/caijing/taxonomy.py — signal_type + sectors_affected + regions
     + theme_tags + title). Keep ONE source of truth; if you prefer, add the classifier to
     flowdesk and have caijing import it — otherwise duplicate and note it.
   - `title_cn`/`title_en`/`summary_cn`/`summary_en`: for Chinese-language items fill *_cn
     from the row and *_en from market_signals.summary_en (if present); vice-versa for
     English items. OPTIONAL: use the existing LLM gateway to translate the missing side
     (cost-gated, small batch), mirroring how market_signals already produces bilingual
     summaries. Skip translation if disabled.
   - `heat`: 0–100 from recency + signal confidence + any source engagement counts
     available (e.g. AKShare hot-rank read/comment counts). Deterministic and monotonic-ish.
   - `is_flash`: false here (flash has its own table).

2. **CaijingFlash** — every 1–2 min (24/7; relax to ~10 min when all target markets closed).
   Ingest the 7×24 wire via AKShare: `stock_info_global_cls` (财联社电报), `stock_info_global_sina`,
   `stock_info_global_em`. Dedup by (source, source_id). Chinese text → text_cn; leave text_en
   null unless the optional translator is on. Set importance from any provider flag (red/star).

3. **CaijingMarketQuotes** — every 5 min during any relevant market's hours; every 30 min
   off-hours. Populate cj_market_quote for the design's set: A-share indices (上证/深证/创业板
   via AKShare `stock_zh_index_spot_em`), 恒生/纳斯达克/标普 + 美元人民币 + COMEX黄金 + 布伦特原油 +
   10年期国债 + CNH/JPY via yfinance, 比特币 via CoinGecko. Format `value`/`change` as display
   strings (match seed.py). Maintain intraday `sparkline` (last ~10 points, scale ~0–30 like the
   mock) for the four `show_in_charts=true` rows (上证/恒生/COMEX黄金/美元人民币). Set sort_order.

4. **CaijingSectorHeat** — every 15 min during CN market hours. AKShare industry board money
   flow (`stock_sector_fund_flow_rank` or `stock_board_industry_name_em` + fund flow). Write a
   fresh snapshot with today's `as_of`; name_cn/name_en, change_pct, net_inflow in 亿, sort_order
   by inflow desc.

5. **CaijingCrypto** — every 10 min (24/7).
   - Coins: CoinGecko markets for BTC/ETH/SOL/BNB/XRP/TON (extendable) → price, change_pct;
     keep the design's brand colors.
   - Chains: DefiLlama `/chains` (and `/v2/historicalChainTvl` for change) → tvl formatted
     ("$62.4B"); gas gwei via a free RPC/gas oracle (optional, may be "").
   - Listings: best-effort (CoinGecko new coins / exchange announcement feeds). If no reliable
     free source, leave the table empty rather than fabricate.
   - Metrics: crypto_total_cap (CoinGecko global) and fear_greed (alternative.me) into cj_market_metric.

6. **CaijingEconCalendar** — daily 00:30 UTC + refresh actuals hourly. AKShare economic calendar
   (`news_economic_baidu` or equivalent). Map importance to 1–3 stars, fill forecast/previous/actual,
   name_cn always; name_en via a small static label map or the translator.

7. **CaijingTrending** — hourly. Aggregate market_signals.theme_tags over the last 24h (frequency-
   weighted, recency-decayed) → top ~12 keywords; optionally blend a hot-search feed
   (AKShare `stock_hot_search_baidu` / `stock_hot_rank_em`). Write a snapshot with today's as_of,
   keyword_cn always, keyword_en via label map/translator.

Also: **extend news source coverage** so market_news_items carries Chinese finance outlets the
design lists (新浪财经/东方财富/财新/第一财经/华尔街见闻/雪球). Add/enable AKShare `stock_news_em` and
available RSS/API feeds in the existing news collector; set `region`/`language` correctly. This is
what makes CaijingNewsTag/categories meaningful.

## 5. Acceptance criteria

- `alembic upgrade head` creates all `cj_*` tables; `alembic downgrade -1` cleanly reverses.
- flowdesk's own jobs and API are unaffected (run its test suite / smoke the existing endpoints).
- After one scheduler cycle, every `cj_*` table has rows (except cj_crypto_listing if no free source).
- Values look right vs. caijing.today/backend/caijing/seed.py (units: 亿 inflow, importance 1–3,
  sparkline scale, colors, bilingual fields).
- Add the new jobs to CLAUDE.md's "Named Task Vocabulary" table with cadence + provider.

## 6. Handoff back to caijing (list for the caijing agent — do not edit that repo yourself)

Report the FINAL table + column names you shipped. The caijing side will then:
1. Add read-only ORM mirrors of the `cj_*` tables (like its existing market_intelligence mirror).
2. Point `/market/*` at cj_market_quote / cj_sector_heat / cj_crypto_* / cj_market_metric /
   cj_econ_event / cj_trending_keyword, `/news/flash` at cj_flash, and `/news/*` at
   market_news_items ⨝ cj_news_meta (preferring cj_news_meta.category over its local classify()).
3. Set `SEED_FALLBACK_ENABLED=false`.

Keep the contract stable: if you must rename a field, say so explicitly so caijing can follow.
````
