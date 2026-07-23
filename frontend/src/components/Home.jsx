import { useState } from "react";
import EmployerHome from "./employer/EmployerHome";
import WorkerHome from "./worker/WorkerHome";

export default function Home({ user, onLogout }) {
  const [tab, setTab] = useState("employer");

  if (user.role === "employer") {
    return <EmployerHome user={user} onLogout={onLogout} />;
  }
  if (user.role === "worker") {
    return <WorkerHome user={user} onLogout={onLogout} />;
  }

  // role === "both": same account acts as both employer and worker —
  // switch between the two dashboards with a tab instead of stacking them.
  return (
    <div>
      <div className="roleTabs">
        <button
          type="button"
          className={tab === "employer" ? "active" : ""}
          onClick={() => setTab("employer")}
        >
          นายจ้าง
        </button>
        <button
          type="button"
          className={tab === "worker" ? "active" : ""}
          onClick={() => setTab("worker")}
        >
          ลูกจ้าง
        </button>
      </div>
      {tab === "employer" ? (
        <EmployerHome user={user} onLogout={onLogout} />
      ) : (
        <WorkerHome user={user} onLogout={onLogout} />
      )}
    </div>
  );
}
