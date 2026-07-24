import { useEffect, useState } from "react";
import { adminApi } from "../../adminApi";

function rateLabel(m) {
  return m.pay_type === "lump_sum" ? `เหมา ${m.rate} บาท` : `${m.rate} บาท/วัน`;
}

function MatchRow({ m, onChanged, onUnauthorized }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const canMarkPaid = m.job_status === "completed" && !m.paid;

  async function markPaid() {
    setBusy(true);
    setErr("");
    try {
      await adminApi("POST", `/api/admin/matches/${m.match_id}/mark-paid`);
      onChanged();
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="workerRow">
        <div className="workerAvatar">{(m.worker_name || "?")[0]}</div>
        <div className="workerRowInfo">
          <div className="workerRowName">{m.category} · {m.job_date}</div>
          <div className="workerRowContact">
            ลูกจ้าง: {m.worker_name} ({m.worker_phone}) · นายจ้าง: {m.employer_name} ({m.employer_phone})
          </div>
          <div className="workerRowContact">{rateLabel(m)} · รวม {m.amount.toLocaleString()} บาท</div>
          <div className="workerRowBadges">
            <span className={`miniBadge ${m.paid ? "paid" : "unpaid"}`}>
              {m.paid ? "จ่ายเงินแล้ว" : "ยังไม่จ่ายเงิน"}
            </span>
            <span className="miniBadge">{m.job_status}</span>
            {!!m.no_show && <span className="miniBadge unpaid">ไม่มาตามนัด</span>}
          </div>
        </div>
        <div className="workerRowActions">
          {canMarkPaid && (
            <button type="button" className="primary" disabled={busy} onClick={markPaid}>
              จ่ายเงินแล้ว
            </button>
          )}
        </div>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function AdminPayments({ onUnauthorized }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [paid, setPaid] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (paid) params.set("paid", paid);
      const qs = params.toString();
      const { matches } = await adminApi("GET", `/api/admin/matches${qs ? `?${qs}` : ""}`);
      setMatches(matches);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  return (
    <div className="employerJobsSection">
      <h3>การจ่ายเงินทั้งหมด</h3>
      <div className="filterBar">
        <select value={paid} onChange={(e) => setPaid(e.target.value)}>
          <option value="">ทั้งหมด</option>
          <option value="0">ยังไม่จ่าย</option>
          <option value="1">จ่ายแล้ว</option>
        </select>
      </div>
      {loading && <p className="empty">กำลังโหลด...</p>}
      {err && <p className="err">{err}</p>}
      {!loading && !err && matches.length === 0 && <p className="empty">ไม่พบรายการ</p>}
      {matches.map((m) => (
        <MatchRow key={m.match_id} m={m} onChanged={load} onUnauthorized={onUnauthorized} />
      ))}
    </div>
  );
}
