import { Button } from "@zengin/ui";
import { CheckPanel } from "../components/CheckPanel";

/** The facts on the sheet. Each is a number the repository can back. */
const SPEC = [
  ["Components", "33"],
  ["Templates", "5"],
  ["Rule kinds", "7"],
  ["Models in the loop", "0"],
] as const;

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">Authored systems</span>
            <h1 className="hero__title">
              Your system. <em>Every change.</em>
            </h1>
            <p className="lead">
              A design system you own. Built to stay yours. One command creates it with the components copied in; an engine checks every edit after that, whether a person or an
              agent made it, and hands back the fix.
            </p>
            <div className="hero__actions">
              <Button asChild tone="primary" size="lg">
                <a href="#get-started">Get started</a>
              </Button>
              <Button asChild variant="soft" size="lg">
                <a href="#templates">Try the templates</a>
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
