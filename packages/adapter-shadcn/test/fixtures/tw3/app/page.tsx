import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <main className="p-6">
      <Button variant="outline" size="sm">Fine</Button>
      <Button variant="primary">Wrong variant name</Button>
      <button className={cn(buttonVariants({ variant: "ghost" }))}>Raw button via variants</button>
      <p className="text-slate-500 mt-4">Palette color where muted-foreground exists</p>
      <div className="rounded-2xl p-3.5">extend keeps rounded-2xl and the default spacing scale</div>
    </main>
  )
}
