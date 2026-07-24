# กีบหมู แมนเพาเวอร์ — บั๊กที่พบ

ไฟล์นี้เก็บบั๊กที่เจอในโปรเจกต์ (จาก code review, bug hunt, หรือ user report) แยกเป็นที่แก้แล้วกับยังไม่แก้ ย้ายรายการระหว่างสองหมวดเมื่อสถานะเปลี่ยน

## บั๊กที่แก้แล้ว

### เช็คอิน GPS ที่ยืนยันแล้วถูกลดระดับกลับเป็นไม่ยืนยันได้ (2026-07-24)
`backend/blueprints/matches.py` — `checkin()` ไม่มี guard กันการประมวลผลซ้ำ: ถ้าลูกจ้างเช็คอินสำเร็จ (`location_verified=1`) แล้วมีการเรียก `POST /api/matches/<id>/checkin` ซ้ำอีกครั้งจากตำแหน่งที่ไกลเกิน `GPS_PROXIMITY_METERS` (เช่น เรียกซ้ำโดยไม่ตั้งใจ หรือเรียกตรงผ่าน API) ค่า `location_verified` จะถูกเขียนทับกลับเป็น 0 ทั้งที่เช็คอินไปแล้ว
**แก้:** เพิ่มเงื่อนไขต้นฟังก์ชัน — ถ้า `match["checked_in"]` เป็น 1 อยู่แล้ว ให้ return สถานะเดิมทันทีโดยไม่ประมวลผล/เขียนทับซ้ำ (idempotent)

### เริ่มงานได้ทั้งที่ยังไม่มีลูกจ้างรับงานเลย (2026-07-24)
`backend/blueprints/jobs.py` — `STATUS_TRANSITIONS` อนุญาตให้ `open` → `in_progress` โดยตรง (ข้าม `staffed`) และ `update_job_status()` ไม่เคยตรวจว่ามีลูกจ้างที่ `accepted` อย่างน้อย 1 คนก่อนเปลี่ยนสถานะ ทำให้นายจ้างกด "เริ่มงาน" แล้ว "จบงาน" บนงานที่ไม่มีคนรับได้ ขัดกับ comment ของโค้ดเองที่บอกว่า "not skip steps"
**แก้:** เพิ่มการตรวจจำนวน `matches` ที่ `status='accepted'` ก่อนอนุญาตเปลี่ยนสถานะเป็น `in_progress` — ถ้าเป็น 0 ให้ตอบ 400 `"ยังไม่มีลูกจ้างรับงานนี้"` (ยังอนุญาตเริ่มงานได้ตามปกติถ้ามีคนรับอย่างน้อย 1 คน แม้ยังไม่ครบ headcount)

### กด "ข้าม" ในขั้นตอนสุดท้ายของ onboarding แล้วสถานะไม่ถูกบันทึกที่ backend (2026-07-24)
`frontend/src/components/onboarding/OnboardingWizard.jsx` — ปุ่ม "ข้าม" ด้านบนของทุกขั้นตอนผูกกับ `onSkip={next}` ซึ่งในขั้นตอนสุดท้าย (`DocumentsStep`) จะเรียก `onComplete()` ตรงๆ โดยไม่เคยเรียก `patchProfile(phone, {onboarding_complete: 1})` เหมือนปุ่ม "เสร็จสิ้น" (ที่เรียกผ่าน `finish()`) ทำให้ backend ยังเห็น `onboarding_complete=0` และลูกจ้างถูกส่งกลับไปทำ onboarding ใหม่ทุกครั้งที่ login ทั้งที่ session ปัจจุบันแสดงหน้า Home ไปแล้ว — ยืนยันด้วยการเดิน flow จริงผ่านเบราว์เซอร์ (สมัครสมาชิกใหม่ กด "ข้าม" ทุกขั้นจนถึงขั้นสุดท้าย) พบว่า `POST /api/profile/update` ไม่เคยถูกเรียก และตรวจ `data.db` ยืนยัน `onboarding_complete=0`
**แก้:** ย้าย logic การ persist มาไว้ที่ `next()` ของ wizard เอง (จุดเดียวที่การันตีว่าทำงานทุกครั้งที่ wizard จบ ไม่ว่าจะมาจากปุ่มไหน) — เรียก `patchProfile` ก่อน `onComplete()` เสมอเมื่อ step ถึงตัวสุดท้าย ยืนยันแล้วว่า `POST /api/profile/update` ถูกเรียกและ `data.db` มี `onboarding_complete=1` จริง

