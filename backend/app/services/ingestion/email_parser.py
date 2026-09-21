import re
import email
from email import policy
from pathlib import Path
from typing import List, Dict, Any, Tuple
from app.services.ingestion.normalizer import create_normalized_row

IP_REGEX = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
URL_REGEX = re.compile(r"https?://[a-zA-Z0-9\-\._~:/\?#\[\]@!$&'\(\)\*\+,;=%]+")
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")


def parse_email(file_path: Path) -> Tuple[List[Dict[str, Any]], int]:
    """Parse .eml file using Python's built-in email module.
    Extract sender, sender IPs from Received headers, and URLs from the body.
    """
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=policy.default)

    normalized_rows: List[Dict[str, Any]] = []
    
    sender = str(msg.get("From", ""))
    recipient = str(msg.get("To", ""))
    subject = str(msg.get("Subject", ""))
    date = str(msg.get("Date", ""))

    raw_extra = {
        "from": sender,
        "to": recipient,
        "subject": subject,
        "date": date,
    }

    # Extract sender email address
    from_emails = EMAIL_REGEX.findall(sender)
    for em in from_emails:
        normalized_rows.append(create_normalized_row("email", em, date, raw_extra))

    to_emails = EMAIL_REGEX.findall(recipient)
    for em in to_emails:
        normalized_rows.append(create_normalized_row("email", em, date, raw_extra))

    # Extract sender IP from Received headers
    received_headers = msg.get_all("Received", [])
    for rec in received_headers:
        rec_str = str(rec)
        ips = IP_REGEX.findall(rec_str)
        for ip in ips:
            # Skip loopback or generic invalid octets
            parts = ip.split(".")
            if all(0 <= int(p) <= 255 for p in parts):
                normalized_rows.append(create_normalized_row(
                    "ip_address",
                    ip,
                    date,
                    {**raw_extra, "header_context": rec_str[:120]},
                ))

    # Extract body content and URLs
    body_text = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type in ["text/plain", "text/html"]:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_text += payload.decode(charset, errors="replace") + "\n"
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body_text = payload.decode(charset, errors="replace")
            else:
                body_text = str(msg.get_payload())
        except Exception:
            body_text = str(msg.get_payload())

    urls = URL_REGEX.findall(body_text)
    for url in urls:
        clean_url = url.rstrip(".,;)>'\"")
        if clean_url:
            normalized_rows.append(create_normalized_row(
                "url",
                clean_url,
                date,
                {**raw_extra, "url_source": "email_body"},
            ))

    row_count = max(1, len(normalized_rows))
    return normalized_rows, row_count
