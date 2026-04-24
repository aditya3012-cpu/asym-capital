from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


EnquiryType = Literal[
    "systematic_trading",
    "algorithmic_execution",
    "quantitative_analytics",
    "backtesting",
    "market_signals",
    "risk_management",
    "general",
]

ENQUIRY_LABELS: dict[str, str] = {
    "systematic_trading": "Systematic Trading Strategies",
    "algorithmic_execution": "Algorithmic Execution",
    "quantitative_analytics": "Quantitative Analytics (QaaS)",
    "backtesting": "Backtesting Infrastructure",
    "market_signals": "Market Signal Intelligence",
    "risk_management": "Portfolio Risk Management",
    "general": "General Enquiry",
}


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    enquiry_type: EnquiryType = "general"
    message: str

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    @field_validator("message")
    @classmethod
    def message_min_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Message must be at least 20 characters.")
        return v

    @field_validator("company")
    @classmethod
    def company_strip(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            return v if v else None
        return v
