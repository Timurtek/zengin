import { Badge, Button, Checkbox, Dialog, TextField, Tooltip } from "@zenginui/ui";
import { useMemo, useState } from "react";
import { ITEMS, type ReviewItem, type ReviewStatus } from "./data";
import { ReviewCard } from "./ReviewCard";

export function App() {
  const [items, setItems] = useState<ReviewItem[]>(ITEMS);
  const [query, setQuery] = useState("");
  const [showResolved, setShowResolved] = useState(true);
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const visible = useMemo(
    () =>
      items.filter((i) => {
        if (!showResolved && (i.status === "approved" || i.status === "rejected")) return false;
        const q = query.trim().toLowerCase();
        return !q || i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
      }),
    [items, query, showResolved],
  );

  const setStatus = (id: string, status: ReviewStatus) => setItems((all) => all.map((i) => (i.id === id ? { ...i, status } : i)));
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <Tooltip.Provider>
      <div className="app" data-theme={theme}>
        <header className="app__header">
          <div className="app__title">
            <h1>Review queue</h1>
            <Badge tone={pending ? "primary" : "success"}>{pending ? `${pending} pending` : "All clear"}</Badge>
          </div>
          <div className="app__tools">
            <TextField label="Filter" placeholder="Title, author or id" value={query} onChange={(e) => setQuery(e.target.value)} size="sm" />
            <Checkbox label="Show resolved" checked={showResolved} onCheckedChange={(v) => setShowResolved(v === true)} />
            <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
              <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">
                {theme === "light" ? "Dark" : "Light"}
              </Button>
            </Tooltip>
          </div>
        </header>

        <main className="app__queue" aria-label="Review items">
          {/* A filtered list says how many it found, so one result reads as the answer rather than as a gap. */}
          <p className="app__count" role="status">
            {visible.length} {visible.length === 1 ? "item" : "items"}
            {query.trim() ? ` matching “${query.trim()}”` : ""}
          </p>
          {visible.map((item) => (
            <ReviewCard key={item.id} item={item} onApprove={() => setStatus(item.id, "approved")} onReject={() => setRejecting(item)} />
          ))}
          {visible.length === 0 && <p className="app__empty">Nothing matches. Clear the filter or show resolved items.</p>}
        </main>

        <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)} size="sm">
          <Dialog.Content>
            <Dialog.Title>Reject {rejecting?.id}?</Dialog.Title>
            <Dialog.Description>{rejecting?.author} will be notified and the item returns to their queue.</Dialog.Description>
            <Dialog.Footer>
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button
                tone="danger"
                onClick={() => {
                  if (rejecting) setStatus(rejecting.id, "rejected");
                  setRejecting(null);
                }}
              >
                Reject
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      </div>
    </Tooltip.Provider>
  );
}
