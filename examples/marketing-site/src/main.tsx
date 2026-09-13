import "@zenginui/ui/styles.css";
import "./theme/brand.css";
import "./site.css";
import "./preview-theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
