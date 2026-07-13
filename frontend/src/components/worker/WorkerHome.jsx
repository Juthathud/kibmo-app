import { useEffect, useState } from "react";
import { api } from "../../api";
import JobCard from "../JobCard";

export default function WorkerHome({ user, onLogout }) {
  const [available, setAvailable] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const data = await api("GET", `/api/workers/${user.id}/jobs`);
    setAvailable(data.available);
    setAccepted(data.accepted);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(jobId, status) {
    setBusyId(jobId);
    setErr("");
    try {
      await api("POST", "/api/matches", { worker_id: user.id, job_id: jobId, status });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="employerScreen">
      <div className="employerTopBar">
        <div>
          <div className="employerName">{user.name}</div>
          <div className="employerRoleTag">ลูกจ้าง</div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      <p className="err">{err}</p>

      <div className="employerJobsSection">
        <h3>งานที่รับแล้ว</h3>
        {loading && <p className="empty">กำลังโหลด...</p>}
        {!loading && accepted.length === 0 && <p className="empty">ยังไม่มีงานที่รับ</p>}
        {accepted.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      <div className="employerJobsSection">
        <h3>งานที่เปิดรับสมัคร</h3>
        {!loading && available.length === 0 && <p className="empty">ยังไม่มีงานเปิดรับสมัครตอนนี้</p>}
        {available.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            actions={
              <div className="jobCardActions">
                <button
                  type="button"
                  className="btnPink small"
                  disabled={busyId === job.id}
                  onClick={() => respond(job.id, "accepted")}
                >
                  รับงาน
                </button>
                <button
                  type="button"
                  className="btnOutlineDark small"
                  disabled={busyId === job.id}
                  onClick={() => respond(job.id, "declined")}
                >
                  ไม่รับ
                </button>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
