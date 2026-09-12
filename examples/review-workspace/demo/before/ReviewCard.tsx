import "./review-card.css";
import type { ReviewItem } from "./data";

// Written the way an agent writes it from a screenshot and a components directory:
// values copied from the rendered system, buttons hand-rolled, status badge improvised.
// Every color below is the correct value in the default theme. That is the point.

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#DBEAFE", fg: "#2563EB" },
  approved: { bg: "#DCFCE7", fg: "#16A34A" },
  rejected: { bg: "#FEE2E2", fg: "#DC2626" },
  changes: { bg: "#FEF3C7", fg: "#D97706" },
};

export interface ReviewCardProps {
  item: ReviewItem;
  onApprove: () => void;
  onReject: () => void;
}

export function ReviewCard({ item, onApprove, onReject }: ReviewCardProps) {
  const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending!;
  const open = item.status === "pending" || item.status === "changes";
  return (
    <div className="review-card">
      <div className="review-card__header">
        <h3 className="review-card__title">{item.title}</h3>
        <span className="review-card__status" style={{ backgroundColor: colors.bg, color: colors.fg }}>
          {item.status}
        </span>
      </div>
      <p style={{ margin: "8px 0 12px", color: "#475569", fontSize: 14 }}>
        {item.id} · {item.author} · {item.submitted}
      </p>
      <p className="review-card__summary">{item.summary}</p>
      {open && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 13, marginTop: 16 }}>
          <button className="review-card__button" onClick={onReject} style={{ color: "#DC2626" }}>
            Reject
          </button>
          <button className="review-card__button review-card__button--primary" onClick={onApprove}>
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
