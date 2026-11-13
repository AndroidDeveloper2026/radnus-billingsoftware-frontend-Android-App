import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import setupAxios from './api/setupAxios'   // ✅ NEW — attaches token + store header to every axios call
import "bootstrap/dist/js/bootstrap.bundle.min.js"; 
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

setupAxios();   // ✅ NEW — must run before the first request

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)