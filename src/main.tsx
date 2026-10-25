import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// benchmarks only (tests/perf/bench.mjs): a separate chunk that normal visits never download
if (new URLSearchParams(location.search).has("bench")) void import("./lib/bench").then((m) => m.install());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
