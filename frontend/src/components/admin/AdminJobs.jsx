import { useEffect, useState } from "react";
import { adminApi } from "../../adminApi";
import JobCard from "../JobCard";

// Mirrors STATUS_TRANSITIONS in backend/blueprints/jobs.py -- admin can
// force any valid next status, not just the single "next step" an employer
// gets (see EmployerJobCard.jsx's NEXT_STATUS), since admin overrides exist
// specifically to unstick jobs an employer can't/won't move forward.
const NEXT_STATUSES = {
  open: [["in_progress", "เริ่มงาน"], ["cancelled", "ยกเลิก"]],
  staffed: [["in_progress", "เริ่มงาน"], ["cancelled", "ยกเลิก"]],
  in_progress: [["completed", "จบงาน"]],
  completed: [],
  cancelled: [],
};

function JobActions({ job, onChanged, onUnauthorized }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function setStatus(status) {
    setBusy(true);
    setErr("");
    try {
      await adminApi("POST", `/api/admin/jobs/${job.id}/status`, { status });
      onChanged();
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="employerJobDetail">
      <div className="workerRowContact">นายจ้าง: {job.employer_name} · 📞 {job.employer_phone}</div>
      <div className="jobCardActions" style={{ marginTop: 8 }}>
        {NEXT_STATUSES[job.status].map(([status, label]) => (
          <button
            key={status}
            type="button"
            className="btnOutlineDark small"
            disabled={busy}
            onClick={() => setStatus(status)}
          >
            {label} (แอดมิน)
          </button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function AdminJobs({ onUnauthorized }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (location) params.set("location", location);
      const qs = params.toString();
      const { jobs } = await adminApi("GET", `/api/admin/jobs${qs ? `?${qs}` : ""}`);
      setJobs(jobs);
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
  }, [status, location]);

  return (
    <div className="employerJobsSection">
      <h3>งานทั้งหมด</h3>
      <div className="filterBar">
        <div className="searchBox">
          🔍
          <input placeholder="ค้นหาสถานที่" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="open">เปิดรับสมัคร</option>
          <option value="staffed">คนครบแล้ว</option>
          <option value="in_progress">กำลังทำงาน</option>
          <option value="completed">จบงานแล้ว</option>
          <option value="cancelled">ยกเลิกแล้ว</option>
        </select>
      </div>
      {loading && <p className="empty">กำลังโหลด...</p>}
      {err && <p className="err">{err}</p>}
      {!loading && !err && jobs.length === 0 && <p className="empty">ไม่พบงาน</p>}
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          actions={<JobActions job={job} onChanged={load} onUnauthorized={onUnauthorized} />}
        />
      ))}
    </div>
  );
}
