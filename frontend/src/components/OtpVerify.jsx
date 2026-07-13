import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import AuthBrand from "./AuthBrand";

export default function OtpVerify({ phone, refCode, ttlSeconds, devOtp, onVerified, onResend, onBack }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [err, setErr] = useState("");
  const [seconds, setSeconds] = useState(ttlSeconds);
  const [checking, setChecking] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    setSeconds(ttlSeconds);
  }, [ttlSeconds, refCode]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds > 0]);

  useEffect(() => {
    const code = digits.join("");
    if (code.length === 6 && !checking) verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function setDigit(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function verify(code) {
    setErr("");
    setChecking(true);
    try {
      const result = await api("POST", "/api/auth/verify-otp", { phone, otp: code });
      onVerified(result.user);
    } catch (e) {
      setErr(e.message);
      setDigits(Array(6).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setChecking(false);
    }
  }

  const mm = String(Math.floor(Math.max(seconds, 0) / 60)).padStart(2, "0");
  const ss = String(Math.max(seconds, 0) % 60).padStart(2, "0");

  return (
    <div className="authScreen">
      <AuthBrand />
      <div className="authCard">
        <button type="button" className="authBackBtn" onClick={onBack}>← กลับ</button>
        <h2>ยืนยัน OTP</h2>
        <p className="otpHint">
          รหัส OTP 6 หลักจะได้รับทาง SMS เบอร์ <b>{phone}</b><br />
          ให้กรอกในช่อง OTP เพื่อใช้ตรวจสอบและยืนยัน
        </p>
        <div className="otpRef">REF: {refCode}</div>
        <div className="otpBoxes">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              className={d ? "filled" : ""}
              value={d}
              maxLength={1}
              inputMode="numeric"
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>
        <p className="err">{err}</p>

        {seconds > 0 ? (
          <p className="otpResend">ขอรหัสอีกครั้งในอีก {mm}:{ss}</p>
        ) : (
          <button type="button" className="otpResendBtn" onClick={onResend}>ขอรหัสใหม่</button>
        )}

        {devOtp && (
          <p className="devHint">โหมดทดสอบ (ยังไม่ต่อ SMS จริง) — รหัส OTP คือ <b>{devOtp}</b></p>
        )}
      </div>
    </div>
  );
}
