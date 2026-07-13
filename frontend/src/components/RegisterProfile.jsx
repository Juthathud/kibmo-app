import { useState } from "react";
import { api } from "../api";
import AuthBrand from "./AuthBrand";

export default function RegisterProfile({ phone, onDone, onBack }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("worker");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const result = await api("POST", "/api/auth/register", { phone, name, role });
      onDone(result.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authScreen">
      <AuthBrand />
      <form className="authCard" onSubmit={submit}>
        <button type="button" className="authBackBtn" onClick={onBack}>← กลับ</button>
        <h2>สร้างโปรไฟล์</h2>
        <label className="fieldLabel">
          สถานะ
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="employer">นายจ้าง</option>
            <option value="worker">ลูกจ้าง</option>
          </select>
        </label>
        <label className="fieldLabel">
          ชื่อ
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" className="btnPink" disabled={loading}>
          {loading ? "กำลังบันทึก..." : "เริ่มใช้งาน"}
        </button>
        <p className="err">{err}</p>
      </form>
    </div>
  );
}
