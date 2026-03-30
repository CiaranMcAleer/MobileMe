import React from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/app.css";
import { AppRouterProvider } from "./router/createAppRouter";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRouterProvider />
  </React.StrictMode>,
);
