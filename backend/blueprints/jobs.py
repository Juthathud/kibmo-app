from flask import Blueprint, jsonify, request

from db import get_db
from helpers import job_amount

bp = Blueprint("jobs", __name__)

REQUIRED_LABOR = ["employer_id", "category", "rate", "headcount", "days", "location", "job_date"]
REQUIRED_PROCUREMENT = ["employer_id", "item_list", "budget", "rate", "headcount", "days", "location", "job_date"]


@bp.route("/api/jobs", methods=["GET"])
def list_open_jobs():
    conn = get_db()
    jobs = conn.execute(
        "SELECT * FROM jobs WHERE status = 'open' ORDER BY job_date, id DESC"
    ).fetchall()
    conn.close()
    return jsonify(jobs=[_serialize(j) for j in jobs])


@bp.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.get_json(force=True)
    job_type = data.get("job_type") or "labor"
    if job_type not in ("labor", "procurement"):
        return jsonify(error="ประเภทงานไม่ถูกต้อง"), 400

    required = REQUIRED_PROCUREMENT if job_type == "procurement" else REQUIRED_LABOR
    if any(not data.get(k) for k in required):
        return jsonify(error="กรอกข้อมูลงานไม่ครบ"), 400

    pay_type = data.get("pay_type") or "daily"
    if pay_type not in ("daily", "lump_sum"):
        return jsonify(error="ประเภทค่าจ้างไม่ถูกต้อง"), 400

    conn = get_db()
    employer = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role = 'employer'", (data["employer_id"],)
    ).fetchone()
    if not employer:
        conn.close()
        return jsonify(error="ไม่พบนายจ้างนี้"), 404

    category = "จัดซื้ออุปกรณ์ตามสั่ง" if job_type == "procurement" else data["category"]

    cur = conn.execute(
        """INSERT INTO jobs (employer_id, job_type, category, pay_type, rate, headcount, days,
                              location, job_date, gps_auto_checkin, item_list, budget)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
        ),
    )
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify(job=_serialize(job))


# Allowed forward transitions for a job's lifecycle. An employer can move a
# job along this chain but not skip steps or move backwards.
STATUS_TRANSITIONS = {
    "open": {"in_progress"},
    "staffed": {"in_progress"},
    "in_progress": {"completed"},
    "completed": set(),
}


@bp.route("/api/jobs/<int:job_id>/status", methods=["POST"])
def update_job_status(job_id):
    data = request.get_json(force=True)
    new_status = data.get("status")
    employer_id = data.get("employer_id")

    conn = get_db()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if employer_id is not None and job["employer_id"] != employer_id:
        conn.close()
        return jsonify(error="คุณไม่มีสิทธิ์แก้ไขงานนี้"), 403
    if new_status not in STATUS_TRANSITIONS.get(job["status"], set()):
        conn.close()
        return jsonify(error="ไม่สามารถเปลี่ยนสถานะงานนี้ได้"), 400

    conn.execute("UPDATE jobs SET status = ? WHERE id = ?", (new_status, job_id))
    conn.commit()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return jsonify(job=_serialize(job))


@bp.route("/api/employers/<int:employer_id>/jobs")
def employer_jobs(employer_id):
    conn = get_db()
    jobs = conn.execute(
        "SELECT * FROM jobs WHERE employer_id = ? ORDER BY id DESC", (employer_id,)
    ).fetchall()
    conn.close()
    return jsonify(jobs=[_serialize(j) for j in jobs])


def _serialize(job):
    d = dict(job)
    d["amount"] = job_amount(job)
    return d
