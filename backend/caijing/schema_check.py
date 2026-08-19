"""Schema-drift guard for the read-only mirror.

caijing.today maps a subset of columns on tables that flowdesk.top's Alembic
migrations own. If flowdesk renames or drops a column caijing reads, our SELECTs
would fail at query time. This module compares each mirrored model's DECLARED
columns against the LIVE database and reports any that have gone missing, so the
drift surfaces as a loud test/log failure instead of a runtime 500.

Used by:
  - tests/test_schema_drift.py  (CI / dev-with-DB gate)
  - api.main lifespan            (non-fatal warning at startup)

When the flowdesk collector work ships the `cj_*` sidecar tables and caijing adds
read-model mirrors for them, append those models to MIRRORED_MODELS.
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine

from caijing import models

logger = logging.getLogger(__name__)

# Every model caijing maps onto the shared, collector-owned schema.
MIRRORED_MODELS = [
    models.MarketNewsItem,
    models.MarketSignal,
    models.SectorIntelligence,
    models.CjNewsMeta,
    models.CjFlash,
    models.CjMarketQuote,
    models.CjSectorHeat,
    models.CjCryptoCoin,
    models.CjCryptoChain,
    models.CjCryptoListing,
    models.CjMarketMetric,
    models.CjEconEvent,
    models.CjTrendingKeyword,
    models.CjHotStock,  # finance 热榜; skipped by the guard until the collector deploys it
    models.CjNewsFeed,  # a VIEW; skipped by the guard until it is deployed
]


def _declared_columns(model) -> set[str]:
    return {c.name for c in model.__table__.columns}


async def check_schema_drift(engine: AsyncEngine) -> dict[str, list[str]]:
    """Return {table: [missing columns]} for mirrors that have drifted.

    A table that is absent from the DB entirely is treated as "not deployed yet"
    (skipped, not drift) so fresh dev databases don't trip the guard. Raises if
    the database is unreachable — the caller decides whether to skip or warn.
    """

    def _inspect(sync_conn) -> dict[str, list[str]]:
        insp = inspect(sync_conn)
        drift: dict[str, list[str]] = {}
        for m in MIRRORED_MODELS:
            table = m.__tablename__
            if not insp.has_table(table):
                continue  # schema not deployed here — not a drift signal
            actual = {c["name"] for c in insp.get_columns(table)}
            missing = sorted(_declared_columns(m) - actual)
            if missing:
                drift[table] = missing
        return drift

    async with engine.connect() as conn:
        return await conn.run_sync(_inspect)
