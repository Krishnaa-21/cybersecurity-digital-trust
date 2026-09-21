import re
import csv
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import Case, Entity

LOOKUPS_DIR = Path(__file__).resolve().parent / "lookups"
PIN_REGEX = re.compile(r"\b([1-9][0-9]{2})[0-9]{3}\b")


def load_ifsc_lookup() -> List[Tuple[str, str]]:
    """Load IFSC prefix to district mappings from bundled CSV."""
    file_path = LOOKUPS_DIR / "ifsc_district.csv"
    mappings = []
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or row[0].startswith("#") or row[0].lower() == "ifsc_prefix":
                    continue
                if len(row) >= 3:
                    mappings.append((row[0].strip().upper(), row[2].strip()))
    # Sort by prefix length descending for longest prefix match
    mappings.sort(key=lambda x: len(x[0]), reverse=True)
    return mappings


def load_pin_lookup() -> Dict[str, str]:
    """Load 3-digit PIN code prefix to district mappings from bundled CSV."""
    file_path = LOOKUPS_DIR / "pin_district.csv"
    mappings = {}
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or row[0].startswith("#") or row[0].lower() == "pin_code_prefix":
                    continue
                if len(row) >= 2:
                    mappings[row[0].strip()] = row[1].strip()
    return mappings


def resolve_district(case_id: int, db: Session) -> Optional[str]:
    """Resolve district for a case using offline IFSC and PIN code lookup data.
    Updates and stores on Case.district.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None

    ifsc_lookups = load_ifsc_lookup()
    pin_lookups = load_pin_lookup()

    resolved_district: Optional[str] = None

    # 1. Check account entities for IFSC code
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    for ent in entities:
        extra = ent.extra or {}
        ifsc_code = extra.get("ifsc_code") or extra.get("ifsc")
        if ifsc_code:
            clean_ifsc = str(ifsc_code).strip().upper()
            for prefix, district in ifsc_lookups:
                if clean_ifsc.startswith(prefix):
                    resolved_district = district
                    break
        if resolved_district:
            break

    # 2. Check for victim PIN code in district field (if numeric) or entity extras
    if not resolved_district:
        # Check if existing case.district is actually a PIN code
        if case.district:
            pin_match = PIN_REGEX.search(str(case.district))
            if pin_match:
                prefix = pin_match.group(1)
                resolved_district = pin_lookups.get(prefix)

        # Check entity values or extras for PIN code
        if not resolved_district:
            for ent in entities:
                extra = ent.extra or {}
                for key, val in extra.items():
                    if val and "pin" in str(key).lower():
                        pin_match = PIN_REGEX.search(str(val))
                        if pin_match:
                            prefix = pin_match.group(1)
                            resolved_district = pin_lookups.get(prefix)
                            break
                if resolved_district:
                    break

    # If resolved, persist to Case.district
    if resolved_district:
        case.district = resolved_district
        db.commit()
        db.refresh(case)
        return resolved_district

    return case.district


def get_district_heatmap(db: Session) -> List[Dict[str, Any]]:
    """Group all cases by resolved district and bucket density into low, medium, or high."""
    results = (
        db.query(Case.district, func.count(Case.id).label("case_count"))
        .filter(Case.district.isnot(None), Case.district != "")
        .group_by(Case.district)
        .order_by(func.count(Case.id).desc())
        .all()
    )

    heatmap_data = []
    for district, count in results:
        # Thresholds tuned for realistic distribution spread:
        # 1-2: low, 3-5: medium, >5: high
        if count >= 5:
            level = "high"
        elif count >= 3:
            level = "medium"
        else:
            level = "low"

        heatmap_data.append({
            "district": district,
            "case_count": count,
            "level": level,
        })

    return heatmap_data
