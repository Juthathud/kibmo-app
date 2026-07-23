import { useState } from "react";

export default function RatingStars({ onSubmit, submitting }) {
  const [value, setValue] = useState(0);

  return (
    <div>
      <div className="ratingStars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= value ? "filled" : ""}
            onClick={() => setValue(n)}
            aria-label={`${n} ดาว`}
          >
            ★
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btnPink small"
        disabled={!value || submitting}
        onClick={() => onSubmit(value)}
      >
        {submitting ? "กำลังส่ง..." : "ส่งคะแนน"}
      </button>
    </div>
  );
}
