import { useState } from "react";
import { patchProfile } from "../../api";

export default function AddressStep({ onNext, onSkip, prefill }) {
  const [form, setForm] = useState({
    postal_code: "",
    province: prefill?.province || "",
    district: prefill?.district || "",
    subdistrict: prefill?.subdistrict || "",
    address: prefill?.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(form);
      onNext();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wizardScreen">
      <div className="wizardHeader">
        <h2>ที่อยู่ปัจจุบัน</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <p className="empty">
          {prefill?.address ? "อ่านที่อยู่จากบัตรประชาชนให้แล้ว กรุณาตรวจสอบความถูกต้องก่อนไปต่อ" : "กรุณากรอกที่อยู่ปัจจุบัน"}
        </p>

        <div className="textField">
          <label>รหัสไปรษณีย์</label>
          <input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} inputMode="numeric" />
        </div>
        <div className="textField">
          <label>จังหวัด</label>
          <input value={form.province} onChange={(e) => set("province", e.target.value)} />
        </div>
        <div className="textField">
          <label>อำเภอ/เขต</label>
          <input value={form.district} onChange={(e) => set("district", e.target.value)} />
        </div>
        <div className="textField">
          <label>ตำบล/แขวง</label>
          <input value={form.subdistrict} onChange={(e) => set("subdistrict", e.target.value)} />
        </div>
        <div className="textField">
          <label>ที่อยู่</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
