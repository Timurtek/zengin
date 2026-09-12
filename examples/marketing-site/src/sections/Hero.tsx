import { Button } from "@zengin/ui";
import { CheckPanel } from "../components/CheckPanel";

/** The facts on the sheet. Each is a number the repository can back. */
const SPEC = [
  ["Rule kinds", "7"],
  ["Surfaces", "4"],
  ["Models in the loop", "0"],
  ["License", "MIT"],
] as const;

/** The band runs in the opposite theme to the page: the same tokens, attached to one element. */
export function Hero({ theme }: { theme: "light" | "dark" }) {
  return (
    <section className="hero" id="top" data-theme={theme === "light" ? "dark" : "light"}>
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">Design-system conformance for coding agents</span>
            <h1 className="hero__title">
              The agent writes the code. <em>Zengin keeps it on the system.</em>
            </h1>
            <p className="lead">
              A deterministic rule engine that catches color literals, off-scale spacing, rogue props and hand-rolled components as they are written, and hands back the fix. It runs
              inside the MCP server, the edit hook, the CLI and CI, against definitions your design system already has.
            </p>
            <div className="hero__actions">
              <Button asChild tone="primary" size="lg">
                <a href="#get-started">Get started</a>
              </Button>
              <Button asChild variant="soft" size="lg">
                <a href="#rules">Read the seven rules</a>
              </Button>
            </div>
          </div>
          <CheckPanel />
        </div>
        <dl className="spec" aria-label="At a glance">
          {SPEC.map(([term, value]) => (
            <div key={term} className="spec__cell">
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
