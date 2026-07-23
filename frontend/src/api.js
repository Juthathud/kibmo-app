const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function api(method, url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export function patchProfile(phone, fields) {
  return api("POST", "/api/profile/update", { phone, fields });
}

export async function uploadDocument(phone, docType, file) {
  const fd = new FormData();
  fd.append("phone", phone);
  fd.append("doc_type", docType);
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/profile/upload-document`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
  return data;
}

export async function ocrIdCard(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/profile/ocr-id-card`, { method: "POST", body: fd });
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
