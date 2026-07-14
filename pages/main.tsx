import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { InnerCompassApp } from "../app/InnerCompassApp";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InnerCompassApp />
  </StrictMode>,
);
