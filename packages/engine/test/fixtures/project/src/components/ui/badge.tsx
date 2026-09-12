/* zengin-owned Badge, forked from @zengin/ui@1.2.0 */
import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="rounded-full bg-primary px-2 py-1 text-on-primary">
      <span className="bg-[#EEEEEE]">{children}</span>
    </button>
  );
}
