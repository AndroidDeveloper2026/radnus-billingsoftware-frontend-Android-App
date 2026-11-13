// src/components/StoreSwitcher.jsx
// Small floating pill, mounted once in App.jsx so it shows on every page.
//  • admin / gm  → dropdown: "All stores" + every store. Changing it reloads the page so
//                  every report / list refetches for the new store (X-Store-Id header).
//  • everyone else → read-only badge showing their own store.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Store as StoreIcon } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const StoreSwitcher = () => {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("user") || "null"); } catch {}

  const isGlobal = user?.role === "admin" || user?.role === "gm";
  const [stores, setStores] = useState([]);
  const active = sessionStorage.getItem("activeStoreId") || "all";

  useEffect(() => {
    if (!isGlobal) return;
    const load = () =>
      axios.get(`${API}/api/stores`)
        .then((res) => {
          setStores(res.data || []);
          // session started before multi-store existed → pick the first store once
          if (!sessionStorage.getItem("activeStoreId") && user?.role === "admin" && res.data?.length) {
            sessionStorage.setItem("activeStoreId", res.data[0]._id);
            window.location.reload();
          }
        })
        .catch(() => {});
    load();
    // Store Management popup fires this after adding / (de)activating a store
    window.addEventListener("storeListUpdated", load);
    return () => window.removeEventListener("storeListUpdated", load);
  }, []);

  if (!user) return null;

  const pill = {
    position: "fixed", right: 14, bottom: 66, zIndex: 1040,
    display: "flex", alignItems: "center", gap: 6,
    background: "#111827", color: "#fff", borderRadius: 999,
    padding: "6px 12px", fontSize: 12.5, fontWeight: 600,
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  };

  return (
    <>
      <style>{`@media print { .store-switcher { display: none !important; } }`}</style>
      <div className="store-switcher" style={pill} title="Current store">
        <StoreIcon size={14} />
        {isGlobal ? (
          <select
            value={active}
            onChange={(e) => {
              sessionStorage.setItem("activeStoreId", e.target.value);
              window.location.reload();
            }}
            style={{ background: "transparent", color: "#fff", border: "none", outline: "none", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
          >
            <option value="all" style={{ color: "#111" }}>All stores</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id} style={{ color: "#111" }}>
                {s.name}{s.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        ) : (
          <span>{user.storeName || "My store"}</span>
        )}
      </div>
    </>
  );
};

export default StoreSwitcher;