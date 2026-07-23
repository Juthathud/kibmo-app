"""
Thai national ID card OCR via Google Cloud Vision's REST API (plain API-key
auth, no service-account JSON needed). Extracts name / birth date / address
from the printed text on the card so the onboarding wizard can pre-fill
those steps instead of the worker typing everything by hand.

No-ops (raises nothing, extract_id_card is simply not called) if
GOOGLE_VISION_API_KEY isn't set -- mirrors the rest of this app's
unconfigured-is-safe pattern for optional external integrations.

Built without a live Vision API key or a real Thai ID card sample to test
the text-parsing regexes against -- the card layout/wording assumed here
(e.g. "ชื่อตัวและชื่อสกุล", "เกิดวันที่", "ที่อยู่") matches the standard
smart-card format but has not been verified against actual OCR output.
Verify extraction accuracy before relying on this, and always let the
worker review/edit the auto-filled fields in the wizard rather than saving
them unattended -- OCR on ID cards is routinely imperfect (glare, tilt,
small font).
"""
import base64
import os
import re
from datetime import date

import requests

VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY")
VISION_URL = "https://vision.googleapis.com/v1/images:annotate"

THAI_MONTHS = {
    "ม.ค.": 1, "มกราคม": 1, "ก.พ.": 2, "กุมภาพันธ์": 2, "มี.ค.": 3, "มีนาคม": 3,
    "เม.ย.": 4, "เมษายน": 4, "พ.ค.": 5, "พฤษภาคม": 5, "มิ.ย.": 6, "มิถุนายน": 6,
    "ก.ค.": 7, "กรกฎาคม": 7, "ส.ค.": 8, "สิงหาคม": 8, "ก.ย.": 9, "กันยายน": 9,
    "ต.ค.": 10, "ตุลาคม": 10, "พ.ย.": 11, "พฤศจิกายน": 11, "ธ.ค.": 12, "ธันวาคม": 12,
}


def is_configured():
    return bool(VISION_API_KEY)


def extract_id_card(image_bytes):
    """Best-effort field extraction from an ID card photo. Any field may be
    absent from the returned dict if it couldn't be confidently parsed."""
    payload = {
        "requests": [{
            "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
            "features": [{"type": "TEXT_DETECTION"}],
            "imageContext": {"languageHints": ["th"]},
        }]
    }
    resp = requests.post(f"{VISION_URL}?key={VISION_API_KEY}", json=payload, timeout=20)
    resp.raise_for_status()
    annotations = resp.json().get("responses", [{}])[0].get("textAnnotations")
    if not annotations:
        return {}
    return _parse_id_card_text(annotations[0]["description"])


def _parse_id_card_text(text):
    fields = {}

    prefix, first_name, last_name = _parse_name(text)
    if prefix:
        fields["title_prefix"] = prefix
        fields["gender"] = "หญิง" if prefix in ("นาง", "นางสาว", "น.ส.") else "ชาย"
    if first_name:
        fields["first_name"] = first_name
    if last_name:
        fields["last_name"] = last_name

    birth_date = _parse_birth_date(text)
    if birth_date:
        fields["birth_date"] = birth_date

    fields.update(_parse_address(text))
    return fields


def _parse_name(text):
    prefix_m = re.search(r"(นางสาว|น\.ส\.|นาง|นาย)", text)
    prefix = prefix_m.group(1) if prefix_m else None
    name_m = re.search(r"ชื่อตัวและชื่อสกุล\s*(?:นางสาว|น\.ส\.|นาง|นาย)?\s*([ก-๙]+)\s+([ก-๙]+)", text)
    if name_m:
        return prefix, name_m.group(1), name_m.group(2)
    return prefix, None, None


def _parse_birth_date(text):
    m = re.search(r"เกิดวันที่\s*(\d{1,2})\s*([ก-๙.]+)\s*(\d{4})", text)
    if not m:
        return None
    day, month_th, year_be = m.groups()
    month = THAI_MONTHS.get(month_th)
    if not month:
        return None
    try:
        return date(int(year_be) - 543, month, int(day)).isoformat()
    except ValueError:
        return None


def _parse_address(text):
    fields = {}
    m = re.search(r"ที่อยู่\s*(.+?)(?:ตำบล|แขวง)", text, re.DOTALL)
    if m:
        fields["address"] = re.sub(r"\s+", " ", m.group(1)).strip()
    m = re.search(r"(?:ตำบล|แขวง)\s*([ก-๙]+)", text)
    if m:
        fields["subdistrict"] = m.group(1)
    m = re.search(r"(?:อำเภอ|เขต)\s*([ก-๙]+)", text)
    if m:
        fields["district"] = m.group(1)
    m = re.search(r"จังหวัด\s*([ก-๙]+)", text)
    if m:
        fields["province"] = m.group(1)
    return fields
