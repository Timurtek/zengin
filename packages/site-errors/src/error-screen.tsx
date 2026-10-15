import { Button, EmptyState, Icon } from "@zenginui/ui";
import { createRoot } from "react-dom/client";
import "./site-errors.css";

/**
 * When an error takes the page down, puts the error screen where the page was. React removes the whole tree
 * on an error nothing caught, and the reader is left with a blank page and no way on; an error that leaves
 * the page standing changes nothing here. Watching from outside the app is what lets the site keep its source
 * free of this package: that source is also the marketing template, and a template ships to other people.
 */
export function showErrorScreenOnCrash({ home, container = "root" }: { home: string; container?: string }): void {
  const check = () => {
    const el = document.getElementById(container);
    if (!el || el.childElementCount > 0) return;
    // The crashed root still owns the container, so the screen gets an element of its own inside it.
    const host = document.createElement("div");
    el.append(host);
    createRoot(host).render(<ErrorScreen home={home} />);
  };
  // After React has finished taking the tree down, which it does before the error reaches the window.
  window.addEventListener("error", () => setTimeout(check, 0));
}

/** What happened, and the two things that fix it: load the page again, or start from somewhere that works. */
export function ErrorScreen({ home }: { home: string }) {
  return (
    <main className="site-error">
      <EmptyState
        role="alert"
        tone="danger"
        icon={<Icon.Warning />}
        title="This page stopped working"
        description="Something on it failed while it was loading. Reload to try again. If it happens again, go to the start and take another way in."
        action={
          <div className="site-error__actions">
            <Button leadingIcon={<Icon.Refresh />} onClick={() => window.location.reload()}>
              Reload the page
            </Button>
            <Button asChild variant="soft" leadingIcon={<Icon.Home />}>
              <a href={home}>Go to the start</a>
            </Button>
          </div>
        }
      />
    </main>
  );
}

/** A link that leads nowhere: say so, and offer the two places most readers were looking for. */
export function NotFoundScreen() {
  return (
    <main className="site-error">
      <EmptyState
        icon={<Icon.Search />}
        title="There is no page at this address"
        description="The link may be old, or the address may have a typo. The home page and the docs are both a click away."
        action={
          <div className="site-error__actions">
            <Button asChild leadingIcon={<Icon.Home />}>
              <a href="/">Go to the home page</a>
            </Button>
            <Button asChild variant="soft">
              <a href="/docs/">Read the docs</a>
            </Button>
          </div>
        }
      />
    </main>
  );
}
