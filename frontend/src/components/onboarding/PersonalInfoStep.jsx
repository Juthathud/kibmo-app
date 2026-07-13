import { useState } from "react";
import { patchProfile, uploadDocument, assetUrl } from "../../api";

export default function PersonalInfoStep({ phone, onNext, onSkip }) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("นาย");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState("ชาย");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const bmi = weight && height ? (Number(weight) / (Number(height) / 100) ** 2).toFixed(2) : "";

  async function handlePhoto(file) {
    if (!file) return;
    try {
      const { url } = await uploadDocument(phone, "profile_photo", file);
      setPhotoUrl(url);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await patchProfile(phone, {
        title_prefix: titlePrefix,
        first_name: firstName,
        last_name: lastName,
        nickname,
        gender,
        birth_date: birthDate,
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        is_disabled: disabled ? 1 : 0,
      });
      onNext();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wizardScreen">
      <div className="wizardHeader">
        <h2>แก้ไขข้อมูลส่วนตัว</h2>
        <button type="button" className="wizardSkipTop" onClick={onSkip}>ข้าม</button>
      </div>
      <div className="wizardBanner">กรอกข้อมูลครบ โอกาสได้งานมากยิ่งขึ้น รีบกรอกเลยวันนี้!</div>
      <div className="wizardBody">
        <p className="fieldRequired">เลือกรูปโปรไฟล์ *</p>
        <label className="photoPicker">
          {photoUrl ? <img src={assetUrl(photoUrl)} alt="โปรไฟล์" /> : <div className="photoPlaceholder">🧑</div>}
          <span className="photoCam">📷</span>
          <input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files[0])} />
        </label>
        <p className="empty" style={{ textAlign: "center" }}>
          ควรใช้รูปที่เห็นใบหน้าชัดเจน สุภาพ หน้าตรง เพื่อใช้ในการสมัครงาน
        </p>

        <div className="wizardSectionLabel">ข้อมูลส่วนตัว</div>

        <div className="textField">
          <label>คำนำหน้า *</label>
          <select value={titlePrefix} onChange={(e) => setTitlePrefix(e.target.value)}>
            <option>นาย</option>
            <option>นาง</option>
            <option>นางสาว</option>
          </select>
        </div>
        <div className="textField">
          <label>ชื่อจริง *</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="textField">
          <label>นามสกุล *</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <p className="empty">* โปรดระบุข้อมูลจริงตามบัตรประชาชนเนื่องจากมีผลต่อการคัดเลือกผู้ได้รับงาน</p>
        <div className="textField">
          <label>ชื่อเล่น *</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="textField">
          <label>เพศ *</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option>ชาย</option>
            <option>หญิง</option>
            <option>ไม่ระบุ</option>
          </select>
        </div>
        <div className="textField">
          <label>วันเดือนปีเกิด *</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="timeRow">
          <div className="textField">
            <label>น้ำหนัก (กิโลกรัม)</label>
            <input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="textField">
            <label>ส่วนสูง (เซนติเมตร)</label>
            <input type="number" min="0" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <p className="empty">หากกรอกข้อมูลน้ำหนัก ส่วนสูง จะเพิ่มโอกาสการได้งานประเภทงานขายมากขึ้น</p>
        <div className="textField">
          <label>ค่าดัชนีมวลกาย BMI</label>
          <input value={bmi} readOnly />
        </div>
        <label className="checkRow">
          บุคคลทุพพลภาพ ♿
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />
        </label>
        <p className="err">{err}</p>
      </div>
      <div className="wizardFooter">
        <button type="button" className="btnPink" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกและถัดไป"}
        </button>
      </div>
    </div>
  );
}
