import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { supabaseEnabled } from "./lib/supabase";
import App from "./App";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const app = (
  <AuthProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthProvider>
);

// GoogleOAuthProvider only needed for legacy (non-Supabase) auth
const root = supabaseEnabled || !googleClientId ? app : (
  <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{root}</React.StrictMode>
);
