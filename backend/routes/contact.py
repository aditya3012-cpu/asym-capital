from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from backend.models.contact import ContactForm
from backend.services.email import send_contact_emails

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-memory rate limiter: {ip: [timestamp, ...]}
_rate_store: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 3          # max submissions
_RATE_WINDOW = 3600.0    # per hour (seconds)


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - _RATE_WINDOW
    hits = [t for t in _rate_store[ip] if t > window_start]
    _rate_store[ip] = hits
    if len(hits) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many submissions. Please try again in an hour.",
        )
    _rate_store[ip].append(now)


@router.post("/contact")
async def submit_contact(request: Request, form: ContactForm) -> dict[str, Any]:
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    try:
        await send_contact_emails(form)
    except Exception as exc:
        logger.exception("Failed to send contact email from %s: %s", form.email, exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to send message. Please try emailing us directly at contact@asymcapital.in.",
        )

    return {"status": "ok", "message": "We'll be in touch within 24 hours."}
