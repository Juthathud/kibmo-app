import { useEffect, useState } from "react";
import "./App.css";
import { hasAdminToken, setAdminToken } from "./adminApi";
import AdminLogin from "./components/admin/AdminLogin";
import AdminDashboard from "./components/admin/AdminDashboard";

const STORAGE_KEY = "kibmoo_admin";

function loadStoredAdmin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const storedAdmin = loadStoredAdmin();
  // A token can exist without a stored admin (or vice versa) if storage was
  // cleared unevenly -- only treat the session as logged-in when both agree.
  const [admin, setAdmin] = useState(storedAdmin && hasAdminToken() ? storedAdmin : null);

  useEffect(() => {
    if (admin) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [admin]);

  function handleLoggedIn(adminInfo) {
    setAdmin(adminInfo);
  }

  function handleLogout() {
    setAdminToken(null);
    setAdmin(null);
  }

  // Any admin route returning 401 (expired/invalid session) should drop
  // back to the login screen -- passed down so tabs can call it on a
  // failed fetch instead of each tab reinventing this.
  function handleUnauthorized() {
    setAdminToken(null);
    setAdmin(null);
  }

  if (!admin) {
    return <AdminLogin onLoggedIn={handleLoggedIn} />;
  }
  return <AdminDashboard admin={admin} onLogout={handleLogout} onUnauthorized={handleUnauthorized} />;
}
