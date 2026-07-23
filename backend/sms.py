"""
Transactional SMS notifications (worker accepted a job, payment marked paid,
day-before job reminders) via Twilio's REST API.

No-ops (logs to stdout instead of raising) if TWILIO_ACCOUNT_SID /
TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER aren't set — mirrors id_card_ocr.py's
unconfigured-is-safe pattern. This is separate from the OTP flow in auth.py,
which has its own dev-mode fallback (dev_otp in the response) and is left
untouched.
"""
import os

import requests

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")


def is_configured():
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


def send(to_phone, body):
    if not is_configured():
        print(f"[SMS] (unconfigured) to {to_phone}: {body}")
        return False

    to_e164 = f"+66{to_phone[1:]}" if to_phone.startswith("0") else to_phone
    try:
        resp = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            data={"To": to_e164, "From": TWILIO_FROM_NUMBER, "Body": body},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[SMS] failed to {to_phone}: {e}")
        return False
