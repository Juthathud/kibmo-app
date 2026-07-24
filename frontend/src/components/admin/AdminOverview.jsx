import { useEffect, useState } from "react";
import { adminApi } from "../../adminApi";

const TILES = [
  { key: "total_users", label: "ผู้ใช้ทั้งหมด" },
  { key: "total_employers", label: "นายจ้าง" },
  { key: "total_workers", label: "ลูกจ้าง" },
  { key: "total_jobs", label: "งานทั้งหมด" },
  { key: "open_jobs", label: "งานเปิดรับสมัคร" },
  { key: "completed_jobs", label: "งานที่จบแล้ว" },
  { key: "total_matches", label: "การจับคู่ที่รับแล้ว" },
  { key: "total_no_shows", label: "แจ้งไม่มาตามนัด" },
];

export default function AdminOverview({ onUnauthorized }) {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi("GET", "/api/admin/stats")
      .then(setStats)
      .catch((e) => {
        if (e.status === 401) onUnauthorized();
        else setErr(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <p className="err">{err}</p>;
  if (!stats) return <p className="empty">กำลังโหลด...</p>;

  return (
    <div className="employerCard">
      <h3>ภาพรวมทั้งระบบ</h3>
      <div className="summaryStats">
        {TILES.map((t) => (
          <div className="summaryStat" key={t.key}>
            <div className="summaryStatNum">{stats[t.key].toLocaleString()}</div>
            <div className="summaryStatLbl">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="summaryStats" style={{ marginTop: 12 }}>
        <div className="summaryStat">
          <div className="summaryStatNum">{stats.paid_amount.toLocaleString()}</div>
          <div className="summaryStatLbl">บาท จ่ายแล้ว</div>
        </div>
        <div className="summaryStat">
          <div className="summaryStatNum">{stats.unpaid_amount.toLocaleString()}</div>
          <div className="summaryStatLbl">บาท ยังไม่จ่าย (งานจบแล้ว)</div>
        </div>
      </div>
    </div>
  );
}
