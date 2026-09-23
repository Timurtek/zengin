import { Tooltip } from "@zenginui/ui";
import { useEffect, useState } from "react";
import { NPM, REPO } from "./content";
import { Catalog } from "./sections/Catalog";
import { GetStarted } from "./sections/GetStarted";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { Nav } from "./sections/Nav";
import { Proof } from "./sections/Proof";
import { Growth } from "./sections/Growth";
import { Rules } from "./sections/Rules";
import { Path } from "./sections/Path";
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

/**
 * A link to a section, arriving from somewhere else.
 *
 * The browser looks for the target as the document loads, and on this page the sections do not exist yet:
 * React has not rendered them. So `/#rules` from the why page, or from anyone's bookmark, used to land at
 * the top of the page with the hash in the address bar and nothing to show for it. Once mounted, the jump is
 * ours to make.
 */
function useHashLanding(): void {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const jump = () => document.getElementById(id)?.scrollIntoView();
    requestAnimationFrame(jump);
    // Fonts and images settle after the first paint and move everything below them, so the position found a
    // frame in is not the position a moment later. Land again once the page has stopped growing.
    window.addEventListener("load", jump, { once: true });
    return () => window.removeEventListener("load", jump);
  }, []);
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  useHashLanding();
  return (
    <Tooltip.Provider>
      <div className="site">
        <Nav theme={theme} onToggleTheme={toggleTheme} />
        <main>
          <Hero />
          <HowItWorks />
          <Catalog />
          <Path />
          <Surfaces />
          <Rules />
          <Growth />
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
