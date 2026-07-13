import { useState } from "react";
import { patchProfile } from "../../api";

export default function ContactInfoStep({ phone, onNext, onSkip }) {
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [visibleOnResume, setVisibleOnResume] = useState(true);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("บิดา");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, {
        email,
        line_id: lineId,
        phone_visible_on_resume: visibleOnResume ? 1 : 0,
        emergency_name: emergencyName,
        emergency_phone: emergencyPhone,
        emergency_relation: emergencyRelation,
      });
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
        <h2>ข้อมูลติดต่อ</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <div className="textField">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="textField">
          <label>Line ID</label>
          <input value={lineId} onChange={(e) => setLineId(e.target.value)} />
        </div>

        <div className="textField">
          <label>เบอร์โทรศัพท์</label>
          <input value={phone} readOnly />
        </div>
        <label className="checkRow">
          ยินยอมให้เปิดเผยเบอร์โทรศัพท์บน Resume
          <input type="checkbox" checked={visibleOnResume} onChange={(e) => setVisibleOnResume(e.target.checked)} />
        </label>

        <div className="wizardSectionLabel">ผู้ติดต่อฉุกเฉิน <span className="req">*</span></div>
        <div className="textField">
          <label>ชื่อผู้ติดต่อฉุกเฉิน</label>
          <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
        </div>
        <div className="textField">
          <label>เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉิน</label>
          <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} inputMode="tel" />
        </div>
        <div className="textField">
          <label>ความสัมพันธ์</label>
          <select value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)}>
            <option>บิดา</option>
            <option>มารดา</option>
            <option>คู่สมรส</option>
            <option>พี่น้อง</option>
            <option>เพื่อน</option>
            <option>อื่นๆ</option>
          </select>
        </div>
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกและถัดไป"}
        </button>
      </div>
    </div>
  );
}
