import { useEffect, useState } from "react";
import { api } from "../api";
import JobCard from "./JobCard";

export default function Feed({ onGoLogin }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (location) params.set("location", location);
        const qs = params.toString();
        const { jobs } = await api("GET", `/api/jobs${qs ? `?${qs}` : ""}`);
        setJobs(jobs);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category, location]);

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
        <div className="filterBar">
          <div className="searchBox">
            🔍
            <input
              placeholder="ค้นหาพื้นที่/สถานที่นัด"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <input
            className="filterCategoryInput"
            placeholder="ประเภทงาน"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        {loading && <p className="empty">กำลังโหลด...</p>}
        {err && <p className="err">{err}</p>}
        {!loading && !err && jobs.length === 0 && <p className="empty">ไม่พบงานที่ตรงกับเงื่อนไข</p>}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
