import { Toast, Tooltip } from "@zengin/ui";
import { useEffect, useState, type ComponentType } from "react";
import { Shell, type Page } from "./components/Shell";
import { Billing } from "./views/Billing";
import { Customers } from "./views/Customers";
import { Overview } from "./views/Overview";
import { Settings } from "./views/Settings";

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into portals (menus, sheets, toasts) as well as the page. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

const PAGES: Record<Page, ComponentType> = { overview: Overview, customers: Customers, billing: Billing, settings: Settings };

export function App() {
  const [page, setPage] = useState<Page>("overview");
  const [theme, toggleTheme] = useTheme();
  const Current = PAGES[page];
  return (
    <Tooltip.Provider>
      <Toast.Provider position="bottom-right">
        <Shell page={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme}>
          {/* Keyed by page, so each page enters with the fade preset. */}
          <div key={page} className="page z-enter-fade">
            <Current />
          </div>
        </Shell>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
