import * as React from "react"

export function useToast() {
  const [toasts, setToasts] = React.useState<string[]>([])
  return { toasts, toast: (t: string) => setToasts((all) => [...all, t]) }
}
