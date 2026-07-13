import EmployerHome from "./employer/EmployerHome";
import WorkerHome from "./worker/WorkerHome";

export default function Home({ user, onLogout }) {
  if (user.role === "employer") {
    return <EmployerHome user={user} onLogout={onLogout} />;
  }

  return <WorkerHome user={user} onLogout={onLogout} />;
}
