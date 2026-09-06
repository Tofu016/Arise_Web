import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Registers the PWA service worker (public/sw.js) — makes the app
// installable and gives the app shell basic offline resilience. Only runs
// in production builds; skipping it in dev avoids fighting Vite's own hot-
// reload with a stale cached bundle. Requires HTTPS in production (or
// localhost, which browsers treat as a secure-context exception).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}
