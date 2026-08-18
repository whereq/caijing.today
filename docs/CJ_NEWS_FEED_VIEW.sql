-- cj_news_feed — flat, presentation-ready news feed for caijing.today.
--
-- OWNERSHIP: this VIEW belongs on the platform/collector side (whereq-data-platform),
-- created by a migration alongside the cj_* tables — caijing.today never runs DDL.
-- It joins flowdesk's market_news_items + market_signals with the collector's
-- cj_news_meta so the read API maps ONE flat relation instead of composing a 3-way
-- join in Python.
--
-- Contract: the column names below are mirrored 1:1 by
-- caijing.today/backend/caijing/models/caijing_market.py::CjNewsFeed. If you change a
-- column name/type here, tell the caijing side (its schema-drift guard will also flag it).
-- Until this view exists, caijing falls back to the equivalent in-Python join and
-- re-probes every 5 minutes, so deploying this is a transparent, no-downtime switch.

CREATE OR REPLACE VIEW cj_news_feed AS
SELECT
    n.id               AS id,
    n.source           AS source,
    n.region           AS region,
    n.language         AS language,
    n.url              AS url,
    n.published_at     AS published_at,
    n.title            AS raw_title,
    n.summary          AS raw_summary,
    m.category         AS category,
    m.title_cn         AS title_cn,
    m.title_en         AS title_en,
    m.summary_cn       AS summary_cn,
    m.summary_en       AS summary_en,
    m.heat             AS heat,
    m.is_flash         AS is_flash,
    s.signal_type      AS signal_type,
    s.sectors_affected AS sectors_affected,
    s.regions          AS regions,
    s.theme_tags       AS theme_tags,
    s.confidence       AS confidence,
    s.sentiment        AS sentiment,
    s.summary_zh       AS sig_summary_cn,
    s.summary_en       AS sig_summary_en
FROM market_news_items n
LEFT JOIN cj_news_meta   m ON m.news_item_id = n.id
LEFT JOIN market_signals s ON s.news_item_id = n.id;

-- Optional but recommended for the feed's ORDER BY published_at DESC + window filter:
--   CREATE INDEX IF NOT EXISTS ix_news_published_at ON market_news_items (published_at);
-- (market_news_items already indexes published_at in the flowdesk schema.)

-- Rollback: DROP VIEW IF EXISTS cj_news_feed;
