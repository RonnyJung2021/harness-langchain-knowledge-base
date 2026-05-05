import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";
import { registerServiceWorker } from "./registerSw";

registerServiceWorker();

const el = document.getElementById("root");
if (el === null) {
  throw new Error("missing #root");
}

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
