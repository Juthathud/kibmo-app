import { useState } from "react";
import { adminApi, setAdminToken } from "../../adminApi";
import AuthBrand from "../AuthBrand";

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token, admin } = await adminApi("POST", "/api/admin/login", { username, password });
      setAdminToken(token);
      onLoggedIn(admin);
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
        <h2>เข้าสู่ระบบผู้ดูแลระบบ</h2>
        <div className="textField">
          <label>ชื่อผู้ใช้</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="textField">
          <label>รหัสผ่าน</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btnPink" disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <p className="err">{err}</p>
      </form>
    </div>
  );
}
