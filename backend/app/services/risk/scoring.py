import json
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy.orm import Session

from app.db.models import Case, Entity, EntityLink, RiskLevel

PROFILES_DIR = Path(__file__).resolve().parent / "profiles"

DEFAULT_WEIGHTS: Dict[str, float] = {
    "multi_hop_speed": 0.35,
    "shared_upi_handle": 0.3,
    "shared_account": 0.2,
    "shared_ip": 0.15,
}


def load_profile(scam_type_str: str) -> Dict[str, float]:
    """Load the weight-profile JSON for a specific scam type, or fallback to default."""
    clean_type = (scam_type_str or "").strip().lower()
    profile_path = PROFILES_DIR / f"{clean_type}.json"
    if profile_path.exists():
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_WEIGHTS


def extract_signal_score(
    signal: str,
    entities: List[Entity],
    links: List[EntityLink],
) -> Tuple[float, str]:
    """Calculate a 0-100 score and a human-readable description for a given signal."""
    sig = signal.lower()

    if sig == "shared_upi_handle":
        upi_links = [l for l in links if l.basis == "shared_upi_handle"]
        if upi_links:
            max_conf = max(l.confidence for l in upi_links)
            score = min(100.0, max_conf * 80 + len(upi_links) * 10)
            desc = f"Shared fraudulent UPI handle linked across {len(upi_links)} transaction paths"
            return score, desc
        return 0.0, ""

    elif sig == "shared_account":
        acc_links = [l for l in links if l.basis == "shared_account"]
        if acc_links:
            max_conf = max(l.confidence for l in acc_links)
            score = min(100.0, max_conf * 80 + len(acc_links) * 10)
            desc = f"Shared beneficiary bank account linked across {len(acc_links)} transfers"
            return score, desc
        return 0.0, ""

    elif sig == "shared_imei":
        imei_links = [l for l in links if l.basis == "shared_imei"]
        if imei_links:
            max_conf = max(l.confidence for l in imei_links)
            score = min(100.0, max_conf * 90 + len(imei_links) * 10)
            desc = f"Suspect device IMEI reused across {len(imei_links)} SIM/device links"
            return score, desc
        return 0.0, ""

    elif sig == "shared_ip":
        ip_links = [l for l in links if l.basis in ["shared_ip_address", "shared_ip_subnet"]]
        if ip_links:
            max_conf = max(l.confidence for l in ip_links)
            score = min(100.0, max_conf * 85 + len(ip_links) * 8)
            desc = f"Shared network infrastructure: {len(ip_links)} common IP/subnet endpoints"
            return score, desc
        return 0.0, ""

    elif sig == "multi_hop_speed":
        # Multi-hop routing detected when multiple accounts/UPI handles are linked in the graph
        mule_entities = [
            e for e in entities
            if (e.entity_type.value if hasattr(e.entity_type, "value") else str(e.entity_type))
            in ["account", "upi_handle"]
        ]
        payment_links = [l for l in links if l.basis in ["shared_upi_handle", "shared_account"]]
        if len(mule_entities) >= 2 and payment_links:
            count = len(mule_entities)
            score = min(100.0, 65.0 + count * 8)
            desc = f"Multi-hop routing: {count} mule accounts/UPI handles in rapid succession"
            return score, desc
        elif payment_links:
            return 60.0, "Rapid fund movement across settlement nodes"
        return 0.0, ""

    elif sig == "high_risk_permissions":
        flagged = [
            e for e in entities
            if e.anomaly_reason and "permission" in e.anomaly_reason.lower()
        ]
        if flagged:
            return 95.0, "Malicious APK: invasive SMS/Accessibility/Call Log permissions"
        return 0.0, ""

    elif sig == "known_c2_server":
        c2_entities = [
            e for e in entities
            if e.anomaly_reason and "c2" in e.anomaly_reason.lower()
        ]
        if c2_entities:
            return 95.0, f"Active Command & Control (C2) endpoint: {c2_entities[0].value}"
        return 0.0, ""

    elif sig == "spoofed_caller_pattern":
        phone_links = [l for l in links if l.basis == "shared_phone"]
        if phone_links:
            score = min(100.0, 60.0 + len(phone_links) * 15)
            return score, f"Coordinated VoIP/spoofed calling pattern ({len(phone_links)} line overlaps)"
        return 0.0, ""

    elif sig == "high_call_velocity":
        phone_count = len([
            e for e in entities
            if (e.entity_type.value if hasattr(e.entity_type, "value") else str(e.entity_type)) == "phone"
        ])
        if phone_count >= 5:
            score = min(100.0, 50.0 + phone_count * 5)
            return score, f"High call velocity: {phone_count} target phone numbers identified"
        elif phone_count > 0:
            return float(phone_count * 10), f"Call velocity: {phone_count} phone entities recorded"
        return 0.0, ""

    return 0.0, ""


