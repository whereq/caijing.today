"""Database connection and session management (read-only against the shared DB)."""

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from caijing.config import get_settings

settings = get_settings()

async_engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for read-only ORM models mapped onto the shared schema.

    caijing.today never creates or migrates these tables — Alembic in the
    flowdesk.top repo owns the schema. Column definitions here mirror that
    schema so SQLAlchemy can read the rows.
    """

    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency yielding a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_db() -> bool:
    """Return True if the shared database is reachable."""
    async with async_engine.connect() as conn:
        await conn.execute(sa.text("SELECT 1"))
    return True
