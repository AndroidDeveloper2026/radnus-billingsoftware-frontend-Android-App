import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// Bell / sidebar count — 60 sec ku oru thadava refresh
export default function useCaseBadge(intervalMs = 60000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (!sessionStorage.getItem("token")) return;
      axios.get(`${API}/api/cases/badge`)
        .then((r) => alive && setCount(r.data.count || 0))
        .catch(() => {});
    };
    run();
    const t = setInterval(run, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [intervalMs]);

  return count;
}