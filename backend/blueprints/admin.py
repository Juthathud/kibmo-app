"""
Admin panel API -- platform-wide visibility/management for users, jobs, and
payments, gated by admin_auth.require_admin (a separate credential system
from the regular phone+OTP user login, see admin_auth.py's module
docstring). Every route here intentionally skips the ownership checks the
employer/worker-facing routes in jobs.py/matches.py enforce (an admin isn't
"the owning employer"), but keeps every business-rule guard from those
routes by calling their extracted _apply_* helpers rather than
re-implementing the logic.
"""
from flask import Blueprint, jsonify, request

from admin_auth import check_password, create_admin_session, require_admin
from blueprints.jobs import STATUS_TRANSITIONS, _apply_status_update, _serialize as _serialize_job
from blueprints.matches import _apply_mark_paid, _apply_no_show
from db import get_db
from helpers import job_amount, job_filters

bp = Blueprint("admin", __name__)


@bp.route("/api/admin/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    conn = get_db()
    admin = conn.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
    if not admin or not check_password(admin["password_hash"], password):
        conn.close()
        return jsonify(error="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"), 401

    token = create_admin_session(conn, admin["id"])
    conn.commit()
    conn.close()
    return jsonify(ok=True, token=token, admin={"id": admin["id"], "username": admin["username"]})


@bp.route("/api/admin/stats")
@require_admin
def stats():
    conn = get_db()
    total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    total_employers = conn.execute(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('employer','both')"
    ).fetchone()["c"]
    total_workers = conn.execute(
        "SELECT COUNT(*) AS c FROM users WHERE role IN ('worker','both')"
    ).fetchone()["c"]
    total_jobs = conn.execute("SELECT COUNT(*) AS c FROM jobs").fetchone()["c"]
    open_jobs = conn.execute("SELECT COUNT(*) AS c FROM jobs WHERE status = 'open'").fetchone()["c"]
    completed_jobs = conn.execute("SELECT COUNT(*) AS c FROM jobs WHERE status = 'completed'").fetchone()["c"]
    total_matches = conn.execute("SELECT COUNT(*) AS c FROM matches WHERE status = 'accepted'").fetchone()["c"]
    total_no_shows = conn.execute("SELECT COUNT(*) AS c FROM matches WHERE no_show = 1").fetchone()["c"]

    completed_matches = conn.execute(
        """SELECT m.paid, j.rate, j.pay_type, j.days FROM matches m
           JOIN jobs j ON j.id = m.job_id
           WHERE m.status = 'accepted' AND j.status = 'completed'"""
    ).fetchall()
    conn.close()

    paid_amount = sum(job_amount(r) for r in completed_matches if r["paid"])
    unpaid_amount = sum(job_amount(r) for r in completed_matches if not r["paid"])

    return jsonify(
        total_users=total_users,
        total_employers=total_employers,
        total_workers=total_workers,
        total_jobs=total_jobs,
        open_jobs=open_jobs,
        completed_jobs=completed_jobs,
        total_matches=total_matches,
        total_no_shows=total_no_shows,
        paid_amount=paid_amount,
        unpaid_amount=unpaid_amount,
    )


@bp.route("/api/admin/users")
@require_admin
def list_users():
    conn = get_db()
    clauses, params = [], []
    q = request.args.get("q")
    if q:
        clauses.append("(phone LIKE ? OR name LIKE ? OR nickname LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    role = request.args.get("role")
    if role:
        clauses.append("role = ?")
        params.append(role)
    account_status = request.args.get("account_status")
    if account_status:
        clauses.append("account_status = ?")
        params.append(account_status)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    users = conn.execute(
        f"""SELECT id, phone, name, first_name, last_name, nickname, role, account_status,
                   rating_avg, rating_count, no_show_count, created_at
            FROM users {where} ORDER BY id DESC""",
        params,
    ).fetchall()
    conn.close()
    return jsonify(users=[dict(u) for u in users])


@bp.route("/api/admin/users/<int:user_id>")
@require_admin
def get_user(user_id):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return jsonify(error="ไม่พบผู้ใช้นี้"), 404
    return jsonify(user=dict(user))


def _set_account_status(user_id, new_status):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return None
    conn.execute("UPDATE users SET account_status = ? WHERE id = ?", (new_status, user_id))
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user


@bp.route("/api/admin/users/<int:user_id>/ban", methods=["POST"])
@require_admin
def ban_user(user_id):
    user = _set_account_status(user_id, "banned")
    if not user:
        return jsonify(error="ไม่พบผู้ใช้นี้"), 404
    return jsonify(ok=True, user=dict(user))


@bp.route("/api/admin/users/<int:user_id>/unban", methods=["POST"])
@require_admin
def unban_user(user_id):
    user = _set_account_status(user_id, "active")
    if not user:
        return jsonify(error="ไม่พบผู้ใช้นี้"), 404
    return jsonify(ok=True, user=dict(user))


@bp.route("/api/admin/jobs")
@require_admin
def list_jobs():
    conn = get_db()
    clauses, params = job_filters(request.args)
    status = request.args.get("status")
    if status:
        clauses.append("j.status = ?")
        params.append(status)
    employer_id = request.args.get("employer_id", type=int)
    if employer_id is not None:
        clauses.append("j.employer_id = ?")
        params.append(employer_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    jobs = conn.execute(
        f"""SELECT j.*, u.name AS employer_name, u.phone AS employer_phone
            FROM jobs j JOIN users u ON u.id = j.employer_id
            {where} ORDER BY j.job_date DESC, j.id DESC""",
        params,
    ).fetchall()
    conn.close()
    return jsonify(jobs=[_serialize_job(j) for j in jobs])


@bp.route("/api/admin/jobs/<int:job_id>")
@require_admin
def get_job(job_id):
    conn = get_db()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404

    workers = conn.execute(
        """SELECT u.id, u.name, u.first_name, u.last_name, u.nickname, u.phone,
                  m.id AS match_id, m.status, m.checked_in, m.location_verified,
                  m.paid, m.paid_at, m.no_show
           FROM matches m JOIN users u ON u.id = m.worker_id
           WHERE m.job_id = ? ORDER BY m.created_at, m.id""",
        (job_id,),
    ).fetchall()
    conn.close()
    return jsonify(job=_serialize_job(job), workers=[dict(w) for w in workers])


@bp.route("/api/admin/jobs/<int:job_id>/status", methods=["POST"])
@require_admin
def admin_update_job_status(job_id):
    data = request.get_json(force=True)
    new_status = data.get("status")

    conn = get_db()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if new_status not in STATUS_TRANSITIONS:
        conn.close()
        return jsonify(error="สถานะไม่ถูกต้อง"), 400

    updated, err = _apply_status_update(conn, job, new_status)
    conn.close()
    if err:
        return jsonify(error=err), 400
    return jsonify(job=_serialize_job(updated))


@bp.route("/api/admin/matches")
@require_admin
def list_matches():
    conn = get_db()
    clauses, params = ["m.status = 'accepted'"], []
    paid = request.args.get("paid")
    if paid is not None:
        clauses.append("m.paid = ?")
        params.append(1 if paid in ("1", "true") else 0)
    no_show = request.args.get("no_show")
    if no_show is not None:
        clauses.append("m.no_show = ?")
        params.append(1 if no_show in ("1", "true") else 0)
    for key, column in (("job_id", "m.job_id"), ("worker_id", "m.worker_id"), ("employer_id", "j.employer_id")):
        value = request.args.get(key, type=int)
        if value is not None:
            clauses.append(f"{column} = ?")
            params.append(value)
    where = f"WHERE {' AND '.join(clauses)}"

    rows = conn.execute(
        f"""SELECT m.id AS match_id, m.job_id, m.checked_in, m.location_verified,
                   m.paid, m.paid_at, m.no_show, m.rating_by_employer, m.rating_by_worker,
                   j.category, j.job_date, j.status AS job_status, j.rate, j.pay_type, j.days,
                   e.id AS employer_id, e.name AS employer_name, e.phone AS employer_phone,
                   w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone
            FROM matches m
            JOIN jobs j ON j.id = m.job_id
            JOIN users e ON e.id = j.employer_id
            JOIN users w ON w.id = m.worker_id
            {where}
            ORDER BY j.job_date DESC, m.id DESC""",
        params,
    ).fetchall()
    conn.close()

    matches = []
    for r in rows:
        d = dict(r)
        d["amount"] = job_amount(r)
        matches.append(d)
    return jsonify(matches=matches)


@bp.route("/api/admin/matches/<int:match_id>/mark-paid", methods=["POST"])
@require_admin
def admin_mark_paid(match_id):
    conn = get_db()
    match = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match or match["status"] != "accepted":
        conn.close()
        return jsonify(error="ไม่พบการจับคู่งานนี้"), 404
    if match["paid"]:
        conn.close()
        return jsonify(error="จ่ายเงินไปแล้ว"), 400
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (match["job_id"],)).fetchone()
    if job["status"] != "completed":
        conn.close()
        return jsonify(error="จ่ายเงินได้หลังงานจบแล้วเท่านั้น"), 400

    _apply_mark_paid(conn, match, job)
    conn.close()
    return jsonify(ok=True)


@bp.route("/api/admin/matches/<int:match_id>/no-show", methods=["POST"])
@require_admin
def admin_mark_no_show(match_id):
    conn = get_db()
    match = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match or match["status"] != "accepted":
        conn.close()
        return jsonify(error="ไม่พบการจับคู่งานนี้"), 404
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (match["job_id"],)).fetchone()
    if job["status"] not in ("staffed", "in_progress"):
        conn.close()
        return jsonify(error="แจ้งไม่มาตามนัดได้เฉพาะงานที่พร้อมเริ่มหรือกำลังทำงานเท่านั้น"), 400
    if match["no_show"]:
        conn.close()
        return jsonify(error="แจ้งไปแล้ว"), 400
    if match["checked_in"]:
        conn.close()
        return jsonify(error="ลูกจ้างเช็คอินแล้ว ไม่สามารถแจ้งว่าไม่มาได้"), 400

    _apply_no_show(conn, match)
    conn.close()
    return jsonify(ok=True)
