"""
Opaque bearer-token session auth. A token is minted at successful OTP
verification (auth.py) and must be sent as `Authorization: Bearer <token>`
on every protected route. Tokens live in the `sessions` table until an
explicit logout deletes them -- no expiry for now.

Replaces the old pattern of every route trusting a client-supplied
employer_id/worker_id/phone as if it proved identity.
"""
import secrets
from functools import wraps

from flask import g, jsonify, request

from db import get_db


def create_session(conn, user_id):
    """Mint a new session token for user_id and insert it via the given
    connection. Caller is responsible for committing."""
    token = secrets.token_hex(32)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def _extract_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[len("Bearer "):].strip() or None


def require_auth(f):
    """Resolves the Authorization header to the owning user row and
    exposes it as g.user (sqlite3.Row) / g.token. 401s otherwise."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify(error="กรุณาเข้าสู่ระบบ"), 401

        conn = get_db()
        user = conn.execute(
            """SELECT u.* FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.token = ?""",
            (token,),
        ).fetchone()
        conn.close()
        if not user:
            return jsonify(error="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"), 401

        g.user = user
        g.token = token
        return f(*args, **kwargs)

    return wrapper
