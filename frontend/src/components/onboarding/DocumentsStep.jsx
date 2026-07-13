import { useState } from "react";
import { patchProfile, uploadDocument, assetUrl } from "../../api";

export default function DocumentsStep({ phone, onComplete, onSkip }) {
  const [idCardUrl, setIdCardUrl] = useState("");
  const [bankUrl, setBankUrl] = useState("");
  const [err, setErr] = useState("");
  const [finishing, setFinishing] = useState(false);

  async function handleUpload(docType, file, setUrl) {
    if (!file) return;
    setErr("");
    try {
      const { url } = await uploadDocument(phone, docType, file);
      setUrl(url);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function finish() {
    setFinishing(true);
    setErr("");
    try {
      await patchProfile(phone, { onboarding_complete: 1 });
      onComplete();
    } catch (e) {
      setErr(e.message);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="wizardScreen">
      <div className="wizardHeader">
        <h2>เอกสารสำหรับสมัครงาน</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBody">
        <p className="empty">
          เอกสารเพื่อยืนยันตัวตนผู้สมัครและรับงานกับทางกีบหมูรายวันโดยตรง
          ข้อมูลนี้จะเป็นความลับ ไม่ถูกเผยแพร่ให้กับบริษัทอื่น
        </p>

        <h3>บัตรประชาชน</h3>
        <label className={`uploadBox ${idCardUrl ? "done" : ""}`}>
          {idCardUrl ? <img src={assetUrl(idCardUrl)} alt="บัตรประชาชน" /> : null}
          {idCardUrl ? "เปลี่ยนรูปบัตรประชาชน" : "+ เพิ่มบัตรประชาชน"}
          <input type="file" accept="image/*" onChange={(e) => handleUpload("id_card", e.target.files[0], setIdCardUrl)} />
        </label>

        <h3>บัญชีธนาคาร</h3>
        <label className={`uploadBox ${bankUrl ? "done" : ""}`}>
          {bankUrl ? <img src={assetUrl(bankUrl)} alt="บัญชีธนาคาร" /> : null}
          {bankUrl ? "เปลี่ยนรูปบัญชีธนาคาร" : "+ เพิ่มบัญชีธนาคาร"}
          <input type="file" accept="image/*" onChange={(e) => handleUpload("bank_account", e.target.files[0], setBankUrl)} />
        </label>
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={finish} disabled={finishing}>
          {finishing ? "กำลังบันทึก..." : "เสร็จสิ้น"}
        </button>
      </div>
    </div>
  );
}
