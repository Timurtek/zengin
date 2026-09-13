import { Badge, Button, Card, Checkbox, TextField } from "@zenginui/ui";
import { REPO } from "../content";

/**
 * The page is its own evidence: every component here is @zenginui/ui in the brand this page defines through
 * tokens alone. The pair below renders the same components under both themes side by side.
 */
export function System() {
  return (
    <section className="section" id="system">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Reference system</span>
          <div className="section__head-text">
            <h2 className="title">Same foundations, two treatments</h2>
            <p className="lead">Zengin UI is the reference system the engine is built against: plain CSS, custom-property tokens, Radix for behavior. This page and a review workspace are built from the same components.</p>
          </div>
        </div>
        <div className="system">
          <div className="system__copy">
            <p>
              <strong>This page is a Zengin UI consumer.</strong> Its brand is one file of token overrides: the typefaces, the radii, and the colors. The components have no idea. The
              review workspace in the repository uses the same package with the default theme and looks like a tool, not a pitch.
            </p>
            <p>
              <strong>The engine checks this page.</strong> Layout CSS references tokens only, down to the drafting grid behind the hero, which is mixed from the border token. Zero
              violations, zero suppressions. The engine caught two literals of its author's while the page was built.
            </p>
            <p>
              <strong>The page drove the system.</strong> Building it added Tabs, a display typeface token, display text sizes and the larger spacing steps to Zengin UI, each with a
              manifest entry, a story and tests, because a marketing page needed them and the components did not have them.
            </p>
            <p>
              <a href={`${REPO}/tree/main/packages/ui`} target="_blank" rel="noreferrer">Zengin UI on GitHub</a>, with a contrast test over every theme pairing and a test that runs the engine on its own source. Every
              component, in both themes, with its manifest-driven controls:
            </p>
            <div className="hero__actions">
              <Button asChild variant="soft">
                <a href="/storybook/index.html" target="_blank" rel="noreferrer">
                  Open Storybook
                </a>
              </Button>
            </div>
          </div>
          <div className="specimen" aria-label="Zengin UI components in this brand">
            <div className="specimen__group">
              <span className="specimen__label">Button: variant and tone</span>
              <div className="specimen__row">
                <Button tone="primary">Approve</Button>
                <Button variant="soft" tone="primary">
                  Request changes
                </Button>
                <Button variant="ghost">Later</Button>
                <Button variant="soft" tone="danger">
                  Reject
                </Button>
                <Button variant="link" tone="primary">
                  Explain
                </Button>
              </div>
            </div>
            <div className="specimen__group">
              <span className="specimen__label">Badge: tone and variant</span>
              <div className="specimen__row">
                <Badge tone="primary">nearest</Badge>
                <Badge tone="success">exact</Badge>
                <Badge tone="warning">warn</Badge>
                <Badge tone="danger" variant="solid">
                  error
                </Badge>
                <Badge variant="outline">suppressed</Badge>
              </div>
            </div>
            <div className="specimen__pair">
              <div className="specimen__theme" data-theme="light">
                <span className="specimen__label">Light</span>
                <Specimen />
              </div>
              <div className="specimen__theme" data-theme="dark">
                <span className="specimen__label">Dark</span>
                <Specimen />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Specimen() {
  return (
    <Card padding="sm">
      <div className="specimen__group">
        <TextField className="specimen__field" label="Suppression reason" placeholder="hero gradient, approved in brand review" size="sm" />
        <Checkbox label="Block on warnings too" defaultChecked size="sm" />
      </div>
    </Card>
  );
}
