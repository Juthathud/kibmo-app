from datetime import date, timedelta

from flask import Blueprint, jsonify, request

import sms
from db import get_db
from helpers import current_user, job_amount, job_filters

bp = Blueprint("jobs", __name__)

REQUIRED_LABOR = ["category", "rate", "headcount", "days", "location", "job_date"]
REQUIRED_PROCUREMENT = ["item_list", "budget", "rate", "headcount", "days", "location", "job_date"]

JOB_TYPES = ("labor", "procurement")
PAY_TYPES = ("daily", "lump_sum")

# Fields an employer can change via PATCH /api/jobs/<id> — only while the
# job is still 'open' (no one has been matched to it yet).
EDITABLE_FIELDS = [
    "category", "pay_type", "rate", "headcount", "days", "location",
    "job_date", "gps_auto_checkin", "item_list", "budget", "lat", "lng",
]


@bp.route("/api/jobs", methods=["GET"])
def list_open_jobs():
    conn = get_db()
    clauses, params = job_filters(request.args)
    where_extra = (" AND " + " AND ".join(clauses)) if clauses else ""
    jobs = conn.execute(
        f"SELECT * FROM jobs j WHERE j.status = 'open' {where_extra} ORDER BY j.job_date, j.id DESC",
        params,
    ).fetchall()
    conn.close()
    return jsonify(jobs=[_serialize(j) for j in jobs])


