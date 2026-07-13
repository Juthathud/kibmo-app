import { useEffect, useState } from "react";
import { api } from "../../api";
import JobPostForm from "./JobPostForm";
import JobCard from "../JobCard";

export default function EmployerHome({ user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadJobs() {
    setLoading(true);
    const { jobs } = await api("GET", `/api/employers/${user.id}/jobs`);
    setJobs(jobs);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="employerScreen">
      <div className="employerTopBar">
        <div>
          <div className="employerName">{user.name}</div>
          <div className="employerRoleTag">นายจ้าง</div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      <JobPostForm employerId={user.id} onPosted={loadJobs} />

      <div className="employerJobsSection">
        <h3>งานของฉัน</h3>
        {loading && <p className="empty">กำลังโหลด...</p>}
        {!loading && jobs.length === 0 && <p className="empty">ยังไม่มีงานที่โพสต์</p>}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
