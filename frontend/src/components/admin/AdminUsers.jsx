import { useEffect, useState } from "react";
import { adminApi } from "../../adminApi";

const ROLE_LABEL = { employer: "นายจ้าง", worker: "ลูกจ้าง", both: "ทั้งสอง" };

function userName(u) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return full || u.name || "ไม่ระบุชื่อ";
}

function UserRow({ u, onChanged, onUnauthorized }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const banned = u.account_status === "banned";

  async function toggleBan() {
    if (!banned && !window.confirm(`ระงับการใช้งานบัญชีของ ${userName(u)}?`)) return;
    setBusy(true);
    setErr("");
    try {
      await adminApi("POST", `/api/admin/users/${u.id}/${banned ? "unban" : "ban"}`);
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
        <div className="workerAvatar">{userName(u)[0]}</div>
        <div className="workerRowInfo">
          <div className="workerRowName">
            {userName(u)}
            {u.nickname ? ` (${u.nickname})` : ""}
          </div>
          <div className="workerRowContact">
            <a href={`tel:${u.phone}`}>📞 {u.phone}</a>
          </div>
          <div className="workerRowBadges">
            <span className="miniBadge">{ROLE_LABEL[u.role] || u.role || "ไม่ระบุบทบาท"}</span>
            <span className={`miniBadge ${banned ? "unpaid" : "paid"}`}>
              {banned ? "ระงับการใช้งาน" : "ใช้งานได้ปกติ"}
            </span>
            {u.rating_count > 0 && (
              <span className="miniBadge rating">{u.rating_avg.toFixed(1)} ★ ({u.rating_count})</span>
            )}
            {u.no_show_count > 0 && <span className="miniBadge unpaid">ไม่มาตามนัด {u.no_show_count} ครั้ง</span>}
          </div>
        </div>
        <div className="workerRowActions">
          <button type="button" disabled={busy} onClick={toggleBan}>
            {banned ? "ยกเลิกระงับ" : "ระงับบัญชี"}
          </button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function AdminUsers({ onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (role) params.set("role", role);
      const qs = params.toString();
      const { users } = await adminApi("GET", `/api/admin/users${qs ? `?${qs}` : ""}`);
      setUsers(users);
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
  }, [q, role]);

  return (
    <div className="employerJobsSection">
      <h3>ผู้ใช้ทั้งหมด</h3>
      <div className="filterBar">
        <div className="searchBox">
          🔍
          <input placeholder="ค้นหาชื่อ/เบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">ทุกบทบาท</option>
          <option value="employer">นายจ้าง</option>
          <option value="worker">ลูกจ้าง</option>
          <option value="both">ทั้งสอง</option>
        </select>
      </div>
      {loading && <p className="empty">กำลังโหลด...</p>}
      {err && <p className="err">{err}</p>}
      {!loading && !err && users.length === 0 && <p className="empty">ไม่พบผู้ใช้</p>}
      {users.map((u) => (
        <UserRow key={u.id} u={u} onChanged={load} onUnauthorized={onUnauthorized} />
      ))}
    </div>
  );
}
