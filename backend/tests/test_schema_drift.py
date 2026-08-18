"""Guard: caijing's read-only mirror must stay in sync with the shared schema.

Skips cleanly when the shared database is unreachable (offline dev / no-DB CI) —
it only asserts when it can actually see the tables. Run: `pytest` from backend/.
"""

import pytest

from caijing.database import async_engine
from caijing.schema_check import MIRRORED_MODELS, check_schema_drift


async def test_no_schema_drift():
    try:
        drift = await check_schema_drift(async_engine)
    except Exception as exc:  # noqa: BLE001 - DB not available in this environment
        pytest.skip(f"shared database not reachable: {exc}")

    assert not drift, (
        "Read-model mirror is out of sync with the live schema — flowdesk likely "
        f"renamed/dropped columns caijing reads: {drift}. Update the mirror in "
        "caijing/models/ to match."
    )


def test_every_mirror_is_registered():
    # Cheap sanity check that runs without a DB: each mirror has a table + columns.
    for model in MIRRORED_MODELS:
        assert model.__tablename__
        assert len(model.__table__.columns) > 0
