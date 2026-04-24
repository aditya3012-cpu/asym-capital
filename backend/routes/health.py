from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.config import settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "env": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
