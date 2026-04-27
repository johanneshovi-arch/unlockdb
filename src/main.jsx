import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import LandingPage from "./LandingPage.jsx";
import DesignA from "./DesignA.jsx";
import DesignB from "./DesignB.jsx";
import InvestorPage from "./InvestorPage.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* More specific route first */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/design-a" element={<DesignA />} />
        <Route path="/design-b" element={<DesignB />} />
        <Route path="/vc" element={<InvestorPage />} />
        {/* "/" and all in-app paths (/sources, /copilot, /settings, …) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
