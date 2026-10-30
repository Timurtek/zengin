import "@zenginui/ui/styles.css";
import "../src/theme/brand.css";
import "../src/site.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotFoundScreen } from "site-errors";

// The host answers every address it has no file for with this page, the docs' included.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="site">
      <NotFoundScreen />
    </div>
  </StrictMode>,
);
