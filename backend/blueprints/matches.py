from flask import Blueprint, jsonify, request

import sms
from db import GPS_PROXIMITY_METERS, get_db
from helpers import haversine_meters, job_amount, job_filters

bp = Blueprint("matches", __name__)


@bp.route("/api/workers/<int:worker_id>/jobs")
def worker_jobs(worker_id):
    conn = get_db()
    worker = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role IN ('worker','both')", (worker_id,)
    ).fetchone()
    if not worker:
        conn.close()
        return jsonify(error="ไม่พบลูกจ้างนี้"), 404

    clauses, params = job_filters(request.args)
    where_extra = (" AND " + " AND ".join(clauses)) if clauses else ""
    available = conn.execute(
        f"""SELECT j.* FROM jobs j
           WHERE j.status = 'open'
             AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.job_id = j.id AND m.worker_id = ?)
             {where_extra}
           ORDER BY j.job_date, j.id DESC""",
        [worker_id, *params],
    ).fetchall()

    accepted = conn.execute(
        """SELECT j.*, m.id AS match_id, m.checked_in, m.location_verified,
                  m.paid, m.rating_by_worker
           FROM jobs j
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
    employer_id = request.args.get("employer_id", type=int)
    if employer_id is None:
        return jsonify(error="กรุณาระบุ employer_id"), 400

    conn = get_db()
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify(error="ไม่พบงานนี้"), 404
    if job["employer_id"] != employer_id:
        conn.close()
        return jsonify(error="คุณไม่มีสิทธิ์ดูข้อมูลนี้"), 403

    rows = conn.execute(
        """SELECT u.id, u.name, u.first_name, u.last_name, u.nickname,
                  u.phone, u.line_id, u.profile_photo_url, u.rating_avg, u.rating_count,
                  m.id AS match_id, m.created_at, m.checked_in, m.location_verified,
                  m.paid, m.paid_at, m.rating_by_employer
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


@bp.route("/api/workers/<int:worker_id>/profile")
def worker_profile(worker_id):
    conn = get_db()
    worker = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role IN ('worker','both')", (worker_id,)
    ).fetchone()
    conn.close()
    if not worker:
        return jsonify(error="ไม่พบลูกจ้างนี้"), 404

    return jsonify(
        profile={
            "id": worker["id"],
            "name": worker["name"],
            "first_name": worker["first_name"],
            "last_name": worker["last_name"],
            "nickname": worker["nickname"],
            "gender": worker["gender"],
            "profile_photo_url": worker["profile_photo_url"],
            "interested_categories": worker["interested_categories"],
            "work_areas": worker["work_areas"],
            "rating_avg": worker["rating_avg"],
            "rating_count": worker["rating_count"],
        }
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
    worker = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role IN ('worker','both')", (worker_id,)
    ).fetchone()
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

    # BEGIN IMMEDIATE grabs the write lock up front so the accepted-count
    # check and the insert below happen atomically. Without this, two
    # concurrent accepts can both read the same under-headcount count and
    # both insert, overbooking the job past its headcount.
    conn.execute("BEGIN IMMEDIATE")
    try:
        existing = conn.execute(
            "SELECT * FROM matches WHERE job_id = ? AND worker_id = ?", (job_id, worker_id)
        ).fetchone()
        if existing:
            conn.rollback()
            conn.close()
            return jsonify(error="คุณตอบรับ/ปฏิเสธงานนี้ไปแล้ว"), 400

        if status == "accepted":
            accepted_count = conn.execute(
                "SELECT COUNT(*) AS c FROM matches WHERE job_id = ? AND status = 'accepted'", (job_id,)
            ).fetchone()["c"]
            if accepted_count >= job["headcount"]:
                conn.rollback()
                conn.close()
                return jsonify(error="งานนี้เต็มแล้ว"), 409

        conn.execute(
            "INSERT INTO matches (job_id, worker_id, status) VALUES (?, ?, ?)",
            (job_id, worker_id, status),
        )

        if status == "accepted" and accepted_count + 1 >= job["headcount"]:
            conn.execute("UPDATE jobs SET status = 'staffed' WHERE id = ?", (job_id,))

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    employer = conn.execute("SELECT * FROM users WHERE id = ?", (job["employer_id"],)).fetchone()
    conn.close()

    if status == "accepted" and employer:
        worker_name = worker["nickname"] or worker["name"] or "ลูกจ้าง"
        sms.send(
            employer["phone"],
            f"{worker_name} รับงาน {job['category']} ({job['job_date']}) แล้ว - กีบหมู แมนเพาเวอร์",
        )

    return jsonify(ok=True)


