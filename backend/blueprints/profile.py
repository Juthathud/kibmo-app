import uuid
from pathlib import Path

from flask import Blueprint, g, jsonify, request, send_from_directory

from db import get_db, UPDATABLE_PROFILE_FIELDS
from id_card_ocr import is_configured as ocr_configured, extract_id_card
from session_auth import require_auth

bp = Blueprint("profile", __name__)

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# id_card/bank_account/profile_photo uploads are meant to be photos only —
# without this, any file extension/content-type was accepted and served
# back unauthenticated from /uploads/<filename>.
ALLOWED_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


@bp.route("/api/profile/update", methods=["POST"])
@require_auth
def update_profile():
    data = request.get_json(force=True)
    fields = data.get("fields") or {}

    unknown = set(fields) - UPDATABLE_PROFILE_FIELDS
    if unknown:
        return jsonify(error=f"ฟิลด์ไม่ถูกต้อง: {', '.join(unknown)}"), 400
    if not fields:
        return jsonify(error="ไม่มีข้อมูลที่จะบันทึก"), 400

    # list-valued fields (checkboxes) come in as JSON arrays from the
    # frontend — store them as comma-joined text since sqlite has no array type
    columns, values = [], []
    for key, value in fields.items():
        columns.append(f"{key} = ?")
        values.append(",".join(value) if isinstance(value, list) else value)
    values.append(g.user["id"])

    conn = get_db()
    conn.execute(f"UPDATE users SET {', '.join(columns)} WHERE id = ?", values)
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (g.user["id"],)).fetchone()
    conn.close()
    return jsonify(ok=True, user=dict(user))


@bp.route("/api/profile/upload-document", methods=["POST"])
@require_auth
def upload_document():
    doc_type = request.form.get("doc_type")
    file = request.files.get("file")
    columns = {"id_card": "id_card_url", "bank_account": "bank_account_url", "profile_photo": "profile_photo_url"}
    if doc_type not in columns or not file:
        return jsonify(error="ข้อมูลไม่ครบ"), 400

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS or not (file.mimetype or "").startswith("image/"):
        return jsonify(error="รองรับเฉพาะไฟล์รูปภาพเท่านั้น (jpg, png, webp, heic)"), 400

    filename = f"{uuid.uuid4().hex}{ext}"
    file.save(UPLOAD_DIR / filename)
    url = f"/uploads/{filename}"
    column = columns[doc_type]

    conn = get_db()
    conn.execute(f"UPDATE users SET {column} = ? WHERE id = ?", (url, g.user["id"]))
    conn.commit()
    conn.close()
    return jsonify(ok=True, url=url)


@bp.route("/api/profile/ocr-id-card", methods=["POST"])
@require_auth
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
