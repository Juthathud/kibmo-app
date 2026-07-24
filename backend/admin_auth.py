"""
Admin authentication -- deliberately separate from session_auth.py (which
handles regular phone+OTP user sessions). Same opaque bearer-token pattern
(mirrors session_auth.py's `sessions` table / secrets.token_hex approach)
so the codebase has one consistent auth mechanism, but backed by its own
`admins` / `admin_sessions` tables so an admin token can never resolve
against a regular user session or vice versa.

Passwords are hashed with werkzeug.security (a Flask dependency already
installed -- no new pip install needed). There is no public admin
registration route; accounts are created via create_admin.py.
"""
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db

ADMIN_TOKEN_MAX_AGE = timedelta(hours=8)


def hash_password(password):
    return generate_password_hash(password)


def check_password(password_hash, password):
    return check_password_hash(password_hash, password)


def create_admin_session(conn, admin_id):
    """Mint a new admin session token and insert it via the given
    connection. Caller is responsible for committing."""
    token = secrets.token_hex(32)
    conn.execute("INSERT INTO admin_sessions (token, admin_id) VALUES (?, ?)", (token, admin_id))
    return token


def _extract_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[len("Bearer "):].strip() or None


def require_admin(f):
    """Resolves the Authorization header to the owning admin row and
    exposes it as g.admin (sqlite3.Row) / g.admin_token. 401s otherwise.
    Unlike regular user sessions (no expiry, per session_auth.py), admin
    sessions expire after ADMIN_TOKEN_MAX_AGE -- this surface is more
    sensitive (every user's phone/ID-card/payment data), so a stolen admin
    token has a shorter shelf life."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify(error="กรุณาเข้าสู่ระบบ"), 401

        conn = get_db()
        row = conn.execute(
            """SELECT a.*, s.created_at AS session_created_at FROM admin_sessions s
               JOIN admins a ON a.id = s.admin_id
               WHERE s.token = ?""",
            (token,),
        ).fetchone()
        conn.close()
        if not row:
            return jsonify(error="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"), 401

        # admin_sessions.created_at is written via SQLite's datetime('now')
        # (UTC) -- compare against datetime.utcnow() to match, same reasoning
        # as the OTP resend-cooldown check in blueprints/auth.py.
        session_age = datetime.utcnow() - datetime.fromisoformat(row["session_created_at"])
        if session_age > ADMIN_TOKEN_MAX_AGE:
            return jsonify(error="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"), 401

        g.admin = row
        g.admin_token = token
        return f(*args, **kwargs)

    return wrapper
