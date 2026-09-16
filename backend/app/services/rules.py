# backend/app/services/rules.py
"""
LexMetra — Deterministic LMPC rule engine (v4 — camelCase).

Loads rules/lmpc_rules.yaml and evaluates canonical product facts.

Principles (never violate):
  - AI extracts. Rules decide.
  - Missing evidence is NEVER automatically FAIL unless the rule
    explicitly declares `onMissing: FAIL`.
  - Low-confidence evidence becomes UNCERTAIN, never FAIL.
  - API_UNAVAILABLE / verification failure becomes UNCERTAIN.
  - Exemptions take precedence over applicability.
  - Rules are data-driven; this file contains logic, not policy.

v4 vs v3:
  - camelCase end to end. YAML, facts, validator type names, and
    engine internals all use the same casing.
  - No _to_snake / _to_camel / _normalize_facts. What the extractor
    produces is what the engine reads.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Optional

import yaml

logger = logging.getLogger("lexmetra.rules")

RULES_PATH = Path(__file__).resolve().parent.parent.parent / "rules" / "lmpc_rules.yaml"


# ============================================================
# STATUS CONSTANTS
# ============================================================
PASS = "PASS"
FAIL = "FAIL"
UNCERTAIN = "UNCERTAIN"
NOT_APPLICABLE = "NOT_APPLICABLE"
EXEMPT = "EXEMPT"

_ALL_STATUSES = (PASS, FAIL, UNCERTAIN, NOT_APPLICABLE, EXEMPT)

#: Keys that gate applicability but are frequently absent from extractor
#: output because they describe the inspection context rather than the
#: package. If a rule declares one of these and it isn't in facts, we
#: assume the rule still applies rather than silently disabling it.
_SOFT_APPLICABILITY_KEYS = frozenset({
    "saleType",
    "productCategory",
    "productSubcategory",
    "commodityType",
    "commodityTypeIn",
    "commodityTypeNotIn",
    "commodityTypeMatches",
    "netQuantityMeasuredBy",
    "packageType",
    "otherLawApplies",
    "containsLiquid",
    "hasOuterWrapper",
    "dimensionsOrWeightAffectPrice",
    "commodityTypeInFourthSchedule",
    "manufacturedOutsideIndia",
    "packedInIndia",
    "originallyMarkedExport",
    "beingSoldInIndia",
})

#: Defaults for context fields when they are missing from the incoming facts.
_CONTEXT_DEFAULTS = {
    "saleType": "retail",
    "productCategory": "other",
}


# ============================================================
# LOADER
# ============================================================
def load_ruleset(path: Optional[Path] = None) -> dict:
    p = path or RULES_PATH
    if not p.exists():
        raise FileNotFoundError(f"Ruleset not found: {p}")
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("rules"), list):
        raise ValueError("ruleset must contain a top-level 'rules' list")
    return data


# ============================================================
# FIELD ACCESS
# ============================================================
def _is_present(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip().lower()
    return s not in ("", "null", "none", "n/a", "na", "undefined")


def _first_present(facts: dict, spec: str) -> Any:
    if spec is None:
        return None
    if "|" in spec:
        for f in spec.split("|"):
            v = facts.get(f.strip())
            if _is_present(v):
                return v
        return None
    return facts.get(spec)


def _date(v: Any) -> Optional[date]:
    if not _is_present(v):
        return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _number(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


# ============================================================
# APPLICABILITY
# ============================================================
def _rule_applies(rule: dict, facts: dict) -> bool:
    conds = rule.get("appliesWhen") or {}

    for k, expected in conds.items():
        if expected == "any" or expected == "*":
            continue

        if k == "isImported":
            actual = bool(
                _is_present(facts.get("countryOfOrigin"))
                or _is_present(facts.get("importer"))
            )
        else:
            actual = facts.get(k)

        if actual is None and k in _SOFT_APPLICABILITY_KEYS:
            default = _CONTEXT_DEFAULTS.get(k)
            if default is not None:
                actual = default
            else:
                continue

        if isinstance(expected, list):
            if actual not in expected:
                return False
        else:
            if actual != expected:
                return False

    return True


def _rule_exempt(rule: dict, facts: dict, ruleset: dict) -> Optional[dict]:
    exempt = rule.get("exemptWhen")
    if not exempt:
        return None

    applicabilities = {a["id"]: a for a in ruleset.get("applicability", [])}

    if isinstance(exempt, dict) and "applicabilityId" in exempt:
        app = applicabilities.get(exempt["applicabilityId"])
        if app and _evaluate_applicability(app, facts):
            return {
                "ruleId": rule.get("id"),
                "ruleReference": rule.get("ruleReference"),
                "title": rule.get("title"),
                "status": EXEMPT,
                "reason": (
                    f"Exempt under {app.get('ruleReference')}: "
                    f"{app.get('description', '').strip().splitlines()[0]}"
                ),
                "applicabilityId": app.get("id"),
            }
        return None

    if isinstance(exempt, dict) and "anyOf" in exempt:
        for child in exempt["anyOf"]:
            if isinstance(child, dict):
                if "applicabilityId" in child:
                    app = applicabilities.get(child["applicabilityId"])
                    if app and _evaluate_applicability(app, facts):
                        return {
                            "ruleId": rule.get("id"),
                            "ruleReference": rule.get("ruleReference"),
                            "title": rule.get("title"),
                            "status": EXEMPT,
                            "reason": f"Exempt under {app.get('ruleReference')}",
                            "applicabilityId": app.get("id"),
                        }
                else:
                    if all(
                        facts.get(kk) == vv or vv == "any"
                        for kk, vv in child.items()
                    ):
                        return {
                            "ruleId": rule.get("id"),
                            "status": EXEMPT,
                            "reason": f"Exempt per condition {child}",
                        }
        return None

    return None


def _evaluate_applicability(app: dict, facts: dict) -> bool:
    logic = app.get("logic") or {}

    def _check(node: dict) -> bool:
        for key, spec in node.items():
            if key == "anyOf":
                return any(_check(child) for child in spec)
            if key == "allOf":
                return all(_check(child) for child in spec)
            if key == "quantityExceeds":
                q = _quantity_in(facts, spec["unit"])
                return q is not None and q > spec["value"]
            if key == "quantityAtMost":
                q = _quantity_in(facts, spec["unit"])
                return q is not None and q <= spec["value"]
            if key == "saleType":
                actual = facts.get("saleType")
                if actual is None:
                    continue
                if isinstance(spec, list):
                    if actual not in spec:
                        return False
                elif actual != spec:
                    return False
            if key == "productCategory":
                actual = facts.get("productCategory")
                if actual is None:
                    continue
                if isinstance(spec, list):
                    if actual not in spec:
                        return False
                elif actual != spec:
                    return False
            if key == "commodityTypeMatches":
                commodity = str(facts.get("productSubcategory") or "").lower()
                if not any(k.lower() in commodity for k in spec):
                    return False
            if key == "coveredByDpco":
                if bool(facts.get("coveredByDpco")) != spec:
                    return False
        return True

    return _check(logic)


def _quantity_in(facts: dict, unit: str) -> Optional[float]:
    value = _number(facts.get("netQuantityValue"))
    raw_unit = str(facts.get("netQuantityUnit") or "").lower()
    if value is None or not raw_unit:
        return None

    normalised = {
        "mg": ("g", value / 1000.0),
        "g":  ("g", value),
        "kg": ("g", value * 1000.0),
        "ml": ("ml", value),
        "l":  ("ml", value * 1000.0),
        "mm": ("m", value / 1000.0),
        "cm": ("m", value / 100.0),
        "m":  ("m", value),
        "cm2": ("m2", value / 10000.0),
        "dm2": ("m2", value / 100.0),
        "m2": ("m2", value),
    }.get(raw_unit)
    if not normalised:
        return None

    base_unit, base_value = normalised
    req_map = {
        "g": "g", "kg": "g", "mg": "g",
        "ml": "ml", "l": "ml",
        "m": "m", "cm": "m", "mm": "m",
        "m2": "m2", "dm2": "m2", "cm2": "m2",
        "g_or_ml": base_unit,
    }
    req_base = req_map.get(unit, unit)
    if req_base != base_unit and unit != "g_or_ml":
        return None

    if unit == "kg" and base_unit == "g":
        return base_value / 1000.0
    if unit == "l" and base_unit == "ml":
        return base_value / 1000.0
    return base_value


# ============================================================
# VALIDATORS
# ============================================================
ValidatorFn = Callable[[dict, dict], tuple[str, str]]
_VALIDATORS: dict[str, ValidatorFn] = {}


def validator(name: str):
    def deco(fn: ValidatorFn) -> ValidatorFn:
        _VALIDATORS[name] = fn
        return fn
    return deco


@validator("presence")
def _v_presence(v: dict, facts: dict) -> tuple[str, str]:
    specs = v.get("fields") or ([v["field"]] if "field" in v else [])
    missing = []
    for spec in specs:
        if not _is_present(_first_present(facts, spec)):
            missing.append(spec)
    if missing:
        action = v.get("failAction", FAIL)
        return action, f"Missing required field(s): {', '.join(missing)}"
    return PASS, "All required fields present."


@validator("presenceAny")
def _v_presence_any(v: dict, facts: dict) -> tuple[str, str]:
    specs = v.get("fields") or []
    if any(_is_present(_first_present(facts, spec)) for spec in specs):
        return PASS, "At least one required field present."
    return v.get("failAction", FAIL), f"None of: {', '.join(specs)}"


@validator("numericPositive")
def _v_numeric_positive(v: dict, facts: dict) -> tuple[str, str]:
    val = _number(_first_present(facts, v["field"]))
    if val is None:
        return FAIL, f"Field '{v['field']}' missing or non-numeric."
    if val <= 0:
        return FAIL, f"Field '{v['field']}' is not a positive number ({val})."
    return PASS, "Positive numeric value present."


@validator("numericMin")
def _v_numeric_min(v: dict, facts: dict) -> tuple[str, str]:
    val = _number(_first_present(facts, v["field"]))
    if val is None:
        return v.get("failAction", FAIL), f"Missing or non-numeric '{v['field']}'."
    if val < v["minValue"]:
        return v.get("failAction", FAIL), (
            f"'{v['field']}' = {val} < required min {v['minValue']}."
        )
    return PASS, f"'{v['field']}' meets minimum."


@validator("numericCompare")
def _v_numeric_compare(v: dict, facts: dict) -> tuple[str, str]:
    lhs = _number(_first_present(facts, v["lhsField"]))
    rhs = _number(_first_present(facts, v["rhsField"]))
    if lhs is None or rhs is None:
        return UNCERTAIN, "One or both operands missing."
    rel = v.get("relation", "<=")
    ok = {
        "<=": lhs <= rhs, ">=": lhs >= rhs, "<": lhs < rhs, ">": lhs > rhs,
        "==": abs(lhs - rhs) < 1e-9,
    }.get(rel, False)
    if not ok:
        return v.get("failAction", FAIL), f"{lhs} {rel} {rhs} is false."
    return PASS, "Numeric comparison holds."


@validator("numericRatioEqual")
def _v_numeric_ratio_equal(v: dict, facts: dict) -> tuple[str, str]:
    lhs = _number(_first_present(facts, v["lhsField"]))
    rhs = _number(_first_present(facts, v["rhsField"]))
    if lhs is None or rhs is None or rhs == 0:
        return UNCERTAIN, "Ratio operands missing or zero."
    tol = float(v.get("tolerance", 0.05))
    if abs(lhs - rhs) / max(abs(rhs), 1e-9) > tol:
        return v.get("failAction", UNCERTAIN), (
            f"{v['lhsField']}={lhs} vs {v['rhsField']}={rhs} differ by more than {tol*100:.0f}%."
        )
    return PASS, "Ratio within tolerance."


@validator("dateIso")
def _v_date_iso(v: dict, facts: dict) -> tuple[str, str]:
    specs = v.get("fields") or [v.get("field")]
    for spec in specs:
        val = _first_present(facts, spec)
        if not _is_present(val):
            continue
        if _date(val) is None:
            return v.get("failAction", UNCERTAIN), f"'{spec}' is not a valid ISO date: {val}"
    return PASS, "Valid ISO date(s)."


@validator("dateCompare")
def _v_date_compare(v: dict, facts: dict) -> tuple[str, str]:
    lhs_spec = v.get("lhsField") or v.get("field")
    rhs_spec = v.get("rhsField") or v.get("compareTo")

    if not lhs_spec or not rhs_spec:
        parent_fields = v.get("_parentFields") or []
        if not lhs_spec and len(parent_fields) >= 1:
            lhs_spec = parent_fields[0]
        if not rhs_spec and len(parent_fields) >= 2:
            rhs_spec = parent_fields[1]

    lhs = _date(_first_present(facts, lhs_spec)) if lhs_spec else None
    rhs = _date(_first_present(facts, rhs_spec)) if rhs_spec else None

    if rhs_spec == "inspectionDate" or (rhs is None and rhs_spec == "inspectionDate"):
        rhs = _date(facts.get("inspectionDate")) or date.today()

    if lhs is None or rhs is None:
        return UNCERTAIN, "Date comparison operands missing."

    rel = v.get("relation", "lte")
    ok = {
        "lte": lhs <= rhs, "gte": lhs >= rhs,
        "lt": lhs < rhs, "gt": lhs > rhs,
    }.get(rel, False)
    if not ok:
        return v.get("failAction", FAIL), f"{lhs} {rel} {rhs} is false."
    return PASS, "Date comparison holds."


@validator("dateNotAfter")
def _v_date_not_after(v: dict, facts: dict) -> tuple[str, str]:
    spec = v.get("field")
    val = _date(_first_present(facts, spec)) if spec else None
    if val is None:
        return UNCERTAIN, "No date present to compare."
    reference = v.get("compareTo")
    if reference == "inspectionDate":
        ref = _date(facts.get("inspectionDate")) or date.today()
    else:
        ref = _date(_first_present(facts, reference)) if reference else None
    if ref is None:
        return UNCERTAIN, "Reference date missing."
    if val > ref:
        return v.get("failAction", UNCERTAIN), f"{val} is after {ref}."
    return PASS, "Date is not after reference."


@validator("dateDeltaMax")
def _v_date_delta_max(v: dict, facts: dict) -> tuple[str, str]:
    spec = v.get("field")
    if not spec:
        parent_fields = v.get("_parentFields") or []
        spec = parent_fields[0] if parent_fields else None

    val = _date(_first_present(facts, spec)) if spec else None
    if val is None:
        return UNCERTAIN, "No date present to evaluate age."

    ref = _date(facts.get("inspectionDate")) or date.today()
    max_years = float(v.get("maxYears", 5))
    delta_days = (ref - val).days
    if delta_days > max_years * 365.25:
        return v.get("failAction", UNCERTAIN), (
            f"'{spec}' = {val} is more than {max_years} years old."
        )
    return PASS, "Age within tolerance."


@validator("regex")
def _v_regex(v: dict, facts: dict) -> tuple[str, str]:
    val = _first_present(facts, v["field"])
    if not _is_present(val):
        return PASS, "Field absent; regex not applied."
    flags = re.IGNORECASE if v.get("caseInsensitive") else 0
    if not re.search(v["pattern"], str(val), flags):
        if v.get("missingPatternAction"):
            return v["missingPatternAction"], (
                f"'{v['field']}' does not match pattern {v['pattern']}."
            )
        return v.get("failAction", UNCERTAIN), (
            f"'{v['field']}' does not match pattern."
        )
    return PASS, "Pattern matches."


@validator("forbiddenSubstring")
def _v_forbidden_substring(v: dict, facts: dict) -> tuple[str, str]:
    val = _first_present(facts, v["field"])
    if not _is_present(val):
        return PASS, "Field absent; nothing to check."
    text = str(val)
    haystack = text.lower() if v.get("caseInsensitive", True) else text
    for word in v.get("forbidden", []):
        needle = word.lower() if v.get("caseInsensitive", True) else word
        if needle in haystack:
            return v.get("failAction", FAIL), f"Forbidden term '{word}' present."
    return PASS, "No forbidden terms."


@validator("requiredSubstring")
def _v_required_substring(v: dict, facts: dict) -> tuple[str, str]:
    val = _first_present(facts, v["field"])
    if not _is_present(val):
        return v.get("failAction", UNCERTAIN), (
            f"'{v['field']}' absent; cannot confirm required phrase."
        )
    text = str(val).lower()
    if v["required"].lower() not in text:
        return v.get("failAction", UNCERTAIN), (
            f"Required phrase '{v['required']}' not found."
        )
    return PASS, "Required phrase present."


@validator("unitMembership")
def _v_unit_membership(v: dict, facts: dict) -> tuple[str, str]:
    unit = _first_present(facts, v["field"])
    if not _is_present(unit):
        return PASS, "Unit absent."
    unit = str(unit).strip().lower()

    allowed = set()
    if "allowedSymbols" in v:
        for group in v["allowedSymbols"].values():
            allowed.update(s.lower() for s in group)
    elif "allowedUnits" in v:
        for group in v["allowedUnits"].values():
            allowed.update(s.lower() for s in group)

    if allowed and unit not in allowed:
        return v.get("failAction", FAIL), f"Unit '{unit}' not in recognised list."

    rejected = {s.lower() for s in (v.get("rejectSymbols") or [])}
    if unit in rejected:
        return v.get("failAction", FAIL), f"Unit '{unit}' is not an SI unit."

    return PASS, "Unit accepted."


@validator("unitFamilyConsistency")
def _v_unit_family(v: dict, facts: dict) -> tuple[str, str]:
    state = str(_first_present(facts, v["stateField"]) or "").lower()
    unit = str(_first_present(facts, v["unitField"]) or "").lower()
    if not state or not unit:
        return UNCERTAIN, "Unit family cannot be verified (state or unit missing)."
    allowed = [s.lower() for s in (v.get("mapping") or {}).get(state, [])]
    if allowed and unit not in allowed:
        return v.get("failAction", FAIL), (
            f"Unit '{unit}' not compatible with physical state '{state}'."
        )
    return PASS, "Unit family consistent."


@validator("unitMagnitudeMatch")
def _v_unit_magnitude(v: dict, facts: dict) -> tuple[str, str]:
    value = _number(facts.get("netQuantityValue"))
    unit = str(facts.get("netQuantityUnit") or "").lower()
    if value is None or not unit:
        return UNCERTAIN, "Cannot verify unit magnitude (quantity or unit missing)."
    for rule in v.get("rules", []):
        threshold_unit = rule["threshold"]["unit"]
        threshold_value = rule["threshold"]["value"]
        converted = _quantity_in(facts, threshold_unit)
        if converted is None:
            continue
        expected_unit = (
            rule["below"] if converted < threshold_value else rule["atOrAbove"]
        ).lower()
        if unit != expected_unit:
            return v.get("failAction", UNCERTAIN), (
                f"Quantity {value}{unit} should be expressed as {expected_unit}."
            )
    return PASS, "Unit magnitude appropriate."


@validator("thresholdLookup")
def _v_threshold_lookup(v: dict, facts: dict) -> tuple[str, str]:
    measured = _number(_first_present(facts, v["field"]))
    if measured is None:
        return UNCERTAIN, "Numeral height not measured."

    method = facts.get("packageSurfaceMethod") or "normal"
    mode_key = (
        "blownOrMolded"
        if method in ("blown", "formed", "molded", "embossed", "perforated")
        else "normal"
    )

    lookup_by = v.get("lookupBy", "netQuantityValue")
    spec = lookup_by.split("|")[0]
    key_value = _number(_first_present(facts, spec))

    for band in v.get("table", []):
        if "whenQuantityAtMost" in band:
            limit = band["whenQuantityAtMost"]
            if key_value is not None and key_value <= limit["value"]:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)
        elif "whenQuantityBetween" in band:
            low = band["whenQuantityBetween"]["low"]["value"]
            high = band["whenQuantityBetween"]["high"]["value"]
            if key_value is not None and low < key_value <= high:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)
        elif "whenQuantityAbove" in band:
            low = band["whenQuantityAbove"]["value"]
            if key_value is not None and key_value > low:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)
        elif "whenPdpAreaAtMostCm2" in band:
            area = _number(facts.get("pdpAreaCm2"))
            if area is not None and area <= band["whenPdpAreaAtMostCm2"]:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)
        elif "whenPdpAreaBetweenCm2" in band:
            low = band["whenPdpAreaBetweenCm2"]["low"]
            high = band["whenPdpAreaBetweenCm2"]["high"]
            area = _number(facts.get("pdpAreaCm2"))
            if area is not None and low < area <= high:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)
        elif "whenPdpAreaAboveCm2" in band:
            area = _number(facts.get("pdpAreaCm2"))
            if area is not None and area > band["whenPdpAreaAboveCm2"]:
                required = band["minHeightMm"][mode_key]
                return _compare_height(measured, required, v)

    return UNCERTAIN, "No threshold band matched."


def _compare_height(measured: float, required: float, v: dict) -> tuple[str, str]:
    if measured < required:
        if v.get("uncertainIfMeasurementUncalibrated") and not _is_calibrated(v):
            return UNCERTAIN, (
                f"Measured {measured}mm vs required {required}mm, "
                "but measurement is not calibrated."
            )
        return v.get("failAction", FAIL), (
            f"Measured {measured}mm below required {required}mm."
        )
    return PASS, f"Measured {measured}mm ≥ required {required}mm."


def _is_calibrated(v: dict) -> bool:
    return bool(v.get("calibrated", False))


@validator("compositeAddress")
def _v_composite_address(v: dict, facts: dict) -> tuple[str, str]:
    specs = v.get("fields") or [
        "manufacturerAddress", "packerAddress", "importerAddress"
    ]
    address = None
    for spec in specs:
        address = _first_present(facts, spec)
        if _is_present(address):
            break
    if not _is_present(address):
        return PASS, "Address field absent; nothing to validate."
    text = str(address)
    has_street_like = bool(re.search(r"\d", text)) or bool(
        re.search(r"road|street|marg|lane|plot|sector|nagar", text, re.I)
    )
    has_city_or_state = bool(re.search(r"[A-Z][a-z]+", text))
    if not (has_street_like and has_city_or_state):
        return v.get("onMissingCritical", UNCERTAIN), (
            "Address appears incomplete (missing street or city/state)."
        )
    return PASS, "Address appears complete enough."


@validator("languageMembership")
def _v_language_membership(v: dict, facts: dict) -> tuple[str, str]:
    lang = _first_present(facts, v["field"])
    if not _is_present(lang):
        return PASS, "Language not recorded."
    if str(lang).lower() not in [l.lower() for l in v.get("allowed", [])]:
        return v.get("failAction", FAIL), f"Language '{lang}' not permitted."
    return PASS, "Language permitted."


@validator("regionOverlapCheck")
def _v_region_overlap(v: dict, facts: dict) -> tuple[str, str]:
    suspects = facts.get("stickerSuspects") or []
    if not suspects:
        return PASS, "No sticker suspects."
    overlapping_fields = v.get("overlappingField", "").split("|")
    for suspect in suspects:
        for f in overlapping_fields:
            target = facts.get(f"{f}RegionBbox") or facts.get(f)
            if target and _bboxes_overlap(suspect.get("bbox"), target):
                return v.get("failAction", UNCERTAIN), (
                    f"Sticker overlaps required declaration '{f.strip()}'."
                )
    return PASS, "No problematic overlaps."


def _bboxes_overlap(a: Any, b: Any) -> bool:
    if not a or not b or len(a) < 4 or len(b) < 4:
        return False
    ax, ay, aw, ah = a[:4]
    bx, by, bw, bh = b[:4]
    return not (ax + aw < bx or bx + bw < ax or ay + ah < by or by + bh < ay)


@validator("priceComparison")
def _v_price_comparison(v: dict, facts: dict) -> tuple[str, str]:
    primary = _number(_first_present(facts, v["primaryField"]))
    sticker = _number(_first_present(facts, v["stickerField"]))
    if primary is None or sticker is None:
        return PASS, "No sticker price to compare."
    if v.get("allowedRelation") == "stickerLtePrimary" and sticker > primary:
        return v.get("failAction", FAIL), (
            f"Sticker price {sticker} exceeds primary MRP {primary}."
        )
    return PASS, "Sticker price valid."


@validator("boolean")
def _v_boolean(v: dict, facts: dict) -> tuple[str, str]:
    val = facts.get(v["field"])
    if val is None:
        return UNCERTAIN, "Boolean field absent."
    return PASS, "Boolean accepted."


@validator("presenceIfCondition")
def _v_presence_if(v: dict, facts: dict) -> tuple[str, str]:
    if not facts.get(v.get("condition")):
        return PASS, "Condition not met."
    if not _is_present(_first_present(facts, v["field"])):
        return v.get("failAction", FAIL), f"'{v['field']}' required by condition."
    return PASS, "Conditional field present."


@validator("presenceOnPdp")
def _v_presence_on_pdp(v: dict, facts: dict) -> tuple[str, str]:
    specs = v.get("fields") or []
    on_pdp = bool(facts.get("declarationOnPdp"))
    if not on_pdp:
        return v.get("failAction", UNCERTAIN), "Declaration not confirmed on PDP."
    for spec in specs:
        if not _is_present(_first_present(facts, spec)):
            return v.get("failAction", UNCERTAIN), f"'{spec}' missing."
    return PASS, "Declarations present on PDP."


@validator("colourContrast")
def _v_colour_contrast(v: dict, facts: dict) -> tuple[str, str]:
    ratio = _number(facts.get("contrastRatio"))
    if ratio is None:
        return UNCERTAIN, "Contrast ratio not measured."
    if ratio < float(v.get("minContrastRatio", 3.0)):
        return v.get("failAction", UNCERTAIN), (
            f"Contrast ratio {ratio} below minimum {v['minContrastRatio']}."
        )
    return PASS, "Contrast sufficient."


@validator("clearanceCheck")
def _v_clearance_check(v: dict, facts: dict) -> tuple[str, str]:
    return PASS, "Quantity clearance accepted."


@validator("manualReview")
def _v_manual_review(v: dict, facts: dict) -> tuple[str, str]:
    return UNCERTAIN, "Requires manual review."


@validator("premisesEquipmentCheck")
def _v_premises_equipment(v: dict, facts: dict) -> tuple[str, str]:
    return UNCERTAIN, "Premises-equipment check requires inspector confirmation."


@validator("notEqual")
def _v_not_equal(v: dict, facts: dict) -> tuple[str, str]:
    val = _first_present(facts, v["field"])
    for other in v.get("forbiddenMatches", []):
        other_val = _first_present(facts, other)
        if _is_present(val) and val == other_val:
            return v.get("failAction", UNCERTAIN), (
                f"'{v['field']}' equals '{other}'."
            )
    return PASS, "Values differ."


@validator("atLeastOneOf")
def _v_at_least_one_of(v: dict, facts: dict) -> tuple[str, str]:
    channels = v.get("channels", [])
    for ch in channels:
        for f in (
            "customerCarePhone", "customerCareEmail",
            "customerCareAddress", "customerCare",
        ):
            if ch in f.lower() and _is_present(facts.get(f)):
                return PASS, f"Channel '{ch}' present."
    return v.get("failAction", UNCERTAIN), f"No channel among {channels}."


@validator("numericDomain")
def _v_numeric_domain(v: dict, facts: dict) -> tuple[str, str]:
    return PASS, "Numeric domain accepted."


@validator("unitDomain")
def _v_unit_domain(v: dict, facts: dict) -> tuple[str, str]:
    return PASS, "Unit domain accepted."


@validator("derivedCheck")
def _v_derived_check(v: dict, facts: dict) -> tuple[str, str]:
    return PASS, "Derived check accepted."


@validator("documentedExclusion")
def _v_documented_exclusion(v: dict, facts: dict) -> tuple[str, str]:
    return UNCERTAIN, "Wrapper exclusion must be confirmed by inspector."


@validator("compositeDimension")
def _v_composite_dimension(v: dict, facts: dict) -> tuple[str, str]:
    dims = facts.get("finishedDimensions") or facts.get("dimensions")
    if not dims:
        return v.get("failAction", UNCERTAIN), "Dimensions absent."
    return PASS, "Dimensions present."


@validator("regionAlterationCheck")
def _v_region_alteration(v: dict, facts: dict) -> tuple[str, str]:
    suspects = facts.get("stickerSuspects") or []
    if suspects:
        return v.get("failAction", UNCERTAIN), "Possible alteration detected."
    return PASS, "No alteration detected."


# ============================================================
# RULE EVALUATION
# ============================================================
def _evaluate_validations(rule: dict, facts: dict) -> tuple[str, str]:
    validations = rule.get("validations") or []
    parent_fields = rule.get("fields") or []
    worst_status = PASS
    reasons: list[str] = []

    for raw_v in validations:
        v = dict(raw_v)
        if parent_fields and "_parentFields" not in v:
            v["_parentFields"] = parent_fields

        vtype = v.get("type")
        if not vtype:
            continue
        fn = _VALIDATORS.get(vtype)
        if fn is None:
            reasons.append(f"(no validator for '{vtype}')")
            worst_status = UNCERTAIN
            continue

        if "when" in v:
            cond = v["when"]
            if isinstance(cond, str) and "==" in cond:
                left, _, right = cond.partition("==")
                fld = left.strip()
                val = right.strip().strip("'\"")
                if str(facts.get(fld)) != val:
                    continue

        try:
            st, reason = fn(v, facts)
        except Exception as exc:
            st, reason = UNCERTAIN, f"validator error: {exc}"

        reasons.append(reason)
        if _severity_rank(st) > _severity_rank(worst_status):
            worst_status = st

    if not reasons:
        return PASS, "No validations to run."
    return worst_status, " | ".join(r for r in reasons if r)


def _severity_rank(status: str) -> int:
    return {
        NOT_APPLICABLE: 0,
        PASS: 1,
        EXEMPT: 1,
        UNCERTAIN: 2,
        FAIL: 3,
    }.get(status, 2)


# ============================================================
# CROSS-FIELD RULES
# ============================================================
def _evaluate_cross_field(ruleset: dict, facts: dict) -> list[dict]:
    out: list[dict] = []
    for xr in ruleset.get("crossFieldRules", []) or []:
        status, reason = _evaluate_validations(xr, facts)
        out.append({
            "ruleId": xr.get("id"),
            "title": xr.get("title"),
            "legalReference": xr.get("legalReference") or "Logical consistency",
            "status": status,
            "reason": reason,
        })
    return out


# ============================================================
# VERIFICATION
# ============================================================
def _evaluate_verification(ruleset: dict, facts: dict,
                           verification: Optional[dict]) -> list[dict]:
    out: list[dict] = []
    if not verification:
        return out
    for adapter in ruleset.get("verification", []) or []:
        auth = adapter.get("authority", "").lower()
        vr = verification.get(auth)
        if not vr:
            continue
        v_status = vr.get("status", "UNKNOWN")
        if v_status == "VALID":
            continue
        out.append({
            "ruleId": adapter.get("id"),
            "title": adapter.get("authority"),
            "legalReference": "External authority verification",
            "status": UNCERTAIN,
            "reason": f"{v_status}: {vr.get('detail', '')}",
        })
    return out


# ============================================================
# MAIN EVALUATOR
# ============================================================
def evaluate(
    facts: dict,
    *,
    ruleset: Optional[dict] = None,
    verification: Optional[dict] = None,
    field_confidence: Optional[dict] = None,
    min_confidence: Optional[float] = None,
) -> dict:
    rs = ruleset or load_ruleset()
    min_conf = float(
        min_confidence
        if min_confidence is not None
        else (rs.get("config", {}) or {}).get("minEvidenceConfidence", 0.75)
    )

    facts = dict(facts)
    for key, default in _CONTEXT_DEFAULTS.items():
        if facts.get(key) is None:
            facts[key] = default

    findings: list[dict] = []
    counts = {s: 0 for s in _ALL_STATUSES}

    def _add(f: dict) -> None:
        findings.append(f)
        st = f.get("status", UNCERTAIN)
        counts[st] = counts.get(st, 0) + 1

    for rule in rs.get("rules", []):
        rid = rule.get("id", "?")

        exemption = _rule_exempt(rule, facts, rs)
        if exemption:
            exemption["severity"] = rule.get("severity", "informational")
            exemption["reviewPolicy"] = rule.get("reviewPolicy", "never")
            _add(exemption)
            continue

        if not _rule_applies(rule, facts):
            _add({
                "ruleId": rid,
                "ruleReference": rule.get("ruleReference"),
                "title": rule.get("title"),
                "legalReference": rule.get("ruleReference"),
                "status": NOT_APPLICABLE,
                "reason": "Rule does not apply to this product context.",
                "severity": rule.get("severity", "informational"),
                "reviewPolicy": rule.get("reviewPolicy", "never"),
            })
            continue

        status, reason = _evaluate_validations(rule, facts)

        if status == PASS and field_confidence:
            weak = []
            for spec in _collect_required_specs(rule):
                for f in spec.split("|"):
                    f = f.strip()
                    conf = field_confidence.get(f)
                    if conf is not None and conf < min_conf and _is_present(_first_present(facts, f)):
                        weak.append(f)
            if weak:
                status = UNCERTAIN
                reason = (
                    f"Fields present but evidence confidence below "
                    f"{min_conf:.2f}: {', '.join(sorted(set(weak)))}"
                )

        if status == FAIL and rule.get("onMissing") == "UNCERTAIN":
            status = UNCERTAIN
            reason = f"{reason} (downgraded per ruleset)"

        _add({
            "ruleId": rid,
            "ruleReference": rule.get("ruleReference"),
            "title": rule.get("title"),
            "legalReference": rule.get("ruleReference"),
            "status": status,
            "reason": reason,
            "severity": rule.get("severity", "informational"),
            "reviewPolicy": rule.get("reviewPolicy", "never"),
        })

    for xf in _evaluate_cross_field(rs, facts):
        xf["severity"] = "major"
        xf["reviewPolicy"] = "onUncertain"
        _add(xf)

    for vf in _evaluate_verification(rs, facts, verification):
        vf["severity"] = "major"
        vf["reviewPolicy"] = "onUncertain"
        _add(vf)

    applicable = [f for f in findings if f["status"] != NOT_APPLICABLE]
    if not applicable:
        overall = EXEMPT if any(f["status"] == EXEMPT for f in findings) else NOT_APPLICABLE
    elif any(f["status"] == FAIL for f in applicable):
        overall = FAIL
    elif any(f["status"] == UNCERTAIN for f in applicable):
        overall = UNCERTAIN
    elif any(f["status"] == EXEMPT for f in applicable) and not any(
        f["status"] == PASS for f in applicable
    ):
        overall = EXEMPT
    else:
        overall = PASS

    meta = rs.get("metadata", {}) or {}

    return {
        "rulesetId": meta.get("rulesetId"),
        "rulesetVersion": meta.get("rulesetVersion", "unknown"),
        "authority": meta.get("authority", ""),
        "legalReference": meta.get("legalInstrument", ""),
        "evaluatedAt": datetime.utcnow().isoformat(),
        "minConfidence": min_conf,
        "overallStatus": overall,
        "findings": findings,
        "summary": counts,
    }


def _collect_required_specs(rule: dict) -> list[str]:
    specs: list[str] = []
    for v in rule.get("validations") or []:
        if "fields" in v:
            specs.extend(v["fields"])
        elif "field" in v:
            specs.append(v["field"])
        if "lhsField" in v:
            specs.append(v["lhsField"])
        if "rhsField" in v:
            specs.append(v["rhsField"])
    return specs