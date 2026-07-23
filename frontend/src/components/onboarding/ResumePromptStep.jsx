export default function ResumePromptStep({ onNext }) {
  return (
    <div className="wizardScreen">
      <div className="wizardBody" style={{ paddingTop: 60 }}>
        <div className="resumePromptIcon">✅</div>
        <div className="resumePromptTitle">สมัครสมาชิกสำเร็จ</div>
        <p className="resumePromptText">
          เพิ่มข้อมูล Resume ของคุณให้สมบูรณ์เพื่อเพิ่มโอกาสได้ทำงานมากขึ้น
          ทางกีบหมู แมนเพาเวอร์จะประเมินความสามารถของผู้สมัครผ่าน Resume
        </p>
      </div>
      <div className="wizardFooter" style={{ flexDirection: "column" }}>
        <button type="button" className="btnPink" onClick={onNext}>สร้าง resume ตอนนี้</button>
        <button type="button" className="btnOutlinePink" onClick={onNext}>ไว้ภายหลัง</button>
      </div>
    </div>
  );
}
