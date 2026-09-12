import { Button } from "@zengin/ui";

export function Actions({ pending }: { pending: number }) {
  return (
    <div style={{ display: "flex", gap: "14px" }}>
      <Button variant="ghost-danger">Reject</Button>
      <Button varient="soft">Later</Button>
      <button style={{ background: "#2563EB", color: "#FFFFFF", padding: "8px 14px", borderRadius: "6px" }}>Approve</button>
      <span style={{ color: "#475569" }}>{pending} pending</span>
    </div>
  );
}
