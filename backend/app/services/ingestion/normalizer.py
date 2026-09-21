from typing import Optional, Dict, Any, List


def create_normalized_row(
    entity_type: str,
    value: str,
    timestamp: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    row_index: Optional[int] = None,
) -> Dict[str, Any]:
    """Create a normalized entity dictionary adhering to the common in-memory schema:
    - entity_type: str ("phone", "account", "upi_handle", "imei", "imsi", "ip_address", "email", "url")
    - value: str
    - timestamp: Optional[str]
    - extra: dict of raw fields kept for traceability
    - row_index: position of the source record within its evidence file. Two entities
      that share a row_index actually co-occurred on the same record (e.g. the same
      CDR call or the same bank transaction) — this is what correlation uses to link
      entities meaningfully instead of pairing everything in the whole file together.
    """
    clean_value = str(value).strip() if value is not None else ""
    return {
        "entity_type": str(entity_type).strip().lower(),
        "value": clean_value,
        "timestamp": str(timestamp) if timestamp is not None else None,
        "extra": extra or {},
        "row_index": row_index,
    }
