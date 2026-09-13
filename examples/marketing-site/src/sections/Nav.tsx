import { Button, Icon, Separator, Sheet, Tooltip } from "@zenginui/ui";
import { useState } from "react";
import { NAV, NPM, REPO } from "../content";

const EXTERNAL = { target: "_blank", rel: "noreferrer" } as const;

/**
 * Three widths. Wide: the section links run inline. Narrower: they fold into a sheet behind a menu button,
 * with npm and GitHub beside them. A phone keeps the mark, the theme toggle and the menu.
 */
export function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="nav__inner">
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
                <a href={item.href} {...(item.external ? EXTERNAL : {})}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav__end">
          <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
            <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
          </Tooltip>
          <Button className="nav__npm" asChild variant="ghost" size="sm">
            <a href={NPM} {...EXTERNAL}>
              npm
            </a>
          </Button>
          <Button className="nav__github" asChild variant="soft" size="sm">
            <a href={REPO} {...EXTERNAL}>
              GitHub
            </a>
          </Button>
          <Sheet open={open} onOpenChange={setOpen} side="right" size="sm">
            <Sheet.Trigger asChild>
              <Button className="nav__menu" variant="ghost" size="sm" aria-label="Open menu" leadingIcon={<Icon.Menu />} />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>Zengin</Sheet.Title>
              <Sheet.Description>Sections of this page, and where the code lives.</Sheet.Description>
              <nav aria-label="Sections">
                <ul className="nav__sheet">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <a href={item.href} onClick={() => setOpen(false)} {...(item.external ? EXTERNAL : {})}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <Separator />
              <ul className="nav__sheet">
                <li>
                  <a href={NPM} {...EXTERNAL}>
                    npm
                  </a>
                </li>
                <li>
                  <a href={REPO} {...EXTERNAL}>
                    GitHub
                  </a>
                </li>
              </ul>
            </Sheet.Content>
          </Sheet>
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
