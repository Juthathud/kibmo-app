from flask import Blueprint, jsonify, request

from db import get_db
from helpers import job_amount

bp = Blueprint("jobs", __name__)

REQUIRED_LABOR = ["employer_id", "category", "rate", "headcount", "days", "location", "job_date"]
REQUIRED_PROCUREMENT = ["employer_id", "item_list", "budget", "rate", "headcount", "days", "location", "job_date"]


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
