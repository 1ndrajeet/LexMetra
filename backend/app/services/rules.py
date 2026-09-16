# backend/app/services/rules.py
"""
Deterministic LMPC rule engine.
Loads rules/lmpc_rules.json and evaluates extracted product facts.

Principle: AI extracts. Rules decide. Never confuse the two.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("lexmetra.rules")

# Path: backend/rules/lmpc_rules.json
RULES_PATH = Path(__file__).resolve().parent.parent.parent / "rules" / "lmpc_rules.json"


# ============================================================
# LOADER
# ============================================================
def load_ruleset(path: Optional[Path] = None) -> dict:
    p = path or RULES_PATH
    if not p.exists():
        raise FileNotFoundError(f"Ruleset not found: {p}")
    data = json.loads(p.read_text(encoding="utf-8"))
    if "rules" not in data or not isinstance(data["rules"], list):
        raise ValueError("ruleset must contain a top-level 'rules' list")
    return data


# ============================================================
# HELPERS
# ============================================================
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_present(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip().lower()
    return s not in ("", "null", "none", "n/a", "na")


def _is_valid_date(v: Any) -> bool:
    if not _is_present(v):
        return False
    s = str(v).strip()
    if not _DATE_RE.match(s):
        return False
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _is_positive_number(v: Any) -> bool:
    if v is None:
        return False
    try:
        return float(v) > 0
    except (TypeError, ValueError):
        return False


# ============================================================
# APPLICABILITY
# ============================================================
def _rule_applies(rule: dict, facts: dict) -> bool:
    """Return True if the rule's applies_when conditions match the facts."""
    conds = rule.get("applies_when") or {}
    for k, expected in conds.items():
        if expected == "any":
            continue

        # isImported derives from countryOfOrigin presence
        if k == "isImported":
            actual = bool(_is_present(facts.get("countryOfOrigin")))
        else:
            actual = facts.get(k)

        if actual != expected:
            return False
    return True

# ============================================================
# VALIDATORS
# ============================================================
def _evaluate_validation(validation: str, rule: dict, facts: dict) -> tuple[str, str]:
    """
    Returns (status, reason).
    status: PASS | FAIL | UNCERTAIN
    """
    fields = rule.get("required_fields", [])
    missing = [f for f in fields if not _is_present(facts.get(f))]

    if validation == "present":
        if missing:
            return ("FAIL", f"Missing required field(s): {', '.join(missing)}")
        return ("PASS", "Field present.")

    if validation == "both_present":
        if missing:
            return ("FAIL", f"Missing required field(s): {', '.join(missing)}")
        return ("PASS", "All required fields present.")

    if validation == "positive_number":
        if missing:
            return ("FAIL", f"Missing: {', '.join(missing)}")
        for f in fields:
            if not _is_positive_number(facts.get(f)):
                return ("FAIL", f"Field '{f}' is not a positive number.")
        return ("PASS", "Positive numeric value present.")

    if validation == "date_valid":
        if missing:
            return ("FAIL", f"Missing: {', '.join(missing)}")
        for f in fields:
            if not _is_valid_date(facts.get(f)):
                return ("UNCERTAIN", f"Field '{f}' is not a valid ISO date.")
        return ("PASS", "Valid date present.")

    # Unknown validator — do not silently pass
    return ("UNCERTAIN", f"Unknown validation type: {validation}")


