import { Button } from "@zengin/ui";

export function Hero() {
  return (
    <section className="grid gap-6 p-8">
      {/* zengin-allow color-literal: hero gradient, approved in brand review 2026-09 */}
      <div className="h-64 bg-[linear-gradient(135deg,#3B82F6,#9333EA)]" />
      {/* zengin-allow color-literal */}
      <p className="text-[#64748B]">Reason-less suppressions do not suppress.</p>
      <Button tone="primary" size="lg" className="mt-4 self-start" onClick={() => {}}>
        Get started
      </Button>
      <Button varient="soft">Learn more</Button>
    </section>
  );
}
