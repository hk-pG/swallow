import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installDisableDefaultContextMenu } from "./lib/disableDefaultContextMenu";
import "./styles.css";

installDisableDefaultContextMenu();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
