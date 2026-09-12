import { Button } from "@zengin/ui";

export function Actions({ pending }: { pending: number }) {
  return (
    <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
      <Button variant="ghost" tone="danger">Reject</Button>
      <Button variant="soft">Later</Button>
      <Button tone="primary">Approve</Button>
      <span style={{ color: "var(--color-text-muted)" }}>{pending} pending</span>
    </div>
  );
}
