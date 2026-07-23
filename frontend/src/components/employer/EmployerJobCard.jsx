import { useEffect, useState } from "react";
import { api, assetUrl } from "../../api";
import JobCard from "../JobCard";

// The next status an employer can advance a job to, plus the button label.
// Mirrors STATUS_TRANSITIONS on the backend (open/staffed -> in_progress -> completed).
const NEXT_STATUS = {
  open: { status: "in_progress", label: "เริ่มงาน" },
  staffed: { status: "in_progress", label: "เริ่มงาน" },
  in_progress: { status: "completed", label: "จบงาน" },
  completed: null,
};

function workerName(w) {
  const full = [w.first_name, w.last_name].filter(Boolean).join(" ");
  return full || w.name || "ลูกจ้าง";
}

export default function EmployerJobCard({ job, employerId, onChanged }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadWorkers() {
    setLoading(true);
    try {
      const data = await api("GET", `/api/jobs/${job.id}/workers`);
      setWorkers(data.workers);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status]);

  const next = NEXT_STATUS[job.status];

  async function advance() {
    if (!next) return;
    setBusy(true);
    setErr("");
    try {
      await api("POST", `/api/jobs/${job.id}/status`, {
        employer_id: employerId,
        status: next.status,
      });
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      job={job}
      actions={
        <div className="employerJobDetail">
          <div className="workerListHead">
            ลูกจ้างที่รับงาน {workers.length}/{job.headcount} คน
          </div>

          {loading && <p className="empty">กำลังโหลด...</p>}
          {!loading && workers.length === 0 && (
            <p className="empty">ยังไม่มีลูกจ้างรับงานนี้</p>
          )}

          {workers.map((w) => (
            <div key={w.id} className="workerRow">
              <div className="workerAvatar">
                {w.profile_photo_url ? (
                  <img src={assetUrl(w.profile_photo_url)} alt={workerName(w)} />
                ) : (
                  workerName(w)[0]
                )}
              </div>
              <div className="workerRowInfo">
                <div className="workerRowName">
                  {workerName(w)}
                  {w.nickname ? ` (${w.nickname})` : ""}
                </div>
                <div className="workerRowContact">
                  <a href={`tel:${w.phone}`}>📞 {w.phone}</a>
                  {w.line_id && <span> · LINE: {w.line_id}</span>}
                </div>
              </div>
            </div>
          ))}

          {err && <p className="err">{err}</p>}

          {next && (
            <button
              type="button"
              className="btnPink small"
              disabled={busy}
              onClick={advance}
            >
              {busy ? "กำลังบันทึก..." : next.label}
            </button>
          )}
        </div>
      }
    />
  );
}
