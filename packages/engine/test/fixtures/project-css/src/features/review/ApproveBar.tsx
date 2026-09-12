import "./approve-bar.css";

export function ApproveBar({ count }: { count: number }) {
  return (
    <div className="approve-bar">
      <span>{count} items selected</span>
      <button className="approve-bar__button" style={{ backgroundColor: "#2563EB" }}>
        Approve all
      </button>
    </div>
  );
}
