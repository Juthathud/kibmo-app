import { useEffect, useState } from "react";
import { api } from "../api";
import JobCard from "./JobCard";

export default function Feed({ onGoLogin }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { jobs } = await api("GET", "/api/jobs");
        setJobs(jobs);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="employerScreen">
      <div className="employerTopBar">
        <div>
          <div className="employerAvatar">🐷</div>
          <div>
            <div className="employerName">กีบหมู แมนเพาเวอร์</div>
            <div className="employerRoleTag">ประกาศงานทั้งหมด</div>
          </div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onGoLogin}>เข้าสู่ระบบ</button>
      </div>

      <div className="employerJobsSection">
        {loading && <p className="empty">กำลังโหลด...</p>}
        {err && <p className="err">{err}</p>}
        {!loading && !err && jobs.length === 0 && <p className="empty">ยังไม่มีงานเปิดรับสมัครตอนนี้</p>}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
