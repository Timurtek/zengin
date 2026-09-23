import "@zenginui/ui/styles.css";
import "./theme/brand.css";
import "./site.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Tooltip } from "@zenginui/ui";
import { Nav } from "./sections/Nav";
import { Why } from "./sections/Why";

type Theme = "light" | "dark";

/** The same theme handling as the home page: the choice lives on <html> so tokens reach portals too. */
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

function Page() {
  const [theme, toggle] = useTheme();
  // Nav's theme toggle carries a Tooltip, and a Tooltip needs its provider above it. The home page has one;
  // this page is a second entry point, so it needs its own.
  return (
    <Tooltip.Provider>
      <Nav theme={theme} onToggleTheme={toggle} />
      <Why />
    </Tooltip.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
