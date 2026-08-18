"""Search endpoint (public)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from caijing import news_service
from caijing.database import get_db
from api.schemas.news import NewsCard

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=list[NewsCard])
async def search_news(
    q: str = Query(default="", description="Free-text query over titles + summaries"),
    range: str = Query(default="30d"),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    hours = news_service.range_to_hours(range)
    return await news_service.search(db, query=q, hours=hours, limit=limit)
