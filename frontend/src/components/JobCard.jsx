const STATUS_LABEL = {
  open: "เปิดรับสมัคร",
  staffed: "คนครบแล้ว",
  in_progress: "กำลังทำงาน",
  completed: "จบงานแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

function rateLabel(job) {
  return job.pay_type === "lump_sum" ? `เหมา ${job.rate} บาท` : `${job.rate} บาท/วัน`;
}

export default function JobCard({ job, actions }) {
  return (
    <div className="jobCard">
      <div className="jobCardTop">
        <span className="jobCardCategory">
          {job.job_type === "procurement" ? "🛒 จัดซื้ออุปกรณ์ตามสั่ง" : job.category}
        </span>
        <span className={`jobStatusBadge jobStatus-${job.status}`}>{STATUS_LABEL[job.status]}</span>
      </div>
      {job.matches_interest && <span className="jobMatchTag">ตรงกับที่คุณสนใจ</span>}
      <div className="jobCardMeta">
        {rateLabel(job)} · {job.headcount} คน · รวม {job.amount} บาท
      </div>
      <div className="jobCardMeta">📍 {job.location} · นัด {job.job_date}</div>
      {job.job_type === "procurement" && (
        <div className="jobCardMeta">🧾 {job.item_list} · งบ {job.budget} บาท</div>
      )}
      {actions}
    </div>
  );
}
