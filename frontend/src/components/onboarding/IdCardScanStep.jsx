import { useState } from "react";
import { ocrIdCard } from "../../api";

export default function IdCardScanStep({ onNext, onSkip, onExtracted }) {
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setErr("");
    try {
      const { fields } = await ocrIdCard(file);
      onExtracted(fields);
      onNext();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizardScreen">
      <div className="wizardHeader">
        <h2>ถ่ายรูปบัตรประชาชน</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <p className="empty" style={{ textAlign: "center" }}>
          ถ่ายรูปบัตรประชาชนของคุณ ระบบจะอ่านชื่อ วันเกิด และที่อยู่ให้อัตโนมัติ
          กรุณาตรวจสอบความถูกต้องอีกครั้งในขั้นตอนถัดไป
        </p>
        <label className={`uploadBox ${preview ? "done" : ""}`}>
          {preview ? <img src={preview} alt="บัตรประชาชน" /> : null}
          {loading ? "กำลังอ่านข้อมูล..." : preview ? "ถ่ายใหม่" : "+ ถ่ายรูปบัตรประชาชน"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={loading}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </label>
        <p className="err">{err}</p>
      </div>
    </div>
  );
}
