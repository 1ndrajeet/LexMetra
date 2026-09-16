# backend/app/services/verification.py
"""
External authority verification adapters.
Verification is SEPARATE from compliance evaluation.
API failure MUST NOT become FAIL — it becomes API_UNAVAILABLE.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("lexmetra.verification")


# ============================================================
# RESULT
# ============================================================
@dataclass
class VerificationResult:
    status: str            # VALID | INVALID | UNVERIFIED | API_UNAVAILABLE | MALFORMED
    source: str            # FSSAI | BIS | GST | NONE
    detail: str = ""
    confidence: float = 0.0
    raw: Optional[dict] = None


# ============================================================
# FSSAI LICENSE — structural + (future) live lookup
# ============================================================
# India FSSAI license numbers are 14 digits.
_FSSAI_RE = re.compile(r"^\d{14}$")


def verify_fssai(license_number: Optional[str]) -> VerificationResult:
    """
    Verify FSSAI license number.

    STAGE 1 (today): structural validation only — 14-digit format.
    STAGE 2 (later): query the official FSSAI FoSCoS API when credentials exist.
    """
    if not license_number:
        return VerificationResult(
            status="UNVERIFIED",
            source="FSSAI",
            detail="No FSSAI license number provided.",
            confidence=0.0,
        )

    # Clean: may come as "10018042004059, 10013022001897"
    candidates = [n.strip() for n in re.split(r"[,\s;]+", license_number) if n.strip()]
    if not candidates:
        return VerificationResult(
            status="MALFORMED", source="FSSAI",
            detail="No parseable license number.", confidence=0.0,
        )

    valid = [c for c in candidates if _FSSAI_RE.match(c)]

    if not valid:
        return VerificationResult(
            status="MALFORMED",
            source="FSSAI",
            detail=f"No 14-digit FSSAI license among: {candidates}",
            confidence=0.0,
        )

    # STAGE 2 hook — replace this block when FSSAI FoSCoS API is wired
    # from app.services.external.fssai_client import lookup
    # if credentials: return lookup(valid[0])
    # else: return VerificationResult("API_UNAVAILABLE", ...)

    return VerificationResult(
        status="VALID",
        source="FSSAI",
        detail=f"Structurally valid FSSAI license(s): {valid}",
        confidence=0.6,   # structural only, not authoritative
        raw={"validated": valid, "rejected": [c for c in candidates if c not in valid]},
    )


# ============================================================
# GSTIN — structural (15 chars, checksum later)
# ============================================================
_GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$")


def verify_gstin(gstin: Optional[str]) -> VerificationResult:
    if not gstin:
        return VerificationResult("UNVERIFIED", "GST", "No GSTIN provided.")
    s = gstin.strip().upper()
    if not _GSTIN_RE.match(s):
        return VerificationResult("MALFORMED", "GST",
                                  f"GSTIN '{s}' fails structural pattern.")
    return VerificationResult("VALID", "GST",
                              f"GSTIN '{s}' structurally valid.",
                              confidence=0.5)


# ============================================================
# BIS (ISI mark) — placeholder
# ============================================================
def verify_bis(license_number: Optional[str]) -> VerificationResult:
    if not license_number:
        return VerificationResult("UNVERIFIED", "BIS", "No BIS license provided.")
    # BIS licenses are prefixed 'CM/L-' typically; skip deep validation for now
    return VerificationResult(
        status="API_UNAVAILABLE",
        source="BIS",
        detail="BIS verification API not yet integrated. Reviewer must confirm.",
        confidence=0.0,
    )


# ============================================================
# ORCHESTRATOR
# ============================================================
def verify_all(facts: dict) -> dict:
    """Run all applicable verification adapters and return a dict."""
    results = {}

    fssai_raw = facts.get("fssaiLicense")
    if fssai_raw:
        results["fssai"] = verify_fssai(fssai_raw).__dict__

    gst_raw = facts.get("gstin") or facts.get("gst")
    if gst_raw:
        results["gstin"] = verify_gstin(gst_raw).__dict__

    bis_raw = facts.get("bisLicense")
    if bis_raw:
        results["bis"] = verify_bis(bis_raw).__dict__

    return results