# ============================================================
# CHRONOLOGY CHECK (cross-rule sanity)
# ============================================================
def _check_chronology(facts: dict) -> list[dict]:
    """
    Cross-field temporal sanity: MFD <= EXPIRY, and both within plausible range.
    Returns additional findings (not tied to a specific rule).
    """
    findings = []
    mfg_s = facts.get("manufacturingDate")
    exp_s = facts.get("expiryDate")

    mfg = None
    exp = None
    try:
        if _is_valid_date(mfg_s):
            mfg = datetime.strptime(mfg_s, "%Y-%m-%d").date()
        if _is_valid_date(exp_s):
            exp = datetime.strptime(exp_s, "%Y-%m-%d").date()
    except Exception:
        pass

    if mfg and exp and mfg > exp:
        findings.append({
            "rule_id": "LMPC-CHRONOLOGY-MFG-AFTER-EXP",
            "description": "Manufacturing date cannot be after expiry date.",
            "legal_reference": "Logical consistency",
            "status": "FAIL",
            "reason": f"MFD {mfg} > EXP {exp}",
        })

    today = date.today()
    if mfg and mfg.year < today.year - 5:
        findings.append({
            "rule_id": "LMPC-CHRONOLOGY-MFG-TOO-OLD",
            "description": "Manufacturing date is implausibly old (>5 years).",
            "legal_reference": "Logical consistency",
            "status": "UNCERTAIN",
            "reason": f"MFD {mfg} is more than 5 years in the past.",
        })
    if exp and exp < today:
        findings.append({
            "rule_id": "LMPC-CHRONOLOGY-EXPIRED",
            "description": "Expiry date is in the past — product may be expired.",
            "legal_reference": "Logical consistency",
            "status": "UNCERTAIN",
            "reason": f"EXP {exp} is in the past.",
        })

    return findings


# ============================================================
# MAIN EVALUATOR
# ============================================================
def evaluate(facts: dict, ruleset: Optional[dict] = None) -> dict:
    """
    Evaluate structured facts against LMPC rules.
    Returns:
    {
      "ruleset_version": "...",
      "evaluated_at": "...",
      "overall_status": "PASS|FAIL|UNCERTAIN|EXEMPT",
      "findings": [ { rule_id, description, legal_reference, status, reason } ],
      "summary": { "pass": N, "fail": N, "uncertain": N, "not_applicable": N }
    }
    """
    rs = ruleset or load_ruleset()
    findings: list[dict] = []
    counts = {"PASS": 0, "FAIL": 0, "UNCERTAIN": 0, "NOT_APPLICABLE": 0}

    for rule in rs.get("rules", []):
        rid = rule.get("rule_id", "?")

        if not _rule_applies(rule, facts):
            findings.append({
                "rule_id": rid,
                "description": rule.get("description", ""),
                "legal_reference": rule.get("legal_reference", ""),
                "status": "NOT_APPLICABLE",
                "reason": "Rule does not apply to this product context.",
            })
            counts["NOT_APPLICABLE"] += 1
            continue

        validation = rule.get("validation", "present")
        status, reason = _evaluate_validation(validation, rule, facts)

        # Downgrade PASS -> UNCERTAIN if rule was flagged with on_uncertain
        if status == "FAIL" and rule.get("on_missing") == "UNCERTAIN":
            status = "UNCERTAIN"

        findings.append({
            "rule_id": rid,
            "description": rule.get("description", ""),
            "legal_reference": rule.get("legal_reference", ""),
            "status": status,
            "reason": reason,
        })
        counts[status] = counts.get(status, 0) + 1

    # Cross-field chronology
    # Cross-field chronology
    chrono = _check_chronology(facts)
    findings.extend(chrono)
    for f in chrono:
        counts[f["status"]] = counts.get(f["status"], 0) + 1
        
    # Overall aggregation: FAIL > UNCERTAIN > PASS
    applicable = [f for f in findings if f["status"] != "NOT_APPLICABLE"]
    if not applicable:
        overall = "EXEMPT"
    elif any(f["status"] == "FAIL" for f in applicable):
        overall = "FAIL"
    elif any(f["status"] == "UNCERTAIN" for f in applicable):
        overall = "UNCERTAIN"
    else:
        overall = "PASS"

    return {
        "ruleset_version": rs.get("ruleset_version", "unknown"),
        "authority": rs.get("authority", ""),
        "legal_reference": rs.get("legal_reference", ""),
        "evaluated_at": datetime.utcnow().isoformat(),
        "overall_status": overall,
        "findings": findings,
        "summary": counts,
    }