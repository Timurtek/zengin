import { Button, Tooltip } from "@zengin/ui";
import { NAV, REPO } from "../content";

export function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return (
    <header className="nav">
      <div className="wrap nav__inner">
        <a className="nav__mark" href="#top" aria-label="Zengin, top of page">
          <Mark />
          <span className="nav__wordmark">
            Zengin
            <small>Authored systems</small>
          </span>
        </a>
        <nav aria-label="Sections">
          <ul className="nav__links">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>
                  {item.label}
                </a>
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

/** The Z: three modules, a bar, a diagonal, a bar. Simple modules, stronger systems. */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="12,6 62,6 54,20 4,20" fill="currentColor" />
      <polygon points="44,22 58,22 20,42 6,42" fill="currentColor" />
      <polygon points="10,44 60,44 52,58 2,58" fill="currentColor" />
    </svg>
  );
}
