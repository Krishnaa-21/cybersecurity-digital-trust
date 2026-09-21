import json
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
from app.services.ingestion.normalizer import create_normalized_row

HIGH_RISK_KEYWORDS = ["SMS", "ACCESSIBILITY", "CALL_LOG"]
IP_REGEX = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")


def parse_apk_dump(file_path: Path) -> Tuple[List[Dict[str, Any]], int]:
    """Parse JSON Android APK dump.
    Expects fields: package_name, permissions (list), c2_server (str), imei (str), contacted_ips (list).
    Emits normalized rows for IMEI, C2 server IP, and contacted IPs, flagging high-risk permissions in extra.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data if isinstance(data, list) else [data]
    normalized_rows: List[Dict[str, Any]] = []

    for item in records:
        package_name = item.get("package_name", "unknown")
        permissions = item.get("permissions", [])
        c2_server = item.get("c2_server")
        imei = item.get("imei")
        contacted_ips = item.get("contacted_ips", [])

        flagged_permissions = [
            perm for perm in permissions
            if any(keyword in perm.upper() for keyword in HIGH_RISK_KEYWORDS)
        ]

        raw_extra = {
            "package_name": package_name,
            "permissions": permissions,
            "high_risk_permissions": flagged_permissions,
        }

        # Emit IMEI
        if imei:
            clean_imei = str(imei).strip()
            if clean_imei:
                normalized_rows.append(create_normalized_row("imei", clean_imei, None, raw_extra))

        # Emit C2 Server
        if c2_server:
            clean_c2 = str(c2_server).strip()
            c2_extra = {**raw_extra, "role": "c2_server"}
            if IP_REGEX.match(clean_c2):
                normalized_rows.append(create_normalized_row("ip_address", clean_c2, None, c2_extra))
            else:
                # If c2 server is a URL or domain, emit as url
                normalized_rows.append(create_normalized_row("url", clean_c2, None, c2_extra))

        # Emit Contacted IPs
        for ip in contacted_ips:
            clean_ip = str(ip).strip()
            if clean_ip:
                normalized_rows.append(create_normalized_row(
                    "ip_address",
                    clean_ip,
                    None,
                    {**raw_extra, "role": "contacted_ip"},
                ))

    row_count = max(len(records), len(normalized_rows))
    return normalized_rows, row_count
