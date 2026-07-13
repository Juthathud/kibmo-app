import { useState } from "react";
import { api } from "../api";
import AuthBrand from "./AuthBrand";

export default function PhoneLogin({ onOtpSent, onBrowseFeed, onGoRegister }) {
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const result = await api("POST", "/api/auth/request-otp", { phone });
      onOtpSent(phone, result);
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
        <h2>เข้าสู่ระบบ</h2>
        <div className="phoneField">
          <span className="phonePrefix">TH +66</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="0xx-xxx-xxxx"
            inputMode="tel"
          />
        </div>
        <button type="submit" className="btnPink" disabled={loading}>
          {loading ? "กำลังส่งรหัส..." : "เข้าสู่ระบบ"}
        </button>
        <p className="err">{err}</p>

        <div className="authDivider"><span>หรือ</span></div>

        <button type="button" className="btnOutlinePink" onClick={onGoRegister}>
          สมัครสมาชิก
        </button>
        <button type="button" className="btnOutlineDark" onClick={onBrowseFeed}>
          ดูประกาศงานก่อน (ไม่เข้าสู่ระบบ)
        </button>
      </form>
    </div>
  );
}
