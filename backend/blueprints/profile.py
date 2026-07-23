import re
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory

from db import get_db, UPDATABLE_PROFILE_FIELDS
from id_card_ocr import is_configured as ocr_configured, extract_id_card

bp = Blueprint("profile", __name__)

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def _normalize_phone(raw):
    return re.sub(r"\D", "", raw or "")


@bp.route("/api/profile/update", methods=["POST"])
def update_profile():
    data = request.get_json(force=True)
    phone = _normalize_phone(data.get("phone"))
    fields = data.get("fields") or {}

    unknown = set(fields) - UPDATABLE_PROFILE_FIELDS
    if unknown:
        return jsonify(error=f"ฟิลด์ไม่ถูกต้อง: {', '.join(unknown)}"), 400
    if not fields:
        return jsonify(error="ไม่มีข้อมูลที่จะบันทึก"), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="ไม่พบผู้ใช้นี้"), 404

    # list-valued fields (checkboxes) come in as JSON arrays from the
    # frontend — store them as comma-joined text since sqlite has no array type
    columns, values = [], []
    for key, value in fields.items():
        columns.append(f"{key} = ?")
        values.append(",".join(value) if isinstance(value, list) else value)
    values.append(phone)

    conn.execute(f"UPDATE users SET {', '.join(columns)} WHERE phone = ?", values)
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    conn.close()
    return jsonify(ok=True, user=dict(user))


@bp.route("/api/profile/upload-document", methods=["POST"])
def upload_document():
    phone = _normalize_phone(request.form.get("phone"))
    doc_type = request.form.get("doc_type")
    file = request.files.get("file")
    columns = {"id_card": "id_card_url", "bank_account": "bank_account_url", "profile_photo": "profile_photo_url"}
    if doc_type not in columns or not file:
        return jsonify(error="ข้อมูลไม่ครบ"), 400

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file.save(UPLOAD_DIR / filename)
    url = f"/uploads/{filename}"
    column = columns[doc_type]

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    if not user:
        conn.close()
        return jsonify(error="ไม่พบผู้ใช้นี้"), 404
    conn.execute(f"UPDATE users SET {column} = ? WHERE phone = ?", (url, phone))
    conn.commit()
    conn.close()
    return jsonify(ok=True, url=url)


@bp.route("/api/profile/ocr-id-card", methods=["POST"])
def ocr_id_card():
    if not ocr_configured():
        return jsonify(error="ยังไม่ได้ตั้งค่าระบบอ่านบัตรอัตโนมัติ กรุณากรอกข้อมูลด้วยตนเอง"), 503

    file = request.files.get("file")
    if not file:
        return jsonify(error="ไม่พบไฟล์รูปภาพ"), 400

    try:
        fields = extract_id_card(file.read())
    except Exception:
        return jsonify(error="อ่านข้อมูลจากบัตรไม่สำเร็จ กรุณากรอกข้อมูลด้วยตนเอง"), 502

    return jsonify(ok=True, fields=fields)


@bp.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)
