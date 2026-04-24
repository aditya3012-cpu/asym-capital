from __future__ import annotations

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    SMTP_HOST: str = "smtp.zoho.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "contact@asymcapital.in"
    SMTP_PASS: str = ""
    CONTACT_TO_EMAIL: str = "contact@asymcapital.in"
    APP_ENV: str = "development"

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        raw = os.getenv("ALLOWED_ORIGINS", "")
        if not raw:
            return ["http://localhost:8000", "http://localhost:3000", "https://asymcapital.in", "https://www.asymcapital.in"]
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