### การ rebuild ตาราง jobs ทำ FK ของ employer_id หายไป (2026-07-24)
`backend/db.py` — `_JOBS_REBUILD_DDL` (ใช้ตอนขยาย CHECK constraint ของ `jobs.status` ให้รองรับ `cancelled`) ไม่มี `REFERENCES users(id)` บนคอลัมน์ `employer_id` ต่างจาก `SCHEMA` เดิมที่มี ทำให้ทุก install ที่รันผ่านการ rebuild นี้ (`_ensure_job_status_allows_cancelled`) เสีย FK constraint ไปเงียบๆ
**แก้:** เติม `REFERENCES users(id)` กลับเข้าไปใน DDL — มีผลกับ install ใหม่หรือ DB ที่ยังไม่เคย rebuild เท่านั้น (DB ที่ rebuild ไปแล้วจะไม่ trigger rebuild ซ้ำเพราะเงื่อนไข `_table_needs_rebuild` เช็คจาก CHECK marker/DEFAULT ไม่ได้เช็ค FK) ผลกระทบต่ำเพราะโค้ดแอปตรวจสอบ employer มีอยู่จริงก่อน insert อยู่แล้ว และไม่มีจุดไหน delete user

### ทั้งแอปไม่มีการยืนยันตัวตนฝั่ง server เลย — ทุก endpoint เชื่อ id ที่ client ส่งมาเฉยๆ (พบ 2026-07-24, แก้ 2026-07-24)
ไม่มี session/token ใดๆ ในระบบ — ทุก endpoint ที่ควรจำกัดสิทธิ์ (เช่น "เฉพาะนายจ้างเจ้าของงาน") แค่เทียบ `employer_id`/`worker_id` ที่ client ใส่มาใน body/query กับข้อมูลใน DB โดยไม่มีการพิสูจน์ตัวตนจริงเลย ตัวอย่างที่กระทบชัดเจน:
- `GET /api/jobs/<job_id>/workers` เช็คว่า `employer_id` (query param ที่ client กำหนดเอง) ตรงกับ `job.employer_id` — แต่ `GET /api/jobs` (public) คืน `employer_id` ของทุกงานเปิดอยู่แล้ว ใครก็ดึงเบอร์โทร/LINE ID ของลูกจ้างที่ถูกรับเข้างานได้โดยไม่ต้อง login
- `POST /api/matches/<id>/rate`, `mark-paid`, `checkin` ไม่ตรวจ identity ของผู้เรียกเลย ยิง request ตรงไปที่ `match_id` (เดาง่าย) แล้วให้คะแนนปลอม/สั่งจ่ายเงินปลอม (ส่ง SMS จริง)/ปลอม GPS checkin ให้ match ไหนก็ได้
- `GET /api/employers/<employer_id>/jobs` ไม่มีการตรวจสิทธิ์เลยแม้แต่แบบ self-report — ดูประวัติงานทั้งหมดของนายจ้างคนไหนก็ได้แค่เดา id
- `POST /api/profile/update`, `upload-document` เชื่อ `phone` ที่ client ส่งมาเป็นตัวระบุตัวตน — ใครก็แก้โปรไฟล์/อัปโหลดเอกสารแทนคนอื่นได้ถ้ารู้เบอร์โทร

**แก้:** เพิ่ม bearer-token auth layer แบบเรียบง่าย ตรงกับ pattern เดิมของโปรเจกต์ (ไม่มี session table แยก ไม่มี expiry/refresh — เกินความจำเป็นสำหรับสเกลนี้):
- `users.auth_token` (คอลัมน์ใหม่) เก็บ token ที่สุ่มด้วย `secrets.token_hex(32)` ออกให้ตอน `verify_otp()` สำเร็จทุกครั้ง (login ใหม่ = token เก่าใช้ไม่ได้ — 1 session ที่ active ต่อบัญชี)
- `helpers.current_user(conn)` อ่าน header `Authorization: Bearer <token>` แล้ว lookup user จริงจาก DB แทนการเชื่อ id ที่ client ส่งมา
- ทุก endpoint ที่กระทบ (`create_job`, `edit_job`, `update_job_status`, `employer_jobs`, `worker_jobs`, `job_workers`, `respond_to_job`, `checkin`, `rate_match` — คำนวณ `rater` จากตัวตนผู้เรียกเองแทนที่จะเชื่อ field `rater` จาก client, `mark_paid`, `update_profile`, `upload_document`, `complete_profile`) เปลี่ยนมาใช้ `current_user()` แทนค่าที่ client ส่งมา
- Frontend (`api.js`) แนบ header อัตโนมัติทุก request จาก `token` ที่เก็บใน `localStorage`; token ถูก persist ทันทีตั้งแต่ `verify-otp` สำเร็จ (ก่อนเช็ค `profile_complete` ด้วยซ้ำ) เพื่อให้ endpoint `/api/auth/register` เรียกแบบมี auth ได้ตั้งแต่ต้น
- ยืนยันผ่านเบราว์เซอร์จริงครบ flow (login, สมัครสมาชิกใหม่, โพสต์งาน, รับงาน, เช็คอิน, mark-paid, ให้คะแนน) ยังทำงานถูกต้องเหมือนเดิม และยืนยันว่า request ที่ไม่มี token / token ปลอม / token ของคนอื่นถูกปฏิเสธด้วย 401/403 ตามที่ควร (ทดสอบ raw fetch ตรงๆ กับ `employer_jobs`, `job_workers`, `mark-paid`, `checkin`)
