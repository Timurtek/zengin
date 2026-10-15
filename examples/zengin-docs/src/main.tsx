import "@zenginui/ui/styles.css";
import "./theme/brand.css";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { showErrorScreenOnCrash, startErrorReporting } from "site-errors";
import { App } from "./App";

void startErrorReporting({ surface: "docs" });
showErrorScreenOnCrash({ home: import.meta.env.BASE_URL });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
