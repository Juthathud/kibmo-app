import { useState } from "react";
import { patchProfile } from "../../api";

const DAYS = [
  ["mon", "จันทร์"], ["tue", "อังคาร"], ["wed", "พุธ"],
  ["thu", "พฤหัสบดี"], ["fri", "ศุกร์"], ["sat", "เสาร์"], ["sun", "อาทิตย์"],
];

export default function AvailabilityStep({ phone, onNext, onSkip }) {
  const [jobTypes, setJobTypes] = useState([]);
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [anytime, setAnytime] = useState(false);
  const [days, setDays] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function toggle(list, setList, key) {
    setList(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, {
        job_types: jobTypes,
        rate_min: rateMin ? Number(rateMin) : null,
        rate_max: rateMax ? Number(rateMax) : null,
        avail_time_from: anytime ? "" : timeFrom,
        avail_time_to: anytime ? "" : timeTo,
        avail_anytime: anytime ? 1 : 0,
        avail_days: days,
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
        <h2>วันและเวลาที่สะดวกรับงาน</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <div className="wizardSectionLabel">
          รูปแบบงานที่สะดวกรับงาน <span className="req">*</span>
          <span className="selectAll" onClick={() => setJobTypes(["full_time", "part_time"])}>เลือกทั้งหมด</span>
        </div>
        <label className="checkRow">
          งานประจำ
          <input type="checkbox" checked={jobTypes.includes("full_time")} onChange={() => toggle(jobTypes, setJobTypes, "full_time")} />
        </label>
        <label className="checkRow">
          งานพาร์ทไทม์
          <input type="checkbox" checked={jobTypes.includes("part_time")} onChange={() => toggle(jobTypes, setJobTypes, "part_time")} />
        </label>

        <div className="wizardSectionLabel">รายได้ที่คาดหวัง (บาท/วัน) <span className="req">*</span></div>
        <div className="timeRow">
          <div className="textField">
            <label>ตั้งแต่</label>
            <input type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
          </div>
          <div className="textField">
            <label>ถึง</label>
            <input type="number" min="0" value={rateMax} onChange={(e) => setRateMax(e.target.value)} />
          </div>
        </div>

        <div className="wizardSectionLabel">เวลาสะดวกรับงาน <span className="req">*</span></div>
        <div className="timeRow">
          <div className="textField">
            <label>ช่วงเวลาที่สะดวก (จาก)</label>
            <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} disabled={anytime} />
          </div>
          <div className="textField">
            <label>ถึง</label>
            <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} disabled={anytime} />
          </div>
        </div>
        <label className="checkRow">
          สะดวกทุกช่วงเวลา
          <input type="checkbox" checked={anytime} onChange={(e) => setAnytime(e.target.checked)} />
        </label>

        <div className="wizardSectionLabel">
          วันที่สะดวกรับงาน <span className="req">*</span>
          <span className="selectAll" onClick={() => setDays(DAYS.map((d) => d[0]))}>เลือกทั้งหมด</span>
        </div>
        {DAYS.map(([key, label]) => (
          <label className="checkRow" key={key}>
            {label}
            <input type="checkbox" checked={days.includes(key)} onChange={() => toggle(days, setDays, key)} />
          </label>
        ))}
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </div>
    </div>
  );
}
