export default function Feed({ onGoLogin }) {
  return (
    <div className="authScreen">
      <div className="authCard" style={{ textAlign: "center" }}>
        <h2>📰 ประกาศงาน</h2>
        <p className="empty">หน้าฟีดยังไม่ได้สร้าง — จะทำในขั้นถัดไป</p>
        <button type="button" className="btnPink" onClick={onGoLogin}>เข้าสู่ระบบ</button>
      </div>
    </div>
  );
}
