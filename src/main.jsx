import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Logo from "./assets/logo-no-bg.png";

const favicon =
  document.querySelector("link[rel='icon']") ?? document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = Logo;
document.head.appendChild(favicon);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
