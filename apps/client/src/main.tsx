import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OverlayProvider } from "overlay-kit";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayProvider>
      <App />
    </OverlayProvider>
  </StrictMode>
);
