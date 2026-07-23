import { useEffect, useState } from "react";
import { api, assetUrl } from "../../api";
import JobCard from "../JobCard";
import JobPostForm from "./JobPostForm";
import RatingStars from "../RatingStars";

// The next status an employer can advance a job to, plus the button label.
// Mirrors STATUS_TRANSITIONS on the backend (open/staffed -> in_progress -> completed).
const NEXT_STATUS = {
  open: { status: "in_progress", label: "เริ่มงาน" },
  staffed: { status: "in_progress", label: "เริ่มงาน" },
  in_progress: { status: "completed", label: "จบงาน" },
  completed: null,
  cancelled: null,
};

function workerName(w) {
  const full = [w.first_name, w.last_name].filter(Boolean).join(" ");
  return full || w.name || "ลูกจ้าง";
}

function CategoryLabel({ csv }) {
  const items = (csv || "").split(",").filter(Boolean);
  return items.length ? items.join(", ") : "ไม่ระบุ";
}

function WorkerProfile({ workerId }) {
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("GET", `/api/workers/${workerId}/profile`)
      .then((d) => setProfile(d.profile))
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  if (err) return <p className="err">{err}</p>;
  if (!profile) return <p className="empty">กำลังโหลด...</p>;

  return (
    <div className="workerProfileCard">
      เพศ: {profile.gender || "ไม่ระบุ"}
      <br />
      คะแนน: {profile.rating_count ? `${profile.rating_avg.toFixed(1)} ★ (${profile.rating_count} ครั้ง)` : "ยังไม่มีคะแนน"}
      <br />
      ประเภทงานที่สนใจ: <CategoryLabel csv={profile.interested_categories} />
      <br />
      พื้นที่ทำงาน: <CategoryLabel csv={profile.work_areas} />
    </div>
  );
}

function WorkerRow({ w, jobCompleted, employerId, onChanged }) {
  const [showProfile, setShowProfile] = useState(false);
  const [rating, setRating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function markPaid() {
    setBusy(true);
    setErr("");
    try {
      await api("POST", `/api/matches/${w.match_id}/mark-paid`, { employer_id: employerId });
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRating(value) {
    setBusy(true);
    setErr("");
    try {
      await api("POST", `/api/matches/${w.match_id}/rate`, { rater: "employer", rating: value, employer_id: employerId });
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
      <div className="workerRow">
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
          <div className="workerRowBadges">
            {w.checked_in ? (
              <span className={`miniBadge ${w.location_verified ? "checkedIn" : "notVerified"}`}>
                {w.location_verified ? "✓ เช็คอินแล้ว (ยืนยันตำแหน่งแล้ว)" : "✓ เช็คอินแล้ว"}
              </span>
            ) : null}
            {jobCompleted && (
              <span className={`miniBadge ${w.paid ? "paid" : "unpaid"}`}>
                {w.paid ? "จ่ายเงินแล้ว" : "ยังไม่จ่ายเงิน"}
              </span>
            )}
            {w.rating_by_employer && <span className="miniBadge rating">ให้คะแนนแล้ว {w.rating_by_employer} ★</span>}
          </div>
        </div>
        <div className="workerRowActions">
          <button type="button" onClick={() => setShowProfile((s) => !s)}>
            {showProfile ? "ซ่อนโปรไฟล์" : "ดูโปรไฟล์"}
          </button>
          {jobCompleted && !w.paid && (
            <button type="button" className="primary" disabled={busy} onClick={markPaid}>
              จ่ายเงินแล้ว
            </button>
          )}
          {jobCompleted && !w.rating_by_employer && (
            <button type="button" className="primary" onClick={() => setRating((s) => !s)}>
              ให้คะแนน
            </button>
          )}
        </div>
      </div>
      {showProfile && <WorkerProfile workerId={w.id} />}
      {rating && <RatingStars onSubmit={submitRating} submitting={busy} />}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function EmployerJobCard({ job, employerId, onChanged }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");

  async function loadWorkers() {
    setLoading(true);
    try {
      const data = await api("GET", `/api/jobs/${job.id}/workers?employer_id=${employerId}`);
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

  async function cancelJob() {
    setBusy(true);
    setErr("");
    try {
      await api("POST", `/api/jobs/${job.id}/status`, {
        employer_id: employerId,
        status: "cancelled",
      });
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <JobPostForm
        employerId={employerId}
        job={job}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
        onCancelEdit={() => setEditing(false)}
      />
    );
  }

  return (
    <JobCard
      job={job}
      actions={
        <div className="employerJobDetail">
          {job.status === "open" && (
            <div className="jobCardActions" style={{ marginBottom: 12 }}>
              <button type="button" className="btnOutlineDark small" onClick={() => setEditing(true)}>
                แก้ไขงาน
              </button>
              <button type="button" className="btnOutlineDark small" disabled={busy} onClick={cancelJob}>
                ยกเลิกงาน
              </button>
            </div>
          )}
          {job.status === "staffed" && (
            <div className="jobCardActions" style={{ marginBottom: 12 }}>
              <button type="button" className="btnOutlineDark small" disabled={busy} onClick={cancelJob}>
                ยกเลิกงาน
              </button>
            </div>
          )}

          {job.status !== "cancelled" && (
            <>
              <div className="workerListHead">
                ลูกจ้างที่รับงาน {workers.length}/{job.headcount} คน
              </div>

              {loading && <p className="empty">กำลังโหลด...</p>}
              {!loading && workers.length === 0 && (
                <p className="empty">ยังไม่มีลูกจ้างรับงานนี้</p>
              )}

              {workers.map((w) => (
                <WorkerRow
                  key={w.id}
                  w={w}
                  jobCompleted={job.status === "completed"}
                  employerId={employerId}
                  onChanged={() => {
                    loadWorkers();
                    onChanged();
                  }}
                />
              ))}
            </>
          )}

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
