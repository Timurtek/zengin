import { Button, Tooltip } from "@zengin/ui";
import { NAV, REPO } from "../content";

export function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return (
    <header className="nav">
      <div className="wrap nav__inner">
        <a className="nav__mark" href="#top" aria-label="Zengin, top of page">
          <Mark />
          Zengin
        </a>
        <nav aria-label="Sections">
          <ul className="nav__links">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav__end">
          <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
            <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle theme">
              {theme === "light" ? "Dark" : "Light"}
            </Button>
          </Tooltip>
          <Button asChild variant="soft" size="sm">
            <a href={REPO}>GitHub</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Two brackets and a rule: the shape of a contract. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4H5v16h3M16 4h3v16h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
