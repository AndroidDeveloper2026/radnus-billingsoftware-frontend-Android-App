import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from "axios";                       // ← NEW
import App from './App.jsx'
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

// ← NEW (createRoot kku MUNNAADI)
axios.interceptors.request.use((cfg) => {
  const token = sessionStorage.getItem("token");
  const API = import.meta.env.VITE_API_URL;
  if (token && API && cfg.url && cfg.url.startsWith(API)) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)