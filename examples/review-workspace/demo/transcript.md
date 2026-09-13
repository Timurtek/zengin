# Zengin enforcement loop, replayed

## 1. The agent writes ReviewCard off-system

Every color below is the correct value in the default theme. A screenshot review passes.

```tsx
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
```

```css
.review-card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 16px;
}

.review-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-card__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.review-card__status {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
  text-transform: capitalize;
}

.review-card__summary {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.review-card__button {
  padding: 6px 13px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #0F172A;
  font-weight: 500;
  cursor: pointer;
}

.review-card__button--primary {
  background: #2563EB;
  color: #fff;
}

.review-card__button--primary:hover {
  background: #1D4ED8;
}
```

## 2. zengin check

```
$ zengin check
src/ReviewCard.tsx
  32:27  error  spacing-literal  Spacing literal in inline style (margin) where a token reference is required. 8px matches space.2 but will not follow scale changes.
         found  margin: "8px 0 12px"
         fix (exact)  "var(--spacing-2) 0 var(--spacing-3)"
  32:48  error  color-literal  Color literal in inline style (color) where a token reference is required. The value matches color.text-muted in the default theme but will not follow theme changes.
         found  "#475569"
         fix (exact)  "var(--color-text-muted)"
  37:73  error  spacing-literal  Arbitrary spacing value in inline style (gap). 13px is not on the spacing scale.
         found  gap: 13
         fix (nearest)  "var(--spacing-3)"
         note  space.3 = 12px, space.4 = 16px
  37:88  error  spacing-literal  Spacing literal in inline style (margin-top) where a token reference is required. 16px matches space.4 but will not follow scale changes.
         found  marginTop: 16
         fix (exact)  "var(--spacing-4)"
  38:11  error  component-substitution  Raw <button> styled as a system Button (background-color, border-radius, color, font, padding). Use Button from @zenginui/ui.
         found  <button className="review-card__button" onClick={onReject} style={{ color: "#DC2626" }}>
         fix (nearest)  <Button onClick={onReject}> Reject </Button>
         note  Express the removed styling through Button props. Add: import { Button } from "@zenginui/ui";
  38:86  error  color-literal  Color literal in inline style (color) where a token reference is required. The value matches color.danger in the default theme but will not follow theme changes.
         found  "#DC2626"
         fix (exact)  "var(--color-danger)"
  41:11  error  component-substitution  Raw <button> styled as a system Button (background-color, border-radius, color, font, padding). Use Button from @zenginui/ui.
         found  <button className="review-card__button review-card__button--primary" onClick={onApprove}>
         fix (nearest)  <Button onClick={onApprove}> Approve </Button>
         note  Express the removed styling through Button props. Add: import { Button } from "@zenginui/ui";

src/review-card.css
  2:15  error  color-literal  Color literal where a token reference is required. The value matches 6 tokens (color.surface, color.on-primary, color.on-danger, color.on-success, color.on-warning, color.on-neutral) in the default theme but will not follow theme changes.
         found  white
         fix (nearest)  var(--color-surface)
         note  Several tokens share this value. Pick by role: color.surface, color.on-primary, color.on-danger, color.on-success, color.on-warning, color.on-neutral.
  5:12  error  spacing-literal  Spacing literal where a token reference is required. 16px matches space.4 but will not follow scale changes.
         found  16px
         fix (exact)  var(--spacing-4)
  11:8  error  spacing-literal  Spacing literal where a token reference is required. 12px matches space.3 but will not follow scale changes.
         found  12px
         fix (exact)  var(--spacing-3)
  22:12  error  spacing-literal  Spacing literal where a token reference is required. 4px matches space.1 but will not follow scale changes.
         found  4px
         fix (exact)  var(--spacing-1)
  22:16  error  spacing-literal  Spacing literal where a token reference is required. 12px matches space.3 but will not follow scale changes.
         found  12px
         fix (exact)  var(--spacing-3)
  31:10  error  color-literal  Color literal where a token reference is required. The value matches color.text-muted in the default theme but will not follow theme changes.
         found  #475569
         fix (exact)  var(--color-text-muted)
  36:12  error  spacing-literal  Arbitrary spacing value. 6px is not on the spacing scale.
         found  6px
         fix (nearest)  var(--spacing-1)
         note  space.1 = 4px, space.2 = 8px
  36:16  error  spacing-literal  Arbitrary spacing value. 13px is not on the spacing scale.
         found  13px
         fix (nearest)  var(--spacing-3)
         note  space.3 = 12px, space.4 = 16px
  40:10  error  color-literal  Color literal where a token reference is required. The value matches 2 tokens (color.text, color.neutral.active) in the default theme but will not follow theme changes.
         found  #0F172A
         fix (nearest)  var(--color-text)
         note  Several tokens share this value. Pick by role: color.text, color.neutral.active.
  46:15  error  color-literal  Color literal where a token reference is required. The value matches color.primary in the default theme but will not follow theme changes.
         found  #2563EB
         fix (exact)  var(--color-primary)
  47:10  error  color-literal  Color literal where a token reference is required. The value matches 6 tokens (color.surface, color.on-primary, color.on-danger, color.on-success, color.on-warning, color.on-neutral) in the default theme but will not follow theme changes.
         found  #fff
         fix (nearest)  var(--color-surface)
         note  Several tokens share this value. Pick by role: color.surface, color.on-primary, color.on-danger, color.on-success, color.on-warning, color.on-neutral.
  51:15  error  color-literal  Color literal where a token reference is required. The value matches color.primary.hover in the default theme but will not follow theme changes.
         found  #1D4ED8
         fix (exact)  var(--color-primary-hover)

6 files checked against @zenginui/ui@0.0.1: 19 violations (19 error, 0 warn, 0 info): spacing-literal 9, color-literal 8, component-substitution 2
(exit 1)
```

19 violations: spacing-literal 9, color-literal 8, component-substitution 2.

## 3. The agent applies the fixes

Exact fixes verbatim. Nearest fixes by role. The raw buttons and the improvised status badge become the system's Button and Badge; the card becomes Card. The stylesheet goes away because the components own their appearance.

```tsx
import { Badge, Button, Card } from "@zenginui/ui";
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
```

## 4. zengin check

```
$ zengin check
5 files checked against @zenginui/ui@0.0.1: 0 violations (0 error, 0 warn, 0 info)
(exit 0)
```

Loop closed: violations found, corrected, none remaining.
