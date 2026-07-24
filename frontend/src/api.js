const API_BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "kibmoo_token";

let authToken = localStorage.getItem(TOKEN_KEY) || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra) {
  const headers = { ...extra };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

export async function api(method, url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export function patchProfile(fields) {
  return api("POST", "/api/profile/update", { fields });
}

export async function uploadDocument(docType, file) {
  const fd = new FormData();
  fd.append("doc_type", docType);
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/profile/upload-document`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
  return data;
}

export async function ocrIdCard(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/profile/ocr-id-card`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "อ่านข้อมูลจากบัตรไม่สำเร็จ");
  return data;
}

// uploaded-file URLs come back from the API as paths relative to the
// backend origin (e.g. "/uploads/x.jpg") — in prod the frontend is a
// separate static site, so they need the same API_BASE prefix to load.
export function assetUrl(path) {
  return path && !path.startsWith("http") ? `${API_BASE}${path}` : path;
}
