"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  return (
    <div data-slot="sidebar" data-side={side} data-variant={variant} data-collapsible={collapsible} className={cn("bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col", className)} {...props}>
      {children}
    </div>
  )
}

// A sub-part with its own variants. Must not lend them to Sidebar.
const sidebarMenuButtonVariants = cva("peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm", {
  variants: {
    variant: {
      default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      outline: "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))]",
    },
    size: {
      default: "h-8 text-sm",
      sm: "h-7 text-xs",
      lg: "h-12 text-sm",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

function SidebarMenuButton({ className, variant = "default", size = "default", ...props }: React.ComponentProps<"button"> & VariantProps<typeof sidebarMenuButtonVariants>) {
  return <button data-slot="sidebar-menu-button" className={cn(sidebarMenuButtonVariants({ variant, size }), className)} {...props} />
}

export { Sidebar, SidebarMenuButton, sidebarMenuButtonVariants }
