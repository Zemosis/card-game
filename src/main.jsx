import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import "./index.css";
import App from "./App.jsx";

// Games run in real time on the server. By default GSAP treats a long gap
// between frames (a covered or background window) as a hiccup and resumes
// animations where they stopped; turn that off so they catch up to now.
gsap.ticker.lagSmoothing(0);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
