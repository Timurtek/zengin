export function ApproveBar({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 bg-[#3B82F6] px-[13px] py-2 text-white">
      <span>{count} items selected</span>
      <button style={{ backgroundColor: "#2563EB" }}>Approve all</button>
    </div>
  );
}
