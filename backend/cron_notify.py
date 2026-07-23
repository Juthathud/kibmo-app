"""
Entry point for the Render cron job (see render.yaml, service
kibmoo-notify-reminders): POSTs to this app's own /api/jobs/notify-reminders
once a day so day-before job reminders go out without an in-process
scheduler (see the route's docstring in blueprints/jobs.py for why an
external trigger is used instead of e.g. APScheduler).
"""
import os
import sys

import requests

BACKEND_URL = os.environ.get("BACKEND_URL", "https://kibmoo-backend.onrender.com")
CRON_SECRET = os.environ.get("CRON_SECRET")

if __name__ == "__main__":
    headers = {"X-Cron-Secret": CRON_SECRET} if CRON_SECRET else {}
    resp = requests.post(f"{BACKEND_URL}/api/jobs/notify-reminders", headers=headers, timeout=30)
    print(f"[cron_notify] {resp.status_code} {resp.text}")
    resp.raise_for_status()
    sys.exit(0)
