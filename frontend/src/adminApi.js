// Separate from api.js's regular-user auth on purpose (see admin_auth.py's
// module docstring on the backend) -- a different token key so an admin
// session can never mix with a regular user session in the same browser.
const API_BASE = import.meta.env.VITE_API_BASE || "";
const ADMIN_TOKEN_KEY = "kibmoo_admin_token";

let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || null;

export function setAdminToken(token) {
  adminToken = token;
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken() {
  return !!adminToken;
}

export async function adminApi(method, url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "เกิดข้อผิดพลาด");
    err.status = res.status;
    throw err;
  }
  return data;
}
