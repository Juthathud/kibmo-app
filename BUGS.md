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

## บั๊กที่เจอแล้วยังไม่แก้

### ทั้งแอปไม่มีการยืนยันตัวตนฝั่ง server เลย — ทุก endpoint เชื่อ id ที่ client ส่งมาเฉยๆ (พบ 2026-07-24)
ไม่มี session/token ใดๆ ในระบบ — ทุก endpoint ที่ควรจำกัดสิทธิ์ (เช่น "เฉพาะนายจ้างเจ้าของงาน") แค่เทียบ `employer_id`/`worker_id` ที่ client ใส่มาใน body/query กับข้อมูลใน DB โดยไม่มีการพิสูจน์ตัวตนจริงเลย ตัวอย่างที่กระทบชัดเจน:
- `GET /api/jobs/<job_id>/workers` (`backend/blueprints/matches.py:49-80`) เช็คว่า `employer_id` (query param ที่ client กำหนดเอง) ตรงกับ `job.employer_id` — แต่ `GET /api/jobs` (public, ไม่ต้อง login) คืน `employer_id` ของทุกงานเปิดอยู่แล้ว ใครก็ตามที่ดึงรายการงานสาธารณะแล้วเดา/ใส่ `employer_id` ที่ถูกต้องกลับเข้ามาที่ endpoint นี้ จะเห็นเบอร์โทร/LINE ID ของลูกจ้างที่ถูกรับเข้างานได้โดยไม่ต้อง login เลย
- `POST /api/matches/<id>/rate`, `POST /api/matches/<id>/mark-paid`, `POST /api/matches/<id>/checkin` (`backend/blueprints/matches.py:235-314`, `185-232`) ไม่รับ/ตรวจ identity ของผู้เรียกเลย ใครก็ยิง request ตรงไปที่ `match_id` (เป็นเลขไล่ลำดับ เดาง่าย) แล้วให้คะแนนปลอม/สั่งจ่ายเงินปลอม (ส่ง SMS จริงไปหาลูกจ้างว่า "ได้รับเงินแล้ว")/ปลอม GPS checkin ให้ match ไหนก็ได้
- `GET /api/employers/<employer_id>/jobs` (`backend/blueprints/jobs.py:169-176`) ไม่มีการตรวจสิทธิ์เลยแม้แต่แบบ self-report — ใครก็ดูประวัติงานทั้งหมดของนายจ้างคนไหนก็ได้ (รวมงานที่ยกเลิก/จบแล้วที่ไม่โผล่ใน public feed) แค่เดา id

**หมายเหตุ:** นี่ไม่ใช่บั๊กจุดเดียวที่แพตช์แล้วจบ แต่เป็นปัญหาเชิงสถาปัตยกรรม (ต้องออกแบบ session/token layer) — ยังไม่แก้เพราะต้องตัดสินใจร่วมกับผู้ใช้ก่อนว่าจะใช้แนวทางไหน (cookie session, bearer token ตอน login, ฯลฯ) และการแก้จะกระทบทุก endpoint/ทุก API call ฝั่ง frontend
