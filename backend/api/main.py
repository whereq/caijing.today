"""FastAPI application entry point for the caijing.today read API."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from caijing.config import get_settings
from caijing.database import async_engine, check_db
from caijing.schema_check import check_schema_drift
from api.routes import categories, health, market, news, search

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting caijing.today API...")
    try:
        await check_db()
        logger.info("Shared database reachable")
        # Surface read-model drift early (non-fatal) — the collector, in the
        # flowdesk repo, owns this schema; our mirror must track it.
        drift = await check_schema_drift(async_engine)
        if drift:
            logger.warning("Read-model schema drift detected: %s", drift)
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        logger.warning("Shared database not reachable at startup: %s", exc)
    yield
    logger.info("Shutting down caijing.today API...")


app = FastAPI(
    title="caijing.today API",
    description="Chinese/English finance-news aggregation — read API (shares the flowdesk.top database + collector)",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(news.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "caijing.today API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host=settings.api_host, port=settings.api_port, reload=True)
