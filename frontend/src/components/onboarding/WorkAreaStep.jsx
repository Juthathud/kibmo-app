import { useState } from "react";
import { patchProfile } from "../../api";

// Simplified district list for the prototype (Nan province, matching the
// reference screens) — swap for a full Thailand province/district dataset
// before this goes further than a demo.
const DISTRICTS = [
  "ปัว", "ภูเพียง", "สองแคว", "สันติสุข", "เฉลิมพระเกียรติ",
  "เชียงกลาง", "เมืองน่าน", "เวียงสา", "แม่จริม",
];

export default function WorkAreaStep({ phone, onNext, onSkip }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filtered = DISTRICTS.filter((d) => d.includes(search));

  function toggle(d) {
    setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, { work_areas: selected });
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
        <h2>เลือกเขต/อำเภอ</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <div className="searchBox">
          🔍
          <input placeholder="เลือกเขต/อำเภอ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filtered.map((d) => (
          <label className="checkRow" key={d}>
            {d}
            <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
          </label>
        ))}
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
