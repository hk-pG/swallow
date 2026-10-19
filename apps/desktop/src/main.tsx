import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { HigTrialPreview } from "./components/HigTrialPreview";
import { installDisableDefaultContextMenu } from "./lib/disableDefaultContextMenu";
import { applyUiTrialToDocument, parseUiTrial, readUiTrial } from "./lib/uiTrial";
import "./styles.css";
import "./styles.hig-trial.css";

installDisableDefaultContextMenu();

const params = new URLSearchParams(window.location.search);
const trialOverride = params.get("uiTrial");
applyUiTrialToDocument(trialOverride != null ? parseUiTrial(trialOverride) : readUiTrial());

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

const higPreview = params.has("higPreview");

createRoot(root).render(<StrictMode>{higPreview ? <HigTrialPreview /> : <App />}</StrictMode>);
