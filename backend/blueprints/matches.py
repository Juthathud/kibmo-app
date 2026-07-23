from flask import Blueprint, jsonify, request

from db import get_db
from helpers import job_amount

bp = Blueprint("matches", __name__)


@bp.route("/api/workers/<int:worker_id>/jobs")
def worker_jobs(worker_id):
    conn = get_db()
    worker = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'worker'", (worker_id,)).fetchone()
    if not worker:
        conn.close()
        return jsonify(error="ไม่พบลูกจ้างนี้"), 404

    available = conn.execute(
        """SELECT j.* FROM jobs j
           WHERE j.status = 'open'
             AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.job_id = j.id AND m.worker_id = ?)
           ORDER BY j.job_date, j.id DESC""",
        (worker_id,),
    ).fetchall()

    accepted = conn.execute(
        """SELECT j.* FROM jobs j
           JOIN matches m ON m.job_id = j.id
           WHERE m.worker_id = ? AND m.status = 'accepted'
           ORDER BY j.job_date, j.id DESC""",
        (worker_id,),
    ).fetchall()

    conn.close()
    interested = set((worker["interested_categories"] or "").split(",")) - {""}
    return jsonify(
        available=[_serialize(j, interested) for j in available],
        accepted=[_serialize(j, interested) for j in accepted],
    )


@bp.route("/api/jobs/<int:job_id>/workers")
def job_workers(job_id):
    conn = get_db()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404

    rows = conn.execute(
        """SELECT u.id, u.name, u.first_name, u.last_name, u.nickname,
                  u.phone, u.line_id, u.profile_photo_url, m.created_at
           FROM matches m
           JOIN users u ON u.id = m.worker_id
           WHERE m.job_id = ? AND m.status = 'accepted'
           ORDER BY m.created_at, m.id""",
        (job_id,),
    ).fetchall()
    conn.close()
    return jsonify(
        headcount=job["headcount"],
        accepted_count=len(rows),
        workers=[dict(r) for r in rows],
    )


@bp.route("/api/matches", methods=["POST"])
def respond_to_job():
    data = request.get_json(force=True)
    worker_id = data.get("worker_id")
    job_id = data.get("job_id")
    status = data.get("status")
    if status not in ("accepted", "declined"):
        return jsonify(error="สถานะไม่ถูกต้อง"), 400

    conn = get_db()
    worker = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'worker'", (worker_id,)).fetchone()
    if not worker:
        conn.close()
        return jsonify(error="ไม่พบลูกจ้างนี้"), 404

    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if job["status"] != "open":
        conn.close()
        return jsonify(error="งานนี้ปิดรับสมัครแล้ว"), 400

    existing = conn.execute(
        "SELECT * FROM matches WHERE job_id = ? AND worker_id = ?", (job_id, worker_id)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify(error="คุณตอบรับ/ปฏิเสธงานนี้ไปแล้ว"), 400

    conn.execute(
        "INSERT INTO matches (job_id, worker_id, status) VALUES (?, ?, ?)",
        (job_id, worker_id, status),
    )

    if status == "accepted":
        accepted_count = conn.execute(
            "SELECT COUNT(*) AS c FROM matches WHERE job_id = ? AND status = 'accepted'", (job_id,)
        ).fetchone()["c"]
        if accepted_count >= job["headcount"]:
            conn.execute("UPDATE jobs SET status = 'staffed' WHERE id = ?", (job_id,))

    conn.commit()
    conn.close()
    return jsonify(ok=True)


def _serialize(job, interested):
    d = dict(job)
    d["amount"] = job_amount(job)
    d["matches_interest"] = job["category"] in interested
    return d
