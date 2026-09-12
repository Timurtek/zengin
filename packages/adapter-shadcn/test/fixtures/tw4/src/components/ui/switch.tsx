"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn("peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={cn("bg-background pointer-events-none block size-4 rounded-full")} />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
