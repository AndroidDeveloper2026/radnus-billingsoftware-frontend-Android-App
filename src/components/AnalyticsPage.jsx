// src/components/AnalyticsPage.jsx  (admin only)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import JobSheetSidebar from "./JobSheetSidebar";

const API = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d",    label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "last",  label: "Last month" },
  { key: "custom", label: "Custom" },
];

const presetRange = (key) => {
  const now = new Date();
  if (key === "today") return { from: ymd(now), to: ymd(now) };
  if (key === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: ymd(s), to: ymd(now) }; }
  if (key === "last") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };   // month
};

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const nice  = (s) => String(s || "").replace(/_/g, " ");

const delta = (cur, prev, inverse = false) => {
  if (prev == null || cur == null) return null;
  if (!prev) return cur ? { text: "new", good: !inverse } : null;
  const pct = ((cur - prev) / prev) * 100;
  if (!isFinite(pct) || Math.round(pct) === 0) return { text: "― 0%", good: null };
  return { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`, good: inverse ? pct < 0 : pct > 0 };
};

const ratingColor = (r) => (r == null ? "#94a3b8" : r < 3 ? "#dc2626" : r < 4 ? "#d97706" : "#16a34a");

/* ---------------- styles ---------------- */
const CSS = `
.an { color: #0f172a; font-family: 'Segoe UI', system-ui, sans-serif; }
.an *, .an *::before, .an *::after { box-sizing: border-box; }
.an-top   { background: linear-gradient(90deg, #B91C1C, #991B1B); color: #fff; padding: 14px 28px; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 2px 8px rgba(127,29,29,.25); }
.an-brand { font-weight: 800; font-size: 1.15rem; letter-spacing: .5px; }
.an-tag   { background: rgba(255,255,255,.18); font-size: .62rem; font-weight: 700; padding: 3px 9px; border-radius: 6px; letter-spacing: .08em; }
.an-sep   { width: 1px; height: 18px; background: rgba(255,255,255,.35); }
.an-page  { font-weight: 600; font-size: 1rem; opacity: .95; }
.an-wrap  { padding: 22px 28px 50px; max-width: 1600px; }

.an-bar   { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; }
.an-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.an-chip  { border: 1px solid #dbe2ea; background: #fff; color: #475569; border-radius: 99px; padding: 7px 14px; font-size: .8rem; font-weight: 600; }
.an-chip.on { background: #B91C1C; border-color: #B91C1C; color: #fff; }
.an-f label { display: block; font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: #64748b; margin-bottom: 4px; }
.an-input { color-scheme: light; background: #fff; color: #0f172a; border: 1px solid #dbe2ea; border-radius: 9px; padding: 7px 10px; min-height: 38px; font-size: .85rem; }
.an-input::-webkit-calendar-picker-indicator { filter: none; }
.an-btn   { border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 10px; padding: 8px 16px; font-size: .82rem; font-weight: 600; height: 38px; }
.an-btn:disabled { opacity: .6; }

.an-kpis  { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 18px; }
.an-kpi   { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); min-width: 0; }
.an-kpi .l { font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: #64748b; }
.an-kpi .v { font-size: 1.65rem; font-weight: 800; margin-top: 6px; line-height: 1.1; word-break: break-word; }
.an-kpi .v small { font-size: .8rem; font-weight: 600; color: #64748b; }
.an-kpi .s { font-size: .74rem; margin-top: 6px; color: #64748b; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.an-up   { color: #16a34a; font-weight: 700; } .an-down { color: #dc2626; font-weight: 700; } .an-flat { color: #94a3b8; font-weight: 700; }

.an-card  { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.an-h     { font-size: .95rem; font-weight: 800; margin: 0 0 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.an-legend { display: flex; gap: 14px; font-size: .74rem; color: #64748b; font-weight: 600; }
.an-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; }

.an-chart { display: flex; align-items: flex-end; gap: 6px; height: 170px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.an-col   { flex: 1 0 26px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.an-bars  { display: flex; align-items: flex-end; gap: 2px; height: 140px; width: 100%; justify-content: center; }
.an-bars span { display: block; width: 45%; max-width: 14px; border-radius: 3px 3px 0 0; min-height: 2px; }
.an-col em { font-style: normal; font-size: .62rem; color: #94a3b8; margin-top: 4px; }

.an-tabs  { display: flex; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 6px; margin-bottom: 18px; overflow-x: auto; width: fit-content; max-width: 100%; }
.an-tab   { border: 0; background: transparent; color: #475569; font-weight: 600; font-size: .88rem; padding: 9px 18px; border-radius: 10px; white-space: nowrap; }
.an-tab.on { background: #B91C1C; color: #fff; box-shadow: 0 3px 8px rgba(185,28,28,.3); }

.an-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #f1f5f9; border-radius: 10px; }
.an-table  { width: 100%; border-collapse: separate; border-spacing: 0; font-size: .84rem; }
.an-table th { background: #f8fafc; color: #64748b; font-size: .66rem; text-transform: uppercase; letter-spacing: .07em; font-weight: 700; padding: 11px 12px; white-space: nowrap; border-bottom: 1px solid #e2e8f0; cursor: pointer; user-select: none; text-align: right; }
.an-table td { padding: 11px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.an-table th:first-child, .an-table td:first-child { text-align: left; position: sticky; left: 0; background: #fff; z-index: 1; font-weight: 700; }
.an-table th:first-child { background: #f8fafc; z-index: 2; }
.an-table tbody tr:hover td { background: #f8fafc; }
.an-table tfoot td { background: #f8fafc; font-weight: 800; border-top: 2px solid #e2e8f0; }
.an-table tfoot td:first-child { background: #f8fafc; }
.an-meter { display: inline-block; vertical-align: middle; height: 6px; border-radius: 4px; background: #fca5a5; margin-right: 8px; }
.an-empty { text-align: center; color: #64748b; padding: 40px 10px; font-weight: 600; }
.an-err   { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-weight: 600; font-size: .85rem; }

.an-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.an-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.an-dist  { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: .82rem; font-weight: 600; }
.an-dist .t { flex: 1; height: 10px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
.an-dist .t i { display: block; height: 100%; border-radius: 6px; }
.an-li    { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: .85rem; text-transform: capitalize; }
.an-li b  { font-variant-numeric: tabular-nums; }

@media (max-width: 991.98px) { .an-grid2 { grid-template-columns: 1fr; } }
@media (max-width: 767.98px) {
  .an-top  { padding: 12px 16px; }
  .an-wrap { padding: 14px 12px 40px; }
  .an-kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
  .an-kpi  { padding: 12px 14px; }
  .an-kpi .v { font-size: 1.3rem; }
  .an-bar  { padding: 12px; }
  .an-chips { width: 100%; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
  .an-chip { white-space: nowrap; }
  .an-f    { flex: 1 1 130px; }
  .an-f .an-input { width: 100%; }
  .an-btn  { width: 100%; }
  .an-card { padding: 14px 12px; }
}
`;

/* ---------------- small components ---------------- */
const Kpi = ({ label, value, unit, sub, d }) => (
  <div className="an-kpi">
    <div className="l">{label}</div>
    <div className="v">{value}{unit && <small> {unit}</small>}</div>
    <div className="s">
      {d && <span className={d.good === null ? "an-flat" : d.good ? "an-up" : "an-down"}>{d.text}</span>}
      {d && <span>vs previous period</span>}
      {sub && <span>{sub}</span>}
    </div>
  </div>
);

const Trend = ({ data }) => {
  const pts = data?.points || [];
  const max = Math.max(1, ...pts.map((p) => Math.max(p.bookings, p.delivered)));
  if (!pts.length) return <div className="an-empty">No data in this range</div>;
  return (
    <div className="an-chart">
      {pts.map((p) => (
        <div className="an-col" key={p.date} title={`${p.date}\nBookings: ${p.bookings}\nDelivered: ${p.delivered}`}>
          <div className="an-bars">
            <span style={{ height: `${(p.bookings / max) * 100}%`, background: "#B91C1C" }} />
            <span style={{ height: `${(p.delivered / max) * 100}%`, background: "#0f172a" }} />
          </div>
          <em>{data.monthly ? p.date.slice(2) : p.date.slice(8)}</em>
        </div>
      ))}
    </div>
  );
};

// columns: { key, label, render?(row), total?: "sum" | fn(rows) }
const DataTable = ({ columns, rows, initialSort }) => {
  const [sort, setSort] = useState({ key: initialSort, dir: -1 });
  const sorted = useMemo(() => {
    const c = columns.find((x) => x.key === sort.key);
    if (!c) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === "string" || typeof y === "string") return String(x ?? "").localeCompare(String(y ?? "")) * sort.dir;
      return ((x ?? -1) - (y ?? -1)) * sort.dir;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <div className="an-empty">No data in this range</div>;
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));

  return (
    <div className="an-scroll">
      <table className="an-table">
        <thead>
          <tr>{columns.map((c) => (
            <th key={c.key} onClick={() => toggle(c.key)}>{c.label}{sort.key === c.key ? (sort.dir < 0 ? " ↓" : " ↑") : ""}</th>
          ))}</tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.name}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
          ))}
        </tbody>
        <tfoot>
          <tr>{columns.map((c, i) => (
            <td key={c.key}>
              {i === 0 ? "Total" : c.total === "sum"
                ? (c.render ? c.render({ ...Object.fromEntries(columns.map((k) => [k.key, rows.reduce((s, r) => s + (r[k.key] || 0), 0)])) }) : rows.reduce((s, r) => s + (r[c.key] || 0), 0))
                : typeof c.total === "function" ? c.total(rows) : ""}
            </td>
          ))}</tr>
        </tfoot>
      </table>
    </div>
  );
};

const Rating = ({ r, n }) => (r == null ? <span style={{ color: "#94a3b8" }}>—</span>
  : <span style={{ color: ratingColor(r), fontWeight: 700 }}>★ {r.toFixed(2)}{n != null && <span style={{ color: "#94a3b8", fontWeight: 500 }}> ({n})</span>}</span>);

/* ---------------- page ---------------- */
const AnalyticsPage = () => {
  const [preset, setPreset] = useState("month");
  const [range, setRange]   = useState(presetRange("month"));
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [tab, setTab]       = useState("reps");

  const load = useCallback(async (r = range) => {
    setLoading(true); setError("");
    try {
      const res = await axios.get(`${API}/api/analytics/overview`, { params: r });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load analytics");
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range.from, range.to]);

  const pickPreset = (key) => {
    setPreset(key);
    if (key !== "custom") setRange(presetRange(key));
  };

  const k = data?.kpi || {}, p = data?.prev || {};
  const maxBook = (rows) => Math.max(1, ...(rows || []).map((r) => r.bookings));

  const meter = (rows) => (r) => (
    <>
      <span className="an-meter" style={{ width: Math.min(60, Math.max(2, (r.bookings / maxBook(rows)) * 60)) }} />{r.bookings}
    </>
  );
  const avgTatTotal = (rows) => {
    const x = rows.filter((r) => r.avgTat != null);
    return x.length ? (x.reduce((s, r) => s + r.avgTat, 0) / x.length).toFixed(1) + "d" : "—";
  };
  const ratingTotal = (rows) => {
    const n = rows.reduce((s, r) => s + (r.rating != null ? r.fbDone : 0), 0);
    const sum = rows.reduce((s, r) => s + (r.rating != null ? r.rating * r.fbDone : 0), 0);
    return n ? `★ ${(sum / n).toFixed(2)}` : "—";
  };

  const common = (rows) => ([
    { key: "name", label: "Name" },
    { key: "bookings", label: "Bookings", render: meter(rows), total: "sum" },
    { key: "repaired", label: "Repaired", total: "sum" },
    { key: "delivered", label: "Delivered", total: "sum" },
    { key: "cancelled", label: "Cancelled", total: "sum" },
    { key: "open", label: "Pending now", total: "sum" },
    { key: "o7", label: "Pending > 7d", render: (r) => <span style={{ color: r.o7 ? "#dc2626" : undefined, fontWeight: r.o7 ? 700 : 400 }}>{r.o7}</span>, total: "sum" },
    { key: "avgTat", label: "Avg TAT", render: (r) => (r.avgTat == null ? "—" : `${r.avgTat}d`), total: avgTatTotal },
    { key: "income", label: "Income", render: (r) => money(r.income), total: "sum" },
    { key: "profit", label: "Profit", render: (r) => money(r.profit), total: "sum" },
    { key: "rating", label: "Feedback", render: (r) => <Rating r={r.rating} n={r.fbDone} />, total: ratingTotal },
  ]);

  const repCols = useMemo(() => {
    const c = common(data?.reps);
    c.push({ key: "cases", label: "Open cases", render: (r) => (r.cases ? <b style={{ color: "#dc2626" }}>{r.cases}</b> : 0), total: "sum" });
    return c;
  }, [data]);   // eslint-disable-line
  const engCols = useMemo(() => {
    const c = common(data?.engineers);
    c[1] = { ...c[1], label: "Assigned" };
    c.push({ key: "low", label: "Low ratings (≤2)", total: "sum" });
    return c;
  }, [data]);   // eslint-disable-line

  const fb = data?.feedback;
  const distMax = Math.max(1, ...(fb ? Object.values(fb.dist) : [1]));
  const distColor = { 1: "#dc2626", 2: "#f97316", 3: "#f59e0b", 4: "#84cc16", 5: "#16a34a" };

  return (
    <div className="an" style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{CSS}</style>
      <JobSheetSidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="an-top">
          <span className="an-brand">RADNUS</span>
          <span className="an-tag">SERVICE PRO</span>
          <span className="an-sep" />
          <span className="an-page">Analytics</span>
        </div>

        <div className="an-wrap">
          {/* FILTER */}
          <div className="an-bar">
            <div className="an-chips">
              {PRESETS.map((x) => (
                <button key={x.key} type="button" className={`an-chip ${preset === x.key ? "on" : ""}`} onClick={() => pickPreset(x.key)}>{x.label}</button>
              ))}
            </div>
            <div className="an-f">
              <label>From</label>
              <input type="date" className="an-input" value={range.from} max={range.to}
                onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }} />
            </div>
            <div className="an-f">
              <label>To</label>
              <input type="date" className="an-input" value={range.to} min={range.from}
                onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }} />
            </div>
            <button type="button" className="an-btn" onClick={() => load(range)} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>

          {error && <div className="an-err">{error}</div>}
          {!data && loading && <div className="an-empty">Loading analytics…</div>}

          {data && (<>
            {/* KPI */}
            <div className="an-kpis">
              <Kpi label="Bookings" value={k.bookings} d={delta(k.bookings, p.bookings)} sub="job sheets created" />
              <Kpi label="Delivered" value={k.delivered} d={delta(k.delivered, p.delivered)} />
              <Kpi label="Pending now" value={k.openNow} sub={`${k.stale7} older than 7 days`} />
              <Kpi label="Cancelled" value={k.cancelled} d={delta(k.cancelled, p.cancelled, true)} />
              <Kpi label="Income" value={money(k.income)} d={delta(k.income, p.income)} />
              <Kpi label="Profit (service)" value={money(k.profit)} d={delta(k.profit, p.profit)} />
              <Kpi label="Avg turnaround" value={k.avgTat == null ? "—" : k.avgTat} unit={k.avgTat == null ? "" : "days"} d={delta(k.avgTat, p.avgTat, true)} />
              <Kpi label="Feedback done" value={k.fbDone} d={delta(k.fbDone, p.fbDone)} />
              <Kpi label="Avg rating" value={k.avgRating == null ? "—" : k.avgRating} unit={k.avgRating == null ? "" : "/ 5"} d={delta(k.avgRating, p.avgRating)} />
            </div>

            {/* TREND */}
            <div className="an-card">
              <div className="an-h">
                <span>{data.trend.monthly ? "Monthly" : "Daily"} bookings vs delivered</span>
                <span className="an-legend">
                  <span><i style={{ background: "#B91C1C" }} />Bookings</span>
                  <span><i style={{ background: "#0f172a" }} />Delivered</span>
                </span>
              </div>
              <Trend data={data.trend} />
            </div>

            {/* TABS */}
            <div className="an-tabs">
              <button className={`an-tab ${tab === "reps" ? "on" : ""}`} onClick={() => setTab("reps")}>Service Rep wise</button>
              <button className={`an-tab ${tab === "eng" ? "on" : ""}`} onClick={() => setTab("eng")}>Engineer wise</button>
              <button className={`an-tab ${tab === "fb" ? "on" : ""}`} onClick={() => setTab("fb")}>Feedback</button>
            </div>

            {tab === "reps" && (
              <div className="an-card">
                <div className="an-h">Service Rep wise <span className="an-legend">Click a column to sort</span></div>
                <DataTable columns={repCols} rows={data.reps} initialSort="bookings" />
              </div>
            )}

            {tab === "eng" && (
              <div className="an-card">
                <div className="an-h">Engineer wise <span className="an-legend">Click a column to sort</span></div>
                <DataTable columns={engCols} rows={data.engineers} initialSort="bookings" />
              </div>
            )}

            {tab === "fb" && fb && (<>
              <div className="an-tiles">
                <Kpi label="Calls done" value={fb.done} d={delta(k.fbDone, p.fbDone)} />
                <Kpi label="Call attempts" value={fb.attempts} />
                <Kpi label="Unreachable" value={fb.unreachable} />
                <Kpi label="Avg rating" value={fb.avgRating == null ? "—" : fb.avgRating} unit={fb.avgRating == null ? "" : "/ 5"} />
                <Kpi label="Low ratings (≤2)" value={fb.lowRatings} />
                <Kpi label="Flagged" value={fb.flagged} />
                <Kpi label="Cases created" value={fb.cases.created} />
                <Kpi label="Cases open now" value={fb.cases.open} sub={`${fb.cases.escalated} escalated`} />
              </div>

              <div className="an-grid2">
                <div className="an-card">
                  <div className="an-h">Rating distribution</div>
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div className="an-dist" key={s}>
                      <span style={{ width: 22 }}>{s}★</span>
                      <span className="t"><i style={{ width: `${(fb.dist[s] / distMax) * 100}%`, background: distColor[s] }} /></span>
                      <b style={{ width: 34, textAlign: "right" }}>{fb.dist[s]}</b>
                    </div>
                  ))}
                </div>
                <div className="an-card">
                  <div className="an-h">Flags &amp; scenarios</div>
                  {fb.flags.length === 0 && fb.scenarios.length === 0 && <div className="an-empty">No data in this range</div>}
                  {fb.flags.map((f) => <div className="an-li" key={"f" + f.key}><span>🚩 {nice(f.key)}</span><b>{f.n}</b></div>)}
                  {fb.scenarios.map((f) => <div className="an-li" key={"s" + f.key}><span>📞 {nice(f.key)}</span><b>{f.n}</b></div>)}
                </div>
              </div>

              <div className="an-card">
                <div className="an-h">Feedback employee wise</div>
                <DataTable initialSort="collected" rows={fb.employees} columns={[
                  { key: "name", label: "Employee" },
                  { key: "collected", label: "Feedback collected", total: "sum" },
                  { key: "attempts", label: "Call attempts", total: "sum" },
                  { key: "rating", label: "Avg rating given", render: (r) => <Rating r={r.rating} /> },
                ]} />
              </div>
            </>)}
          </>)}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;