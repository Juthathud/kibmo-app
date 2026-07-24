import { useState } from "react";
import AdminOverview from "./AdminOverview";
import AdminUsers from "./AdminUsers";
import AdminJobs from "./AdminJobs";
import AdminPayments from "./AdminPayments";

const TABS = [
  { key: "overview", label: "ภาพรวม" },
  { key: "users", label: "ผู้ใช้" },
  { key: "jobs", label: "งาน" },
  { key: "payments", label: "การจ่ายเงิน" },
];

export default function AdminDashboard({ admin, onLogout, onUnauthorized }) {
  const [tab, setTab] = useState("overview");

  return (
    <div className="employerScreen">
      <div className="employerTopBar">
        <div>
          <div className="employerAvatar">{admin.username[0].toUpperCase()}</div>
          <div>
            <div className="employerName">{admin.username}</div>
            <div className="employerRoleTag">ผู้ดูแลระบบ</div>
          </div>
        </div>
        <button type="button" className="btnOutlineDark small" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      <div className="roleTabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <AdminOverview onUnauthorized={onUnauthorized} />}
      {tab === "users" && <AdminUsers onUnauthorized={onUnauthorized} />}
      {tab === "jobs" && <AdminJobs onUnauthorized={onUnauthorized} />}
      {tab === "payments" && <AdminPayments onUnauthorized={onUnauthorized} />}
    </div>
  );
}
