import { useEffect, useState } from "react";
import { api } from "../../api";
import JobPostForm from "./JobPostForm";
import EmployerJobCard from "./EmployerJobCard";

export default function EmployerHome({ user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  async function loadJobs() {
    setLoading(true);
    const { jobs } = await api("GET", `/api/employers/${user.id}/jobs`);
    setJobs(jobs);
    setLoading(false);
  }

  async function loadSummary() {
    const data = await api("GET", `/api/employers/${user.id}/spending-summary`);
    setSummary(data);
  }

  useEffect(() => {
    loadJobs();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="employerScreen">
      <div className="employerTopBar">
        <div>
          <div className="employerAvatar">{user.name?.[0] || "?"}</div>
          <div>
            <div className="employerName">{user.name}</div>
            <div className="employerRoleTag">นายจ้าง</div>
          </div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      {summary && (
        <div className="employerCard">
          <h3>สรุปยอดใช้จ่าย</h3>
          <div className="summaryStats">
            <div className="summaryStat">
              <div className="summaryStatNum">{summary.total_spent.toLocaleString()}</div>
              <div className="summaryStatLbl">บาท ใช้จ่ายไปแล้ว</div>
            </div>
            <div className="summaryStat">
              <div className="summaryStatNum">{summary.jobs_completed}</div>
              <div className="summaryStatLbl">งานที่จบแล้ว</div>
            </div>
            <div className="summaryStat">
              <div className="summaryStatNum">{summary.workers_hired}</div>
              <div className="summaryStatLbl">ลูกจ้างที่เคยจ้าง</div>
            </div>
          </div>
        </div>
      )}

      <JobPostForm employerId={user.id} onPosted={() => { loadJobs(); loadSummary(); }} />

      <div className="employerJobsSection">
        <h3>งานของฉัน</h3>
        {loading && <p className="empty">กำลังโหลด...</p>}
        {!loading && jobs.length === 0 && <p className="empty">ยังไม่มีงานที่โพสต์</p>}
        {jobs.map((job) => (
          <EmployerJobCard
            key={job.id}
            job={job}
            employerId={user.id}
            onChanged={() => { loadJobs(); loadSummary(); }}
          />
        ))}
      </div>
    </div>
  );
}
