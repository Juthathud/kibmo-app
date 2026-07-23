# กีบหมู แมนเพาเวอร์ — สรุปบั๊ก

ไฟล์นี้เก็บบั๊กที่เจอในแอป ให้แก้ไขไฟล์นี้ทุกครั้งที่เจอบั๊กใหม่ (เพิ่มลง "บั๊กที่เจอแล้วยังไม่แก้") หรือแก้บั๊กเสร็จ (ย้ายจาก "ยังไม่แก้" มา "แก้แล้ว")

## บั๊กที่แก้แล้ว

รีวิวทั้งแอป (backend + frontend) เมื่อ 2026-07-23 เจอ 6 บั๊ก แก้ครบแล้วทั้งหมด (ยังไม่ commit):

1. **[Security] Auth bypass การแก้ไข/ยกเลิกงาน** — `backend/blueprints/jobs.py` (`edit_job`, `update_job_status`) เช็คสิทธิ์เจ้าของงานแบบ `if employer_id is not None and ...` ทำให้ omit `employer_id` แล้วข้ามการเช็คได้ ใครก็แก้/ยกเลิกงานของนายจ้างคนอื่นได้ → แก้เป็นบังคับต้องมี `employer_id` (400 ถ้าไม่มี) แล้วเช็คให้ตรงเจ้าของงาน (403 ถ้าไม่ตรง)
2. **[Security] เบอร์โทร/LINE ID ของลูกจ้างรั่ว** — `GET /api/jobs/<id>/workers` (`backend/blueprints/matches.py`) ไม่เช็คความเป็นเจ้าของงานเลย ไล่เดข job_id ดึงเบอร์โทร/LINE ของลูกจ้างทุกงานในระบบได้ → เพิ่มการบังคับส่ง `employer_id` และเช็คให้ตรงเจ้าของงาน, อัปเดต `frontend/src/components/employer/EmployerJobCard.jsx` ให้ส่ง employer_id ไปด้วย
3. **[Correctness] Race condition รับสมัครเกิน headcount** — `POST /api/matches` (`respond_to_job`) ไม่เช็คจำนวนที่รับแล้วก่อน insert แบบ atomic ทำให้สอง worker กดรับพร้อมกันเกิน headcount ได้ → ห่อด้วย `BEGIN IMMEDIATE` transaction เช็ค headcount ซ้ำก่อน insert คืน 409 ถ้าเต็ม, เพิ่ม `PRAGMA busy_timeout` ใน `backend/db.py`
4. **[Correctness] `gps_auto_checkin` ไม่มีผลอะไรเลย** — ตั้งค่าได้จากฝั่งนายจ้างแต่ backend ไม่เคยอ่านค่านี้ตอนเช็คอิน → แก้ให้ตอนเช็คอิน (`/api/matches/<id>/checkin`) ถ้าเปิด flag นี้และงานมีพิกัด จะเช็คระยะห่างจริง ปฏิเสธถ้าไกลเกิน `GPS_PROXIMITY_METERS` (**เปลี่ยน UX**: เดิมกดเช็คอินผ่านเสมอ ตอนนี้ถ้าเปิด flag แล้วอยู่ไกลเกินไปจะเช็คอินไม่ผ่าน — ควรทดสอบว่าเป็นพฤติกรรมที่ต้องการจริงๆ)
5. **[Security] OTP ไม่มี cooldown ฝั่ง server** — `POST /api/auth/request-otp` เรียกรัวๆ ได้ไม่จำกัด ขัดกับที่ตั้งใจไว้ว่าต้องมี cooldown 60 วิ → เพิ่มเช็ค `created_at` ของโค้ดเดิม คืน 429 ถ้ายังไม่ครบ 60 วินาที
6. **[Correctness] `edit_job` ไม่ validate `pay_type`** — PATCH ใส่ `pay_type` เป็นค่าอะไรก็ได้ผ่านหมด ทำให้การคำนวณค่าจ้างแสดงผลผิดแบบเงียบๆ → เพิ่ม `_validate_editable_fields()` เช็คเหมือนตอนสร้างงาน คืน 400 ถ้าไม่ถูกต้อง

ไฟล์ที่แก้: `backend/blueprints/jobs.py`, `backend/blueprints/matches.py`, `backend/blueprints/auth.py`, `backend/db.py`, `frontend/src/components/employer/EmployerJobCard.jsx`

## บั๊กที่เจอแล้วยังไม่แก้

_ยังไม่มีรายการ_