@bp.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.get_json(force=True)
    job_type = data.get("job_type") or "labor"
    if job_type not in JOB_TYPES:
        return jsonify(error="ประเภทงานไม่ถูกต้อง"), 400

    required = REQUIRED_PROCUREMENT if job_type == "procurement" else REQUIRED_LABOR
    if any(not data.get(k) for k in required):
        return jsonify(error="กรอกข้อมูลงานไม่ครบ"), 400

    pay_type = data.get("pay_type") or "daily"
    if pay_type not in PAY_TYPES:
        return jsonify(error="ประเภทค่าจ้างไม่ถูกต้อง"), 400

    conn = get_db()
    # The employer posting this job is whoever the token belongs to, not
    # whatever employer_id the client sends — otherwise anyone could post
    # a job under another employer's account.
    employer = current_user(conn)
    if not employer or employer["role"] not in ("employer", "both"):
        conn.close()
        return jsonify(error="ไม่พบนายจ้างนี้"), 404

    category = "จัดซื้ออุปกรณ์ตามสั่ง" if job_type == "procurement" else data["category"]

    cur = conn.execute(
        """INSERT INTO jobs (employer_id, job_type, category, pay_type, rate, headcount, days,
                              location, job_date, gps_auto_checkin, item_list, budget, lat, lng)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            employer["id"],
            job_type,
            category,
            pay_type,
            data["rate"],
            data["headcount"],
            data.get("days") or 1,
            data["location"],
            data["job_date"],
            1 if data.get("gps_auto_checkin") else 0,
            data.get("item_list"),
            data.get("budget"),
            data.get("lat"),
            data.get("lng"),
        ),
    )
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify(job=_serialize(job))


@bp.route("/api/jobs/<int:job_id>", methods=["PATCH"])
def edit_job(job_id):
    data = request.get_json(force=True)

    conn = get_db()
    caller = current_user(conn)
    if not caller:
        conn.close()
        return jsonify(error="กรุณาเข้าสู่ระบบใหม่"), 401
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if job["employer_id"] != caller["id"]:
        conn.close()
        return jsonify(error="คุณไม่มีสิทธิ์แก้ไขงานนี้"), 403
    if job["status"] != "open":
        conn.close()
        return jsonify(error="แก้ไขได้เฉพาะงานที่ยังไม่มีคนรับเท่านั้น"), 400

    updates = {k: v for k, v in data.items() if k in EDITABLE_FIELDS}
    if not updates:
        conn.close()
        return jsonify(error="ไม่มีข้อมูลที่จะแก้ไข"), 400

    err = _validate_editable_fields(updates)
    if err:
        conn.close()
        return jsonify(error=err), 400

    columns = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [job_id]
    conn.execute(f"UPDATE jobs SET {', '.join(columns)} WHERE id = ?", values)
    conn.commit()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return jsonify(job=_serialize(job))


# Allowed forward transitions for a job's lifecycle. An employer can move a
# job along this chain but not skip steps or move backwards. Cancelling is
# allowed any time before the job actually starts.
STATUS_TRANSITIONS = {
    "open": {"in_progress", "cancelled"},
    "staffed": {"in_progress", "cancelled"},
    "in_progress": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


@bp.route("/api/jobs/<int:job_id>/status", methods=["POST"])
def update_job_status(job_id):
    data = request.get_json(force=True)
    new_status = data.get("status")

    conn = get_db()
    caller = current_user(conn)
    if not caller:
        conn.close()
        return jsonify(error="กรุณาเข้าสู่ระบบใหม่"), 401
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if job["employer_id"] != caller["id"]:
        conn.close()
        return jsonify(error="คุณไม่มีสิทธิ์แก้ไขงานนี้"), 403
    if new_status not in STATUS_TRANSITIONS.get(job["status"], set()):
        conn.close()
        return jsonify(error="ไม่สามารถเปลี่ยนสถานะงานนี้ได้"), 400
    if new_status == "in_progress":
        accepted_count = conn.execute(
            "SELECT COUNT(*) AS c FROM matches WHERE job_id = ? AND status = 'accepted'", (job_id,)
        ).fetchone()["c"]
        if accepted_count == 0:
            conn.close()
            return jsonify(error="ยังไม่มีลูกจ้างรับงานนี้"), 400

    conn.execute("UPDATE jobs SET status = ? WHERE id = ?", (new_status, job_id))
    conn.commit()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return jsonify(job=_serialize(job))


@bp.route("/api/employers/<int:employer_id>/jobs")
def employer_jobs(employer_id):
    conn = get_db()
    caller = current_user(conn)
    if not caller or caller["id"] != employer_id:
        conn.close()
        return jsonify(error="คุณไม่มีสิทธิ์ดูข้อมูลนี้"), 403
    jobs = conn.execute(
        "SELECT * FROM jobs WHERE employer_id = ? ORDER BY id DESC", (employer_id,)
    ).fetchall()
    conn.close()
    return jsonify(jobs=[_serialize(j) for j in jobs])


@bp.route("/api/jobs/notify-reminders", methods=["POST"])
def notify_reminders():
    """Send a day-before SMS reminder to accepted workers for jobs happening
    tomorrow. This repo has no in-process scheduler — trigger this route
    from an external cron (e.g. Render cron job) once a day."""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    conn = get_db()
    rows = conn.execute(
        """SELECT j.category, j.job_date, j.location, u.phone, u.nickname, u.name
           FROM jobs j
           JOIN matches m ON m.job_id = j.id AND m.status = 'accepted'
           JOIN users u ON u.id = m.worker_id
           WHERE j.job_date = ? AND j.status IN ('staffed', 'in_progress')""",
        (tomorrow,),
    ).fetchall()
    conn.close()

    for row in rows:
        name = row["nickname"] or row["name"] or "คุณ"
        sms.send(
            row["phone"],
            f"แจ้งเตือน: {name} มีนัดงาน {row['category']} พรุ่งนี้ ({row['job_date']}) "
            f"ที่ {row['location']} - กีบหมู แมนเพาเวอร์",
        )

    return jsonify(ok=True, notified=len(rows))


def _validate_editable_fields(updates):
    """Applies the same enum checks create_job() runs at creation time to a
    PATCH's `updates` dict, so /api/jobs/<id> can't be used to sneak an
    invalid pay_type (or similar) past validation. Returns a Thai error
    string, or None if updates are valid."""
    if "pay_type" in updates and updates["pay_type"] not in PAY_TYPES:
        return "ประเภทค่าจ้างไม่ถูกต้อง"
    return None


def _serialize(job):
    d = dict(job)
    d["amount"] = job_amount(job)
    return d
