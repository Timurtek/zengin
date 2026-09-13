import { Tooltip } from "@zenginui/ui";
import { useEffect, useState } from "react";
import { NPM, REPO } from "./content";
import { Catalog } from "./sections/Catalog";
import { GetStarted } from "./sections/GetStarted";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { Nav } from "./sections/Nav";
import { Proof } from "./sections/Proof";
import { Rules } from "./sections/Rules";
import { Surfaces } from "./sections/Surfaces";
import { System } from "./sections/System";

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into portals (tooltips, dialogs) as well as the page. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("zengin-theme", theme);
    } catch {
      // Private mode or blocked storage: the choice still applies for this visit.
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  return (
    <Tooltip.Provider>
      <div className="site">
        <Nav theme={theme} onToggleTheme={toggleTheme} />
        <main>
          <Hero />
          <HowItWorks />
          <Catalog />
          <Surfaces />
          <Rules />
          <System />
          <Proof />
          <GetStarted />
        </main>
        <footer className="footer">
          <div className="wrap footer__inner">
            <span>Zengin is MIT licensed. Built on Zengin UI, checked by Zengin.</span>
            <span className="footer__links">
              <a href={REPO} target="_blank" rel="noreferrer">github.com/Timurtek/zengin</a>
              <a href={NPM} target="_blank" rel="noreferrer">npmjs.com/org/zenginui</a>
            </span>
          </div>
        </footer>
      </div>
    </Tooltip.Provider>
  );
}
