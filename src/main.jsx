import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppStateProvider } from "./context/AppState";
import { AuthProvider } from "./context/AuthContext";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
