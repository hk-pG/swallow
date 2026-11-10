import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { bootstrapApp } from "./bootstrap";
import "../styles/tokens.css";
import "../styles/controls.css";
import "../styles/layout.css";
import "../styles/sidebar.css";
import "../styles/items.css";
import "../styles/inspector.css";
import "../styles/quick-look.css";

bootstrapApp();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
