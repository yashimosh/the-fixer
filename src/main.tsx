// Entry — mounts the React tree.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./capture/captureHelper";  // exposes window.__fixerRecord + window.__fixerKeys
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
