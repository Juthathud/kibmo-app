import { useState } from "react";
import { patchProfile } from "../../api";

const CATEGORIES = [
  { label: "งานก่อสร้าง", subs: [] },
];

const MAX_SELECTED = 3;

export default function CategoriesStep({ phone, onNext, onSkip }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const q = search.trim();
  const filtered = q
    ? CATEGORIES.map((c) => ({
        ...c,
        subs: c.subs.filter((s) => s.includes(q)),
      })).filter((c) => c.label.includes(q) || c.subs.length > 0)
    : CATEGORIES;

  function toggle(item) {
    if (selected.includes(item)) {
      setSelected(selected.filter((c) => c !== item));
    } else if (selected.length < MAX_SELECTED) {
      setSelected([...selected, item]);
    }
  }

  function toggleExpand(label) {
    setExpanded((e) => (e.includes(label) ? e.filter((x) => x !== label) : [...e, label]));
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, { interested_categories: selected });
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
        <h2>ประเภทและตำแหน่งงานที่สนใจ</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <div className="searchBox">
          🔍
          <input placeholder="ค้นหาประเภทงาน..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="empty">เลือกได้สูงสุด {MAX_SELECTED} ประเภท ({selected.length}/{MAX_SELECTED})</p>

        {filtered.map((cat) => {
          const hasSubs = cat.subs.length > 0;
          const isOpen = expanded.includes(cat.label) || (q && hasSubs);
          return (
            <div key={cat.label} className="categoryGroup">
              <label className="checkRow">
                <span onClick={(e) => { if (hasSubs) { e.preventDefault(); toggleExpand(cat.label); } }} style={{ flex: 1 }}>
                  {cat.label} {hasSubs && <span className="chev">{isOpen ? "▲" : "▼"}</span>}
                </span>
                <input
                  type="checkbox"
                  checked={selected.includes(cat.label)}
                  disabled={!selected.includes(cat.label) && selected.length >= MAX_SELECTED}
                  onChange={() => toggle(cat.label)}
                />
              </label>
              {hasSubs && isOpen && (
                <div className="categorySubs">
                  {cat.subs.map((sub) => (
                    <label className="checkRow" key={sub}>
                      {sub}
                      <input
                        type="checkbox"
                        checked={selected.includes(sub)}
                        disabled={!selected.includes(sub) && selected.length >= MAX_SELECTED}
                        onChange={() => toggle(sub)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "ถัดไป"}
        </button>
      </div>
    </div>
  );
}
