import { Badge, Button, Card } from "@zengin/ui";
import type { ReviewItem, ReviewStatus } from "./data";

const STATUS: Record<ReviewStatus, { label: string; tone: "primary" | "success" | "danger" | "warning" }> = {
  pending: { label: "Pending", tone: "primary" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  changes: { label: "Needs changes", tone: "warning" },
};

export interface ReviewCardProps {
  item: ReviewItem;
  onApprove: () => void;
  onReject: () => void;
}

export function ReviewCard({ item, onApprove, onReject }: ReviewCardProps) {
  const status = STATUS[item.status];
  const open = item.status === "pending" || item.status === "changes";
  return (
    <Card variant="outlined" padding="md">
      <Card.Header>
        <h3 className="review-card__title">{item.title}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card.Header>
      <Card.Body>
        <div className="review-card__meta">
          <span>{item.id}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{item.author}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{item.submitted}</span>
        </div>
        <p className="review-card__summary">{item.summary}</p>
      </Card.Body>
      {open && (
        <Card.Footer>
          <Button variant="ghost" tone="danger" size="sm" onClick={onReject}>
            Reject
          </Button>
          <Button tone="primary" size="sm" onClick={onApprove}>
            Approve
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}
