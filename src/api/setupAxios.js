
// src/api/setupAxios.js
// Installed ONCE from main.jsx. Because every component uses the default `axios`
// instance, this single file is what makes ALL ~40 pages send the login token and
// the selected store — no per-page changes needed.
//
//   Authorization: Bearer <token>   → backend `protect` middleware (was never sent before)
//   X-Store-Id: <storeId>           → only meaningful for admin / gm (store switcher);
//                                     the backend ignores it for everyone else.
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "";
let installed = false;

export default function setupAxios() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("token");
    // only ever send the token to OUR backend, never to a third-party URL
    const isOurApi = !API || String(config.url || "").startsWith(API) || String(config.url || "").startsWith("/");
    if (token && isOurApi) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
      const storeId = sessionStorage.getItem("activeStoreId");
      if (storeId) config.headers["X-Store-Id"] = storeId; // "all" or a store _id
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      // token expired / user deleted → back to the login page
      if (err.response?.status === 401 && sessionStorage.getItem("token")) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("activeStoreId");
        window.location.assign("/");
      }
      return Promise.reject(err);
    }
  );
}