def score_case(case_id: int, db: Session, profile: Optional[Dict[str, float]] = None) -> Tuple[float, RiskLevel, Optional[str]]:
    """Compute risk score (0-100), risk level (low/medium/high), and why_flagged rationale
    for a case using a configuration-driven weight profile.
    Updates Case and Entity rows directly.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return 0.0, RiskLevel.low, None

    scam_type_str = case.scam_type.value if hasattr(case.scam_type, "value") else str(case.scam_type)
    if profile is None:
        profile = load_profile(scam_type_str)

    entities: List[Entity] = db.query(Entity).filter(Entity.case_id == case_id).all()
    links: List[EntityLink] = db.query(EntityLink).filter(EntityLink.case_id == case_id).all()

    # If cross-case correlation links exist, boost base severity
    cross_case_links = [l for l in links if l.extra and l.extra.get("cross_case")]

    weighted_sum = 0.0
    total_weight = sum(profile.values()) or 1.0

    best_signal_contribution = -1.0
    best_why_flagged: Optional[str] = None

    for signal, weight in profile.items():
        sig_score, sig_desc = extract_signal_score(signal, entities, links)
        contribution = weight * sig_score
        weighted_sum += contribution

        if contribution > best_signal_contribution and sig_desc:
            best_signal_contribution = contribution
            best_why_flagged = sig_desc

    normalized_score = round(weighted_sum / total_weight, 1)

    # Cross-case escalation bonus if suspect elements match other ongoing investigations
    if cross_case_links:
        normalized_score = min(100.0, round(normalized_score + 15.0, 1))
        matched_case = cross_case_links[0].extra.get("matched_case_number", "another case")
        if best_why_flagged:
            best_why_flagged += f" (reused in {matched_case})"
        else:
            best_why_flagged = f"Suspect entities cross-matched in investigation {matched_case}"

    # Map score to risk_level: 0-39 low, 40-69 medium, 70-100 high
    if normalized_score >= 70.0:
        level = RiskLevel.high
    elif normalized_score >= 40.0:
        level = RiskLevel.medium
    else:
        level = RiskLevel.low

    # Update individual Entity.risk_level values based on link participation
    # Map entity id -> max link confidence
    entity_max_conf: Dict[int, float] = {}
    for l in links:
        entity_max_conf[l.entity_a_id] = max(entity_max_conf.get(l.entity_a_id, 0.0), l.confidence)
        entity_max_conf[l.entity_b_id] = max(entity_max_conf.get(l.entity_b_id, 0.0), l.confidence)

    for ent in entities:
        max_c = entity_max_conf.get(ent.id, 0.0)
        has_anomaly = bool(ent.anomaly_reason)
        if max_c >= 0.7 or has_anomaly:
            ent.risk_level = RiskLevel.high
        elif max_c >= 0.4:
            ent.risk_level = RiskLevel.medium
        else:
            ent.risk_level = RiskLevel.low

    # Store back to Case
    case.risk_score = normalized_score
    case.risk_level = level
    case.why_flagged = best_why_flagged

    db.commit()
    db.refresh(case)

    return normalized_score, level, best_why_flagged
