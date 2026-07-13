import { useState } from "react";
import { api } from "../../api";

const CATEGORIES = [
  "รับจ้างจองคิว", "งานคลังสินค้า", "งานขาย", "งานอีเวนต์",
  "งานจัดเรียง/เติม/ตรวจสอบสินค้า", "งานร้านอาหาร/คาเฟ่", "งานบริการ",
  "งานธุรการ/เลขานุการ", "อื่นๆ",
];

const initialForm = {
  job_type: "labor",
  category: CATEGORIES[0],
  pay_type: "daily",
  rate: "",
  headcount: "",
  days: 1,
  location: "",
  job_date: "",
  gps_auto_checkin: false,
  item_list: "",
  budget: "",
};

export default function JobPostForm({ employerId, onPosted }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isProcurement = form.job_type === "procurement";

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api("POST", "/api/jobs", {
        employer_id: employerId,
        job_type: form.job_type,
        category: form.category,
        pay_type: form.pay_type,
        rate: Number(form.rate),
        headcount: Number(form.headcount),
        days: Number(form.days) || 1,
        location: form.location,
        job_date: form.job_date,
        gps_auto_checkin: form.gps_auto_checkin,
        item_list: isProcurement ? form.item_list : null,
        budget: isProcurement ? Number(form.budget) : null,
      });
      setForm(initialForm);
      onPosted();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="employerCard" onSubmit={submit}>
      <h3>โพสต์งานใหม่</h3>

      <div className="textField">
        <label>ลักษณะงาน</label>
        <select value={form.job_type} onChange={(e) => set("job_type", e.target.value)}>
          <option value="labor">จ้างแรงงานตามประเภทงาน</option>
          <option value="procurement">🛒 จัดซื้ออุปกรณ์ตามสั่ง</option>
        </select>
      </div>

      {!isProcurement && (
        <div className="textField">
          <label>ประเภทงาน</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {isProcurement && (
        <>
          <div className="textField">
            <label>รายการอุปกรณ์ที่ต้องซื้อ</label>
            <input value={form.item_list} onChange={(e) => set("item_list", e.target.value)} placeholder="เช่น สีทาบ้าน 5 ถัง, แปรงทาสี 10 อัน" />
          </div>
          <div className="textField">
            <label>งบประมาณค่าอุปกรณ์ (บาท)</label>
            <input type="number" min="1" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
          </div>
        </>
      )}

      <div className="textField">
        <label>ประเภทค่าจ้าง</label>
        <select value={form.pay_type} onChange={(e) => set("pay_type", e.target.value)}>
          <option value="daily">รายวัน (คิดตามจำนวนวัน)</option>
          <option value="lump_sum">เหมา (ราคาเดียวทั้งงาน)</option>
        </select>
      </div>

      <div className="textField">
        <label>{form.pay_type === "lump_sum" ? "ราคาเหมา (บาท)" : "เรตค่าจ้าง (บาท/วัน)"}</label>
        <input type="number" min="1" required value={form.rate} onChange={(e) => set("rate", e.target.value)} />
      </div>

      <div className="timeRow">
        <div className="textField">
          <label>จำนวนคน</label>
          <input type="number" min="1" required value={form.headcount} onChange={(e) => set("headcount", e.target.value)} />
        </div>
        <div className="textField">
          <label>จำนวนวัน</label>
          <input type="number" min="1" required value={form.days} onChange={(e) => set("days", e.target.value)} />
        </div>
      </div>

      <div className="textField">
        <label>สถานที่นัด</label>
        <input required value={form.location} onChange={(e) => set("location", e.target.value)} />
      </div>

      <div className="textField">
        <label>วันที่นัด</label>
        <input type="date" required value={form.job_date} onChange={(e) => set("job_date", e.target.value)} />
      </div>

      <label className="checkRow">
        เช็คอินอัตโนมัติเมื่อ GPS นายจ้าง-ลูกจ้างพบกัน
        <input type="checkbox" checked={form.gps_auto_checkin} onChange={(e) => set("gps_auto_checkin", e.target.checked)} />
      </label>

      <p className="err">{err}</p>
      <button type="submit" className="btnPink" disabled={saving}>
        {saving ? "กำลังโพสต์..." : "โพสต์งาน"}
      </button>
    </form>
  );
}
