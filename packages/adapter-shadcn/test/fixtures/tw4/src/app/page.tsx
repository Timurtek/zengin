import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

export default function Page() {
  return (
    <main className="p-6">
      <Button size="icon" variant="ghost">x</Button>
      <Switch checked onCheckedChange={() => {}} />
      <span className="text-[#ff0000]">literal</span>
    </main>
  )
}
