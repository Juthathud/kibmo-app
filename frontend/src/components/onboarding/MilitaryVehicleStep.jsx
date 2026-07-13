import { useState } from "react";
import { patchProfile } from "../../api";

const VEHICLES = [
  { key: "motorcycle", label: "🏍️ จักรยานยนต์" },
  { key: "car", label: "🚗 รถยนต์" },
  { key: "truck", label: "🚚 รถบรรทุก" },
];

const REFERRALS = [
  "Facebook", "App Store", "ChatGPT", "X (Twitter)", "Google", "Gemini",
  "Lemon8", "Instagram", "Play Store", "เพื่อน/คนรู้จัก", "Tiktok", "ช่องทางอื่นๆ",
];

export default function MilitaryVehicleStep({ phone, onNext, onSkip }) {
  const [militaryStatus, setMilitaryStatus] = useState("");
  const [hasVehicle, setHasVehicle] = useState(null);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [referral, setReferral] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function toggleVehicle(key) {
    setVehicleTypes((v) => (v.includes(key) ? v.filter((x) => x !== key) : [...v, key]));
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, {
        military_status: militaryStatus,
        has_vehicle: hasVehicle ? 1 : 0,
        vehicle_types: hasVehicle ? vehicleTypes : [],
        referral_source: referral,
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
        <h2>ข้อมูลเพิ่มเติม</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <div className="wizardSectionLabel">สถานะทางทหาร <span className="req">*</span></div>
        <label className="radioRow">
          ยังไม่ได้รับการเกณฑ์ทหาร
          <input type="radio" name="military" checked={militaryStatus === "not_yet"} onChange={() => setMilitaryStatus("not_yet")} />
        </label>
        <label className="radioRow">
          ได้รับการยกเว้น/ผ่านการเกณฑ์ทหารแล้ว
          <input type="radio" name="military" checked={militaryStatus === "exempted"} onChange={() => setMilitaryStatus("exempted")} />
        </label>

        <div className="wizardSectionLabel">พาหนะส่วนตัว (ถ้ามี ระบุได้มากกว่า 1) <span className="req">*</span></div>
        <label className="radioRow">
          มี
          <input type="radio" name="vehicle" checked={hasVehicle === true} onChange={() => setHasVehicle(true)} />
        </label>
        <label className="radioRow">
          ไม่มี
          <input type="radio" name="vehicle" checked={hasVehicle === false} onChange={() => { setHasVehicle(false); setVehicleTypes([]); }} />
        </label>
        {hasVehicle && (
          <div className="pillGrid">
            {VEHICLES.map((v) => (
              <div
                key={v.key}
                className={`pillCard ${vehicleTypes.includes(v.key) ? "selected" : ""}`}
                onClick={() => toggleVehicle(v.key)}
              >
                {v.label}
              </div>
            ))}
          </div>
        )}

        <div className="wizardSectionLabel">รู้จักกีบหมูรายวันครั้งแรกจากช่องทางไหน? <span className="req">*</span></div>
        <div className="pillGrid">
          {REFERRALS.map((r) => (
            <div
              key={r}
              className={`pillCard ${referral === r ? "selected" : ""}`}
              onClick={() => setReferral(r)}
            >
              {r}
            </div>
          ))}
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