@bp.route("/api/matches/<int:match_id>/checkin", methods=["POST"])
def checkin(match_id):
    data = request.get_json(force=True)
    lat, lng = data.get("lat"), data.get("lng")
    if lat is None or lng is None:
        return jsonify(error="ไม่พบตำแหน่ง GPS"), 400

    conn = get_db()
    match = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match or match["status"] != "accepted":
        conn.close()
        return jsonify(error="ไม่พบการจับคู่งานนี้"), 404
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (match["job_id"],)).fetchone()
    if job["status"] not in ("staffed", "in_progress"):
        conn.close()
        return jsonify(error="เช็คอินได้เฉพาะงานที่พร้อมเริ่มหรือกำลังทำงาน"), 400

    verified = 0
    has_job_location = job["lat"] is not None and job["lng"] is not None
    if has_job_location:
        distance = haversine_meters(job["lat"], job["lng"], lat, lng)
        verified = 1 if distance <= GPS_PROXIMITY_METERS else 0

    # When the employer turned on gps_auto_checkin at job-posting time, and
    # we're actually able to verify a distance against the job's saved
    # location, only count this as checked-in once proximity is confirmed —
    # otherwise fall back to the old honor-system behavior (always checked
    # in on tap) since there's nothing to verify against.
    if job["gps_auto_checkin"] and has_job_location and not verified:
        conn.execute(
            """UPDATE matches SET checkin_lat = ?, checkin_lng = ?,
                   checkin_at = datetime('now'), location_verified = 0 WHERE id = ?""",
            (lat, lng, match_id),
        )
        conn.commit()
        conn.close()
        return jsonify(
            error="ตำแหน่งของคุณอยู่ไกลจากพื้นที่ทำงานเกินไป กรุณาเข้าใกล้จุดทำงานแล้วลองเช็คอินอีกครั้ง"
        ), 400

    conn.execute(
        """UPDATE matches SET checked_in = 1, checkin_lat = ?, checkin_lng = ?,
               checkin_at = datetime('now'), location_verified = ? WHERE id = ?""",
        (lat, lng, verified, match_id),
    )
    conn.commit()
    conn.close()
    return jsonify(ok=True, location_verified=bool(verified))


@bp.route("/api/matches/<int:match_id>/rate", methods=["POST"])
def rate_match(match_id):
    data = request.get_json(force=True)
    rater = data.get("rater")
    rating = data.get("rating")
    note = (data.get("note") or "").strip() or None
    if rater not in ("employer", "worker"):
        return jsonify(error="ผู้ให้คะแนนไม่ถูกต้อง"), 400
    if rating not in (1, 2, 3, 4, 5):
        return jsonify(error="คะแนนต้องอยู่ระหว่าง 1-5"), 400

    conn = get_db()
    match = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match:
        conn.close()
        return jsonify(error="ไม่พบการจับคู่งานนี้"), 404
    job = conn.execute("SELECT * FROM jobs WHERE id = ?", (match["job_id"],)).fetchone()
    if not job or job["status"] != "completed":
        conn.close()
        return jsonify(error="ให้คะแนนได้หลังงานจบแล้วเท่านั้น"), 400

    if rater == "employer":
        if match["rating_by_employer"] is not None:
            conn.close()
            return jsonify(error="ให้คะแนนไปแล้ว"), 400
        conn.execute(
            "UPDATE matches SET rating_by_employer = ?, rating_by_employer_note = ? WHERE id = ?",
            (rating, note, match_id),
        )
        rated_user_id = match["worker_id"]
    else:
        if match["rating_by_worker"] is not None:
            conn.close()
            return jsonify(error="ให้คะแนนไปแล้ว"), 400
        conn.execute(
            "UPDATE matches SET rating_by_worker = ?, rating_by_worker_note = ? WHERE id = ?",
            (rating, note, match_id),
        )
        rated_user_id = job["employer_id"]

    user = conn.execute(
        "SELECT rating_avg, rating_count FROM users WHERE id = ?", (rated_user_id,)
    ).fetchone()
    new_count = user["rating_count"] + 1
    new_avg = (user["rating_avg"] * user["rating_count"] + rating) / new_count
    conn.execute(
        "UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?",
        (new_avg, new_count, rated_user_id),
    )
    conn.commit()
    conn.close()
    return jsonify(ok=True)


@bp.route("/api/matches/<int:match_id>/mark-paid", methods=["POST"])
def mark_paid(match_id):
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

    conn.execute("UPDATE matches SET paid = 1, paid_at = datetime('now') WHERE id = ?", (match_id,))
    worker = conn.execute("SELECT * FROM users WHERE id = ?", (match["worker_id"],)).fetchone()
    conn.commit()
    conn.close()

    amount = job_amount(job)
    sms.send(
        worker["phone"],
        f"คุณได้รับเงินค่าจ้าง {amount} บาท จากงาน {job['category']} เรียบร้อยแล้ว - กีบหมู แมนเพาเวอร์",
    )
    return jsonify(ok=True)


def _serialize(job, interested):
    d = dict(job)
    d["amount"] = job_amount(job)
    d["matches_interest"] = job["category"] in interested
    return d
