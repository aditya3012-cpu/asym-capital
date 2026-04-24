from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.routes import contact, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ASYM Capital API",
    version="1.0.0",
    docs_url="/api/docs" if settings.APP_ENV != "production" else None,
    redoc_url=None,
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ──────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api")
app.include_router(contact.router, prefix="/api")


# ── Catch-all 404 for /api/* routes ─────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=404,
            content={"status": "error", "message": "API endpoint not found."},
        )
    # Let the static file handler deal with non-API 404s (SPA fallback)
    return JSONResponse(
        status_code=404,
        content={"status": "error", "message": "Not found."},
    )


# ── Static files (frontend) ──────────────────────────────────────────────────
_frontend_dir = Path(__file__).parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")


# ── Startup log ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "8000")
    logger.info(
        "ASYM Capital API — %s — listening on %s:%s",
        settings.APP_ENV,
        host,
        port,
    )
