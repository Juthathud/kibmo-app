import { useEffect, useState } from "react";
import { api } from "../../api";
import JobCard from "../JobCard";
import RatingStars from "../RatingStars";

function AcceptedJobActions({ job, workerId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(false);
  const [err, setErr] = useState("");

  const canCheckin = ["staffed", "in_progress"].includes(job.status) && !job.checked_in;

  async function checkin() {
    if (!navigator.geolocation) {
      setErr("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setBusy(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api("POST", `/api/matches/${job.match_id}/checkin`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            worker_id: workerId,
          });
          onChanged();
        } catch (e) {
          setErr(e.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setErr("ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง");
        setBusy(false);
      }
    );
  }

  async function submitRating(value) {
    setBusy(true);
    setErr("");
    try {
      await api("POST", `/api/matches/${job.match_id}/rate`, { rater: "worker", rating: value, worker_id: workerId });
      setRating(false);
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="workerRowBadges">
        {!!job.checked_in && (
          <span className={`miniBadge ${job.location_verified ? "checkedIn" : "notVerified"}`}>
            {job.location_verified ? "✓ เช็คอินแล้ว (ยืนยันตำแหน่งแล้ว)" : "✓ เช็คอินแล้ว"}
          </span>
        )}
        {job.status === "completed" && (
          <span className={`miniBadge ${job.paid ? "paid" : "unpaid"}`}>
            {job.paid ? "ได้รับเงินแล้ว" : "ยังไม่ได้รับเงิน"}
          </span>
        )}
        {job.rating_by_worker && <span className="miniBadge rating">ให้คะแนนแล้ว {job.rating_by_worker} ★</span>}
      </div>

      {canCheckin && (
        <button type="button" className="btnPink small" disabled={busy} onClick={checkin} style={{ marginTop: 8 }}>
          {busy ? "กำลังเช็คอิน..." : "📍 เช็คอินถึงสถานที่งาน"}
        </button>
      )}

      {job.status === "completed" && !job.rating_by_worker && (
        <div style={{ marginTop: 8 }}>
          {!rating ? (
            <button type="button" className="btnOutlinePink small" onClick={() => setRating(true)}>
              ให้คะแนนนายจ้าง
            </button>
          ) : (
            <RatingStars onSubmit={submitRating} submitting={busy} />
          )}
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function WorkerHome({ user, onLogout }) {
  const [available, setAvailable] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    const qs = params.toString();
    const data = await api("GET", `/api/workers/${user.id}/jobs${qs ? `?${qs}` : ""}`);
    setAvailable(data.available);
    setAccepted(data.accepted);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, location]);

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
          <div className="employerAvatar">{user.name?.[0] || "?"}</div>
          <div>
            <div className="employerName">{user.name}</div>
            <div className="employerRoleTag">ลูกจ้าง</div>
          </div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      <p className="err">{err}</p>

      <div className="employerJobsSection">
        <h3>งานที่รับแล้ว</h3>
        {loading && <p className="empty">กำลังโหลด...</p>}
        {!loading && accepted.length === 0 && <p className="empty">ยังไม่มีงานที่รับ</p>}
        {accepted.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            actions={<AcceptedJobActions job={job} workerId={user.id} onChanged={load} />}
          />
        ))}
      </div>

      <div className="employerJobsSection">
        <h3>งานที่เปิดรับสมัคร</h3>
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
        {!loading && available.length === 0 && <p className="empty">ไม่พบงานที่ตรงกับเงื่อนไข</p>}
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
