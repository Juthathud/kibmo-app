import random
import re
import string
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("auth", __name__)

OTP_TTL_MINUTES = 5
PHONE_RE = re.compile(r"^0\d{9}$")


def _normalize_phone(raw):
    return re.sub(r"\D", "", raw or "")


@bp.route("/api/auth/request-otp", methods=["POST"])
def request_otp():
    data = request.get_json(force=True)
    phone = _normalize_phone(data.get("phone"))
    if not PHONE_RE.match(phone):
        return jsonify(error="เบอร์โทรศัพท์ไม่ถูกต้อง"), 400

    code = f"{random.randint(0, 999999):06d}"
    ref = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    expires_at = (datetime.now() + timedelta(minutes=OTP_TTL_MINUTES)).isoformat(timespec="seconds")

    conn = get_db()
    conn.execute(
        """INSERT INTO otp_codes (phone, code, ref, expires_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(phone) DO UPDATE SET code = excluded.code, ref = excluded.ref,
                                             expires_at = excluded.expires_at, created_at = datetime('now')""",
        (phone, code, ref, expires_at),
    )
    conn.commit()
    conn.close()

    # NOTE: no SMS gateway wired up yet for this prototype — the code is
    # logged server-side and echoed back as dev_otp so it can be tested
    # end-to-end locally. Replace with a real SMS provider before any real
    # deployment and drop dev_otp from the response.
    print(f"[OTP] {phone} -> {code} (ref {ref})")
    return jsonify(ok=True, ref=ref, ttl_seconds=OTP_TTL_MINUTES * 60, dev_otp=code)


@bp.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json(force=True)
    phone = _normalize_phone(data.get("phone"))
    otp = (data.get("otp") or "").strip()

    conn = get_db()
    row = conn.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
    if not row or row["code"] != otp:
        conn.close()
        return jsonify(error="รหัส OTP ไม่ถูกต้อง"), 400
    if datetime.fromisoformat(row["expires_at"]) < datetime.now():
        conn.close()
        return jsonify(error="รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่"), 400

    conn.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    if not user:
        cur = conn.execute("INSERT INTO users (phone) VALUES (?)", (phone,))
        user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify(ok=True, user=dict(user))


@bp.route("/api/auth/register", methods=["POST"])
def complete_profile():
    data = request.get_json(force=True)
    phone = _normalize_phone(data.get("phone"))
    name = (data.get("name") or "").strip()
    role = data.get("role")
    if role not in ("employer", "worker"):
        return jsonify(error="สถานะไม่ถูกต้อง"), 400
    if not name:
        return jsonify(error="กรุณากรอกชื่อ"), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="ไม่พบเบอร์นี้ กรุณายืนยัน OTP ก่อน"), 404

    conn.execute(
        "UPDATE users SET name = ?, role = ?, profile_complete = 1 WHERE phone = ?",
        (name, role, phone),
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    conn.close()
    return jsonify(ok=True, user=dict(user))
