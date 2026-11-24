import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import JobSheetSidebar from "./JobSheetSidebar";

const API = import.meta.env.VITE_API_URL;

/* ---------- constants ---------- */
const SCENARIOS = [
  { key: "delivered",      label: "Delivered" },
  { key: "delivered_nrna", label: "Delivered NR/NA" },
  { key: "repaired",       label: "Repaired" },
  { key: "pending",        label: "Pending" },
  { key: "cancelled",      label: "Cancelled" },
];
const SCENARIO_LABEL = Object.fromEntries(SCENARIOS.map((s) => [s.key, s.label]));

const FLAG_LABEL = {
  delivery_dispute: "Delivery dispute", low_rating: "Low rating", repeat_issue: "Repeat issue",
  issue_not_fixed: "Issue not fixed", billing_complaint: "Billing complaint", not_informed: "Not informed",
  delay_not_explained: "Delay not explained", wants_cancel: "Wants to cancel",
  charge_complaint: "Charge complaint", accessories_missing: "Accessories missing",
  home_delivery_request: "Home delivery request",
};
const SERIOUS_FLAGS = new Set(["delivery_dispute", "low_rating", "issue_not_fixed", "billing_complaint"]);

const ATTEMPT_LABEL = {
  not_answered: "Not answered", busy: "Busy", switched_off: "Switched off",
  callback: "Call back later", wrong_number: "Wrong number",
};

// yes/no questions where "Yes" is the bad answer / just information
const YES_IS_BAD = new Set(["repeat"]);
const YES_IS_NEUTRAL = new Set(["home_delivery"]);

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtD = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
const fmtShort = (s) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};
const num = (v, dash = "–") => (v === null || v === undefined ? dash : v);
const rate = (v) => (v === null || v === undefined ? "–" : Number(v).toFixed(1));
const pctText = (v) => (v === null || v === undefined ? "–" : `${v}%`);

const presets = () => {
  const t = new Date();
  const today = ymd(t);
  const d7 = new Date(t); d7.setDate(d7.getDate() - 6);
  const m1 = new Date(t.getFullYear(), t.getMonth(), 1);
  const lm1 = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const lm2 = new Date(t.getFullYear(), t.getMonth(), 0);
  return [
    { key: "today", label: "Today", from: today, to: today },
    { key: "7d", label: "Last 7 days", from: ymd(d7), to: today },
    { key: "month", label: "This month", from: ymd(m1), to: today },
    { key: "last", label: "Last month", from: ymd(lm1), to: ymd(lm2) },
  ];
};

/* ---------- small UI pieces ---------- */
const Delta = ({ cur, prev, unit = "", invert = false, digits = 0 }) => {
  if (cur === null || cur === undefined || prev === null || prev === undefined) {
    return <span className="frp-delta muted">No earlier data</span>;
  }
  const diff = +(cur - prev).toFixed(digits || 2);
  if (diff === 0) return <span className="frp-delta muted">Same as before</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`frp-delta ${good ? "good" : "bad"}`}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(digits)}{unit} vs before
    </span>
  );
};

const Section = ({ title, hint, right, children }) => (
  <section className="frp-sec">
    <div className="frp-sec-head">
      <div>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const Empty = ({ children }) => <div className="frp-empty">{children}</div>;

const Bar = ({ value, max = 100, color = "var(--ink)", height = 8 }) => (
  <div className="frp-bar" style={{ height }}>
    <span style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
  </div>
);

/* ---------- daily trend (pure SVG, no chart library) ---------- */
const TrendChart = ({ daily }) => {
  const W = 760, H = 230, L = 34, R = 8, T = 10, B = 28;

  const bins = useMemo(() => {
    const size = Math.max(1, Math.ceil(daily.length / 31));
    const out = [];
    for (let i = 0; i < daily.length; i += size) {
      const chunk = daily.slice(i, i + size);
      out.push({
        from: chunk[0].date,
        to: chunk[chunk.length - 1].date,
        collected: chunk.reduce((a, d) => a + d.collected, 0),
        attempts: chunk.reduce((a, d) => a + d.attempts, 0),
      });
    }
    return { size, list: out };
  }, [daily]);

  const list = bins.list;
  const maxV = Math.max(4, ...list.map((b) => b.collected + b.attempts));
  const step = Math.ceil(maxV / 4);
  const top = step * 4;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const slot = plotW / Math.max(list.length, 1);
  const bw = Math.min(26, slot * 0.66);
  const y = (v) => T + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(list.length / 10);

  if (!list.length || list.every((b) => b.collected + b.attempts === 0)) {
    return <Empty>No calls were made in this period. Pick a wider date range.</Empty>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="frp-chart" role="img"
        aria-label="Feedback collected and unanswered calls per day">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(step * i)} y2={y(step * i)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(step * i) + 4} textAnchor="end" fontSize="10.5" fill="var(--mute)">{step * i}</text>
          </g>
        ))}
        {list.map((b, i) => {
          const cx = L + slot * i + slot / 2;
          const hC = (b.collected / top) * plotH;
          const hA = (b.attempts / top) * plotH;
          const label = b.from === b.to ? fmtShort(b.from) : `${fmtShort(b.from)}–${fmtShort(b.to)}`;
          return (
            <g key={b.from}>
              <title>{`${label}: ${b.collected} collected, ${b.attempts} not answered`}</title>
              <rect x={cx - bw / 2} y={T + plotH - hC} width={bw} height={hC} fill="var(--good)" rx="2" />
              <rect x={cx - bw / 2} y={T + plotH - hC - hA} width={bw} height={hA} fill="var(--info)" rx="2" opacity=".75" />
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 9} textAnchor="middle" fontSize="10.5" fill="var(--mute)">{fmtShort(b.from)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="frp-legend">
        <span><i style={{ background: "var(--good)" }} />Feedback collected</span>
        <span><i style={{ background: "var(--info)" }} />Not answered</span>
        {bins.size > 1 && <span className="muted">Each bar = {bins.size} days</span>}
      </div>
    </div>
  );
};

/* ---------- rating distribution ---------- */
const STAR_COLOR = { 5: "var(--good)", 4: "#65a30d", 3: "var(--warn)", 2: "#ea580c", 1: "var(--brand)" };
const RatingBars = ({ dist, avg }) => {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(dist), 1);
  if (!total) return <Empty>No ratings yet in this period.</Empty>;
  return (
    <div>
      <div className="frp-avg">
        <span className="n">{rate(avg)}</span>
        <span className="s">average from {total} rating{total === 1 ? "" : "s"}</span>
      </div>
      {[5, 4, 3, 2, 1].map((s) => (
        <div className="frp-rrow" key={s}>
          <span className="star">{s} ★</span>
          <Bar value={dist[s]} max={max} color={STAR_COLOR[s]} height={10} />
          <span className="cnt">{dist[s]}<em>{Math.round((dist[s] / total) * 100)}%</em></span>
        </div>
      ))}
    </div>
  );
};

/* ---------- question-wise results ---------- */
const QuestionRow = ({ q }) => {
  if (q.type === "yesno") {
    const yesPct = q.n ? Math.round((q.yes / q.n) * 100) : 0;
    const noPct = 100 - yesPct;
    const neutral = YES_IS_NEUTRAL.has(q.key);
    const bad = YES_IS_BAD.has(q.key);
    const yesColor = neutral ? "#475569" : bad ? "var(--brand)" : "var(--good)";
    const noColor = neutral ? "#cbd5e1" : bad ? "var(--good)" : "var(--brand)";
    return (
      <div className="frp-q">
        <div className="frp-q-text">{q.text}<span className="n">{q.n} answers</span></div>
        <div className="frp-split">
          <span style={{ width: `${yesPct}%`, background: yesColor }} />
          <span style={{ width: `${noPct}%`, background: noColor }} />
        </div>
        <div className="frp-q-vals"><b>Yes {yesPct}%</b> ({q.yes}) · No {noPct}% ({q.no})</div>
      </div>
    );
  }
  if (q.type === "rating") {
    return (
      <div className="frp-q">
        <div className="frp-q-text">{q.text}<span className="n">{q.n} answers</span></div>
        <Bar value={q.avg || 0} max={5} color="var(--good)" height={8} />
        <div className="frp-q-vals"><b>{q.avg ?? "–"}</b> out of 5</div>
      </div>
    );
  }
  if (q.type === "choice") {
    const entries = Object.entries(q.options).sort((a, b) => b[1] - a[1]);
    return (
      <div className="frp-q">
        <div className="frp-q-text">{q.text}<span className="n">{q.n} answers</span></div>
        {entries.map(([k, v]) => (
          <div className="frp-opt" key={k}>
            <span className="k">{k}</span>
            <Bar value={v} max={q.n} color="#475569" height={6} />
            <span className="v">{v} · {Math.round((v / q.n) * 100)}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/* =================================================================== */
/* ---------- read-only popup: who is waiting for a call ---------- */
const POPUP_TITLE = {
  delivered: "Delivered – waiting for a call", repaired: "Repaired, not delivered – waiting",
  pending: "Received / pending – waiting", cancelled: "Cancelled – waiting",
  callback: "Call backs due now", attempts: "Unanswered attempts – need another call",
};

const WaitingModal = ({ tab, onClose }) => {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (tab === "attempts" || tab === "callback") {
          const { data } = await axios.get(`${API}/api/feedback/attempts`);
          const now = Date.now();
          const list = tab === "callback"
            ? data.filter((f) => f.nextCallAt && new Date(f.nextCallAt).getTime() <= now)
            : data;
          if (live) setRows(list.map((f) => {
            const last = f.callAttempts?.[f.callAttempts.length - 1] || {};
            return {
              id: f._id, job: f.jobSheetNo, name: f.customerName, phone: f.contact,
              type: SCENARIO_LABEL[f.job?.scenario || f.scenario] || "-",
              info: `${ATTEMPT_LABEL[last.status] || last.status || "-"} · ${f.callAttempts?.length || 0} attempt(s)`,
              by: last.by || "-", when: last.at, next: f.nextCallAt,
            };
          }));
        } else {
          const { data } = await axios.get(`${API}/api/feedback/queue`, { params: { tab } });
          if (live) setRows((data.groups || []).map((g) => ({
            id: g.key, job: g.jobs.map((j) => j.jobSheetNo).join(", "), name: g.customerName, phone: g.contact,
            type: [...new Set(g.jobs.map((j) => SCENARIO_LABEL[j.scenario] || j.scenario))].join(", "),
            info: `${g.oldestDays} day(s) old`, by: g.jobs[0]?.serviceRep || "-", when: g.lastCalledAt, next: null,
          })));
        }
      } catch (e) {
        if (live) setErr(e.response?.data?.message || e.message);
      }
    })();
    return () => { live = false; };
  }, [tab]);

  const dt = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
  const attemptMode = tab === "attempts" || tab === "callback";

  return (
    <div className="frp-modal-bg" onClick={onClose}>
      <div className="frp-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="frp-modal-head">
          <div>
            <h2>{POPUP_TITLE[tab] || "Waiting"}</h2>
            <p>View only. The calling team makes these calls.</p>
          </div>
          <button type="button" className="frp-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {err && <div className="alert alert-danger py-2">{err}</div>}
        {!rows && !err && <Empty>Loading…</Empty>}
        {rows && rows.length === 0 && <Empty>Nothing here.</Empty>}
        {rows && rows.length > 0 && (
          <div className="table-responsive">
            <table className="frp-table">
              <thead>
                <tr>
                  <th>Job</th><th>Customer</th><th>Type</th>
                  <th>{attemptMode ? "Last attempt" : "Waiting"}</th>
                  <th>{attemptMode ? "By" : "Service rep"}</th>
                  <th>{attemptMode ? "Next call" : "Last called"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.job}</b></td>
                    <td>{r.name || "-"}<div className="sub">{r.phone}</div></td>
                    <td>{r.type}</td>
                    <td>{r.info}{attemptMode && <div className="sub">{dt(r.when)}</div>}</td>
                    <td>{r.by}</td>
                    <td>{dt(attemptMode ? r.next : r.when)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const FeedbackReportPage = () => {
  const PRESETS = useMemo(presets, []);
  const [range, setRange] = useState({ from: PRESETS[2].from, to: PRESETS[2].to });
  const [preset, setPreset] = useState("month");
  const [sum, setSum] = useState(null);
  const [waiting, setWaiting] = useState({});
  const [excl, setExcl] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const [qTab, setQTab] = useState("delivered");
  const [qualityBy, setQualityBy] = useState("engineer");
  const [sort, setSort] = useState({ key: "collected", dir: "desc" });
  const [openEmp, setOpenEmp] = useState(null);
  const [popup, setPopup] = useState(null);   // tab key for the waiting popup

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [s, q, x] = await Promise.allSettled([
      axios.get(`${API}/api/feedback/summary`, { params: range }),
      axios.get(`${API}/api/feedback/queue`, { params: { tab: "delivered" } }),
      axios.get(`${API}/api/feedback/exclude`),
    ]);
    if (s.status === "fulfilled") {
      setSum(s.value.data);
      setUpdatedAt(new Date());
    } else {
      const e = s.reason;
      setError(`${e.response?.status || ""} ${e.response?.data?.message || e.message}`);
    }
    if (q.status === "fulfilled") setWaiting(q.value.data.counts || {});
    if (x.status === "fulfilled") setExcl(x.value.data);
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // keep the question tab on a scenario that has data
  useEffect(() => {
    if (!sum) return;
    const have = SCENARIOS.map((s) => s.key).filter((k) => sum.questions?.[k]?.length);
    if (have.length && !have.includes(qTab)) setQTab(have[0]);
  }, [sum, qTab]);

  const pick = (p) => { setPreset(p.key); setRange({ from: p.from, to: p.to }); };
  const setDate = (k, v) => { setPreset("custom"); setRange((r) => ({ ...r, [k]: v })); };

  const removeExclude = async (id) => {
    if (!window.confirm("If you remove this number from the exclude list, its jobs will return to the feedback queue. Continue?")) return;
    try {
      await axios.delete(`${API}/api/feedback/exclude/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
    }
  };

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const team = useMemo(() => {
    if (!sum) return [];
    const list = sum.byEmployee.map((e) => ({ ...e, calls: e.collected + e.attemptTotal }));
    const f = sort.dir === "desc" ? -1 : 1;
    return list.sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * f);
  }, [sum, sort]);

  /* things the admin should look at first */
  const attention = useMemo(() => {
    if (!sum) return [];
    const out = [];
    const c = sum.cases;
    if (c.escalated > 0) out.push({ tone: "bad", text: `${c.escalated} dispute case(s) escalated to admin`, href: "/cases" });
    if (c.awaitingClose > 0) out.push({ tone: "warn", text: `${c.awaitingClose} case(s) replied by rep, waiting to be closed`, href: "/cases" });
    if (c.open > 0) out.push({ tone: "warn", text: `${c.open} case(s) still waiting for the rep's reply`, href: "/cases" });
    if (waiting.callback > 0) out.push({ tone: "warn", text: `${waiting.callback} call back(s) are due now`, popup: "callback" });
    if (sum.openAttempts > 0) out.push({ tone: "info", text: `${sum.openAttempts} job(s) have unanswered attempts and need another call`, popup: "attempts" });
    const t = sum.totals;
    if (t.flaggedRate !== null && t.flaggedRate >= 20 && t.collected >= 5) {
      out.push({ tone: "bad", text: `${t.flaggedRate}% of feedback in this period was flagged`, href: null });
    }
    return out;
  }, [sum, waiting]);

  const qHave = sum ? SCENARIOS.filter((s) => sum.questions?.[s.key]?.length) : [];
  const flagList = sum ? Object.entries(sum.flags).sort((a, b) => b[1] - a[1]) : [];
  const flagMax = flagList.length ? flagList[0][1] : 1;
  const qualityList = sum ? (qualityBy === "engineer" ? sum.byEngineer : sum.byServiceRep) : [];
  const scenarioRows = sum ? SCENARIOS.filter((s) => sum.byScenario[s.key]) : [];

  const lastSeen = (ms) => {
    if (!ms) return "–";
    const d = new Date(ms);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86400000);
    const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return days <= 0 ? `Today ${t}` : days === 1 ? `Yesterday ${t}` : `${fmtD(d)} ${t}`;
  };

  const SortTh = ({ k, children, className = "" }) => (
    <th className={`${className} sortable`} onClick={() => toggleSort(k)} aria-sort={sort.key === k ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
      {children}{sort.key === k ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="frp" style={{ display: "flex", minHeight: "100vh", background: "var(--paper)" }}>
      <style>{CSS}</style>
      <JobSheetSidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="frp-top">
          <span className="brand">RADNUS</span>
          <span className="tag">SERVICE PRO</span>
          <span className="sep" />
          <span className="page">Feedback Report</span>
        </div>

        <div className="frp-wrap text-dark">
          {/* ---------- toolbar ---------- */}
          <div className="frp-toolbar">
            <div className="frp-seg" role="group" aria-label="Date range">
              {PRESETS.map((p) => (
                <button key={p.key} type="button" className={preset === p.key ? "on" : ""} onClick={() => pick(p)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="frp-dates">
              <label>From<input type="date" value={range.from} max={range.to} onChange={(e) => setDate("from", e.target.value)} /></label>
              <label>To<input type="date" value={range.to} min={range.from} onChange={(e) => setDate("to", e.target.value)} /></label>
              <button type="button" className="frp-btn" onClick={load} disabled={loading}>
                {loading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>
            <div className="frp-asof">
              {sum && <>Compared with {fmtD(sum.prevRange.from)} – {fmtD(sum.prevRange.to)}</>}
              {updatedAt && <span>Updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          </div>

          {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
          {!sum && loading && <div className="frp-empty">Loading report…</div>}

          {sum && (
            <>
              {popup && <WaitingModal tab={popup} onClose={() => setPopup(null)} />}

              {/* ---------- calling team (top priority) ---------- */}
              <Section title="Calling team" hint="Who called how much in this period. Click a column heading to sort, click a name to see day-wise activity.">
                {team.length === 0 ? <Empty>No calls were made in this period.</Empty> : (
                  <div className="table-responsive">
                    <table className="frp-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <SortTh k="calls" className="r">Calls</SortTh>
                          <SortTh k="collected" className="r">Feedback</SortTh>
                          <SortTh k="attemptTotal" className="r">Not answered</SortTh>
                          <SortTh k="skipped" className="r">Skipped</SortTh>
                          <SortTh k="contactRate">Answered rate</SortTh>
                          <SortTh k="avgRating" className="r">Avg rating</SortTh>
                          <SortTh k="flagged" className="r">Flagged</SortTh>
                          <SortTh k="activeDays" className="r">Active days</SortTh>
                          <SortTh k="avgPerActiveDay" className="r">Calls / day</SortTh>
                          <SortTh k="lastActiveAt" className="r">Last activity</SortTh>
                        </tr>
                      </thead>
                      <tbody>
                        {team.map((e) => {
                          const open = openEmp === e.name;
                          const days = Object.entries(e.daily || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
                          return (
                            <React.Fragment key={e.name}>
                              <tr style={{ cursor: "pointer" }} onClick={() => setOpenEmp(open ? null : e.name)}>
                                <td>
                                  <b>{open ? "▾ " : "▸ "}{e.name}</b>
                                  <div className="sub">
                                    {Object.entries(e.byScenario).map(([k, v]) => `${SCENARIO_LABEL[k] || k} ${v}`).join(" · ") || "No feedback yet"}
                                  </div>
                                </td>
                                <td className="r"><b>{e.calls}</b></td>
                                <td className="r"><b>{e.collected}</b></td>
                                <td className="r" title={Object.entries(e.attempts).map(([k, v]) => `${ATTEMPT_LABEL[k] || k}: ${v}`).join(", ")}>
                                  {e.attemptTotal || "–"}
                                </td>
                                <td className="r" title={`Skipped ${e.skipped} · Staff/internal ${e.internal} · Closed unreachable ${e.closedUnreach}`}>
                                  {e.skipped + e.internal + e.closedUnreach || "–"}
                                </td>
                                <td style={{ minWidth: 150 }}>
                                  <div className="frp-inline">
                                    <Bar value={e.contactRate || 0} max={100} color="var(--good)" height={7} />
                                    <span>{pctText(e.contactRate)}</span>
                                  </div>
                                </td>
                                <td className="r">{rate(e.avgRating)}</td>
                                <td className="r">{e.flagged || "–"}</td>
                                <td className="r">{e.activeDays || "–"}</td>
                                <td className="r">{e.avgPerActiveDay ?? "–"}</td>
                                <td className="r" style={{ whiteSpace: "nowrap" }}>{lastSeen(e.lastActiveAt)}</td>
                              </tr>
                              {open && (
                                <tr>
                                  <td colSpan={11} style={{ background: "#f8fafc" }}>
                                    {days.length === 0 ? <Empty>No activity.</Empty> : (
                                      <table className="frp-table" style={{ maxWidth: 420 }}>
                                        <thead><tr><th>Date</th><th className="r">Feedback</th><th className="r">Not answered</th><th className="r">Total</th></tr></thead>
                                        <tbody>
                                          {days.map(([d, v]) => (
                                            <tr key={d}>
                                              <td>{fmtD(d)}</td>
                                              <td className="r">{v.c || "–"}</td>
                                              <td className="r">{v.a || "–"}</td>
                                              <td className="r"><b>{v.c + v.a}</b></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                    <div className="sub" style={{ padding: "6px 2px" }}>
                                      Skipped {e.skipped} · Staff/internal {e.internal} · Closed unreachable {e.closedUnreach}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ---------- waiting now ---------- */}
              <Section title="Waiting for a call right now" hint="Live queue. Not affected by the date range above.">
                <div className="frp-strip six">
                  {[
                    ["Delivered", waiting.delivered, "delivered"],
                    ["Repaired, not delivered", waiting.repaired, "repaired"],
                    ["Received / pending", waiting.pending, "pending"],
                    ["Cancelled", waiting.cancelled, "cancelled"],
                    ["Call back due", waiting.callback, "callback"],
                    ["Unanswered, retry", sum.openAttempts, "attempts"],
                  ].map(([label, v, tabKey]) => (
                    <a className="frp-cell link" href={`#${tabKey}`} key={label} onClick={(e) => { e.preventDefault(); setPopup(tabKey); }}>
                      <span className="v">{v ?? 0}</span>
                      <span className="l">{label}</span>
                    </a>
                  ))}
                </div>
              </Section>

              {/* ---------- needs attention ---------- */}
              <Section title="Needs your attention">
                {attention.length === 0 ? (
                  <Empty>Nothing is waiting on you. No escalated cases, no due call backs.</Empty>
                ) : (
                  <ul className="frp-attn">
                    {attention.map((a, i) => (
                      <li key={i} className={a.tone}>
                        <span className="dot" />
                        <span>{a.text}</span>
                        {a.href && <a href={a.href}>Open</a>}
                        {a.popup && <button type="button" className="frp-link" onClick={() => setPopup(a.popup)}>Open</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* ---------- KPIs ---------- */}
              <Section title="This period at a glance" hint={`${fmtD(sum.range.from)} – ${fmtD(sum.range.to)}`}>
                <div className="frp-strip five">
                  <div className="frp-cell">
                    <span className="v good">{sum.totals.collected}</span>
                    <span className="l">Feedback collected</span>
                    <Delta cur={sum.totals.collected} prev={sum.prev.collected} />
                  </div>
                  <div className="frp-cell">
                    <span className="v">{sum.totals.avgRating ? `${sum.totals.avgRating} ★` : "–"}</span>
                    <span className="l">Average rating</span>
                    <Delta cur={sum.totals.avgRating} prev={sum.prev.avgRating} digits={2} />
                  </div>
                  <div className="frp-cell">
                    <span className="v">{pctText(sum.totals.contactRate)}</span>
                    <span className="l">Calls answered ({sum.totals.collected} of {sum.totals.calls})</span>
                    <Delta cur={sum.totals.contactRate} prev={sum.prev.contactRate} unit=" pts" digits={1} />
                  </div>
                  <div className="frp-cell">
                    <span className="v bad">{pctText(sum.totals.flaggedRate)}</span>
                    <span className="l">Feedback flagged ({sum.totals.flagged})</span>
                    <Delta cur={sum.totals.flaggedRate} prev={sum.prev.flaggedRate} unit=" pts" digits={1} invert />
                  </div>
                  <div className="frp-cell">
                    <span className="v">{sum.totals.calls}</span>
                    <span className="l">Calls made ({sum.totals.attempts} not answered)</span>
                    <Delta cur={sum.totals.calls} prev={sum.prev.calls} />
                  </div>
                </div>
              </Section>

              {/* ---------- trend + ratings ---------- */}
              <div className="frp-grid two-one">
                <Section title="Calls per day" hint="Answered feedback and calls nobody picked up.">
                  <TrendChart daily={sum.daily} />
                </Section>
                <Section title="Ratings" hint="Overall rating given by customers.">
                  <RatingBars dist={sum.ratingDist} avg={sum.totals.avgRating} />
                </Section>
              </div>

              {/* ---------- by type + flags ---------- */}
              <div className="frp-grid one-one">
                <Section title="By type of job">
                  {scenarioRows.length === 0 ? <Empty>No feedback collected in this period.</Empty> : (
                    <div className="table-responsive">
                      <table className="frp-table">
                        <thead>
                          <tr><th>Type</th><th className="r">Collected</th><th className="r">Avg rating</th><th className="r">Flagged</th></tr>
                        </thead>
                        <tbody>
                          {scenarioRows.map((s) => {
                            const v = sum.byScenario[s.key];
                            return (
                              <tr key={s.key}>
                                <td>{s.label}</td>
                                <td className="r">{v.collected}</td>
                                <td className="r">{rate(v.avgRating)}</td>
                                <td className="r">{v.flagged || "–"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                <Section title="What went wrong" hint="Flags raised automatically from customer answers.">
                  {flagList.length === 0 ? <Empty>No flags in this period.</Empty> : (
                    <div>
                      {flagList.map(([k, v]) => (
                        <div className="frp-frow" key={k}>
                          <span className="k">{FLAG_LABEL[k] || k}</span>
                          <Bar value={v} max={flagMax} color={SERIOUS_FLAGS.has(k) ? "var(--brand)" : "var(--warn)"} height={8} />
                          <span className="v">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              {/* ---------- question-wise ---------- */}
              <Section title="What customers said" hint="Answer breakdown for each question asked on the call.">
                {qHave.length === 0 ? (
                  <Empty>No answers recorded in this period yet.</Empty>
                ) : (
                  <>
                    <div className="frp-tabs" role="tablist">
                      {qHave.map((s) => (
                        <button key={s.key} type="button" role="tab" aria-selected={qTab === s.key}
                          className={qTab === s.key ? "on" : ""} onClick={() => setQTab(s.key)}>
                          {s.label}
                          <em>{sum.byScenario[s.key]?.collected || 0}</em>
                        </button>
                      ))}
                    </div>
                    <div className="frp-qgrid">
                      {(sum.questions[qTab] || []).map((q) => <QuestionRow key={q.key} q={q} />)}
                    </div>
                  </>
                )}
              </Section>

              {/* ---------- service quality ---------- */}
              <Section
                title="Service quality"
                hint="Rating customers gave, grouped by who handled the job. Marked 'Watch' when the average is below 4 with at least 3 reviews."
                right={
                  <div className="frp-seg small" role="group" aria-label="Group by">
                    <button type="button" className={qualityBy === "engineer" ? "on" : ""} onClick={() => setQualityBy("engineer")}>Engineer</button>
                    <button type="button" className={qualityBy === "rep" ? "on" : ""} onClick={() => setQualityBy("rep")}>Service rep</button>
                  </div>
                }
              >
                {qualityList.length === 0 ? <Empty>No feedback collected in this period.</Empty> : (
                  <div className="table-responsive">
                    <table className="frp-table">
                      <thead>
                        <tr>
                          <th>{qualityBy === "engineer" ? "Engineer" : "Service rep"}</th>
                          <th className="r">Feedback</th>
                          <th style={{ minWidth: 160 }}>Avg rating</th>
                          <th className="r">Low ratings (1–2)</th>
                          <th className="r">Flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...qualityList]
                          .sort((a, b) => (a.avgRating ?? 6) - (b.avgRating ?? 6) || b.collected - a.collected)
                          .map((r) => {
                            const watch = r.avgRating !== null && r.avgRating < 4 && r.collected >= 3;
                            return (
                              <tr key={r.name}>
                                <td>
                                  <b>{r.name}</b>
                                  {watch && <span className="frp-chip bad">Watch</span>}
                                </td>
                                <td className="r">{r.collected}</td>
                                <td>
                                  <div className="frp-inline">
                                    <Bar value={r.avgRating || 0} max={5}
                                      color={watch ? "var(--brand)" : "var(--good)"} height={7} />
                                    <span>{rate(r.avgRating)}</span>
                                  </div>
                                </td>
                                <td className="r">{r.low || "–"}</td>
                                <td className="r">{r.flagged || "–"}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ---------- cases + exclude ---------- */}
              <div className="frp-grid one-one">
                <Section title="Delivery dispute cases" hint="Cases raised when a customer says the device was not received."
                  right={<a className="frp-link" href="/cases">Open cases</a>}>
                  <div className="frp-ledger">
                    <div><span>Raised in this period</span><b>{sum.cases.created}</b></div>
                    <div><span>Waiting for rep's reply</span><b>{sum.cases.open}</b></div>
                    <div><span>Replied, waiting to close</span><b>{sum.cases.awaitingClose}</b></div>
                    <div className={sum.cases.escalated ? "alert-row" : ""}><span>Escalated to admin</span><b>{sum.cases.escalated}</b></div>
                  </div>
                </Section>

                <Section title="Internal / staff numbers" hint="These numbers are never called for feedback.">
                  {excl.length === 0 ? <Empty>No numbers excluded. Use "Staff / Internal" on a call screen to add one.</Empty> : (
                    <div className="table-responsive">
                      <table className="frp-table">
                        <thead>
                          <tr><th>Name</th><th>Number</th><th>Added by</th><th>Date</th><th /></tr>
                        </thead>
                        <tbody>
                          {excl.map((x) => (
                            <tr key={x._id}>
                              <td>{x.customerName || "-"}</td>
                              <td>{x.phone}</td>
                              <td>{x.addedBy?.name || "-"}</td>
                              <td>{fmtD(x.createdAt)}</td>
                              <td className="r">
                                <button type="button" className="frp-btn ghost danger" onClick={() => removeExclude(x._id)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- styles (scoped to .frp) ---------- */
const CSS = `
.frp { --ink:#0f172a; --body:#334155; --mute:#64748b; --line:#e2e8f0; --paper:#f1f5f9; --surface:#fff;
       --brand:#B91C1C; --good:#15803d; --warn:#b45309; --info:#0369a1; font-variant-numeric: tabular-nums; }
.frp * { box-sizing: border-box; }

.frp-top { background: var(--brand); color:#fff; padding: 12px 22px; display:flex; align-items:center; gap:12px; }
.frp-top .brand { font-weight: 800; font-size: 18px; letter-spacing:.3px; }
.frp-top .tag { background: rgba(255,255,255,.2); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
.frp-top .sep { width:1px; height:18px; background: rgba(255,255,255,.4); }
.frp-top .page { font-weight: 700; font-size: 16px; }

.frp-wrap { padding: 18px 22px 48px; max-width: 1280px; }

/* toolbar */
.frp-toolbar { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:flex-end; margin-bottom: 18px; }
.frp-seg { display:inline-flex; background: var(--surface); border:1px solid var(--line); border-radius: 10px; padding: 3px; }
.frp-seg button { border:0; background:transparent; color: var(--body); font-size:.82rem; font-weight:600; padding: 7px 14px; border-radius: 8px; }
.frp-seg button:hover { background: var(--paper); }
.frp-seg button.on { background: var(--ink); color:#fff; }
.frp-seg.small button { padding: 5px 12px; font-size:.78rem; }
.frp-dates { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.frp-dates label { display:flex; flex-direction:column; font-size:.72rem; font-weight:600; color: var(--mute); gap:3px; }
.frp-dates input { border:1px solid var(--line); border-radius:8px; padding: 6px 9px; font-size:.84rem; color: var(--ink); background: var(--surface); }
.frp-btn { border:0; background: var(--ink); color:#fff; border-radius:8px; padding: 8px 14px; font-size:.82rem; font-weight:600; white-space:nowrap; }
.frp-btn:disabled { opacity:.6; }
.frp-btn.ghost { background: var(--surface); color: var(--body); border:1px solid var(--line); padding: 4px 10px; font-size:.76rem; }
.frp-btn.ghost.danger { color: var(--brand); border-color:#fecaca; }
.frp-btn.ghost.danger:hover { background:#fef2f2; }
.frp-asof { margin-left:auto; font-size:.76rem; color: var(--mute); display:flex; flex-direction:column; align-items:flex-end; gap:2px; }

/* sections */
.frp-sec { background: var(--surface); border:1px solid var(--line); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; min-width:0; }
.frp-sec-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom: 14px; }
.frp-sec-head h2 { font-size: 1rem; font-weight: 700; color: var(--ink); margin:0; }
.frp-sec-head p { font-size:.78rem; color: var(--mute); margin: 3px 0 0; }
.frp-link { font-size:.8rem; font-weight:600; color: var(--brand); text-decoration:none; white-space:nowrap; }
.frp-link:hover { text-decoration: underline; }
.frp-empty { border:1px dashed #cbd5e1; border-radius:10px; padding: 18px; font-size:.85rem; color: var(--mute); text-align:center; }

.frp-grid { display:grid; gap:16px; }
.frp-grid.two-one { grid-template-columns: minmax(0,2fr) minmax(0,1fr); }
.frp-grid.one-one { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
.frp-grid > .frp-sec { margin-bottom: 0; }
.frp-grid + .frp-sec, .frp-grid + .frp-grid, .frp-sec + .frp-grid { margin-top: 16px; }
@media (max-width: 1000px) { .frp-grid.two-one, .frp-grid.one-one { grid-template-columns: 1fr; } }

/* number strips */
.frp-strip { display:grid; border:1px solid var(--line); border-radius: 12px; overflow:hidden; }
.frp-strip.six  { grid-template-columns: repeat(6, minmax(0,1fr)); }
.frp-strip.five { grid-template-columns: repeat(5, minmax(0,1fr)); }
@media (max-width: 1100px) { .frp-strip.six, .frp-strip.five { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 600px)  { .frp-strip.six, .frp-strip.five { grid-template-columns: repeat(2, minmax(0,1fr)); } }
.frp-cell { display:flex; flex-direction:column; gap:4px; padding: 14px 16px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); margin: 0 -1px -1px 0; text-decoration:none; }
.frp-cell .v { font-size: 1.85rem; font-weight: 700; line-height:1.1; color: var(--ink); }
.frp-cell .v.good { color: var(--good); }
.frp-cell .v.bad { color: var(--brand); }
.frp-cell .l { font-size:.78rem; color: var(--body); }
.frp-cell.link:hover { background: #f8fafc; }
.frp-cell.link:focus-visible, .frp-seg button:focus-visible, .frp-btn:focus-visible, .frp-tabs button:focus-visible, .frp-table th.sortable:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }
.frp-delta { font-size:.72rem; font-weight:600; }
.frp-delta.good { color: var(--good); }
.frp-delta.bad { color: var(--brand); }
.frp-delta.muted { color: var(--mute); font-weight:500; }

/* attention */
.frp-attn { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.frp-attn li { display:flex; align-items:center; gap:10px; padding: 10px 12px; border-radius:10px; font-size:.86rem; background:#f8fafc; border:1px solid var(--line); }
.frp-attn li .dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; background: var(--mute); }
.frp-attn li.bad  { background:#fef2f2; border-color:#fecaca; } .frp-attn li.bad .dot  { background: var(--brand); }
.frp-attn li.warn { background:#fffbeb; border-color:#fde68a; } .frp-attn li.warn .dot { background:#d97706; }
.frp-attn li.info { background:#f0f9ff; border-color:#bae6fd; } .frp-attn li.info .dot { background: var(--info); }
.frp-attn li a { margin-left:auto; font-size:.78rem; font-weight:600; color: var(--ink); }

/* chart + legend */
.frp-chart { width:100%; height:auto; display:block; }
.frp-legend { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:.76rem; color: var(--body); margin-top: 8px; }
.frp-legend i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:6px; }
.frp-legend .muted { color: var(--mute); }

/* bars */
.frp-bar { width:100%; background:#eef2f7; border-radius: 99px; overflow:hidden; }
.frp-bar span { display:block; height:100%; border-radius:99px; }
.frp-avg { display:flex; align-items:baseline; gap:10px; margin-bottom: 12px; }
.frp-avg .n { font-size: 2rem; font-weight:700; color: var(--ink); }
.frp-avg .s { font-size:.78rem; color: var(--mute); }
.frp-rrow { display:grid; grid-template-columns: 38px 1fr 64px; gap:10px; align-items:center; margin-bottom:8px; font-size:.82rem; }
.frp-rrow .star { color: var(--body); font-weight:600; }
.frp-rrow .cnt { text-align:right; font-weight:700; color: var(--ink); }
.frp-rrow .cnt em { font-style:normal; font-weight:500; color: var(--mute); margin-left:5px; font-size:.74rem; }
.frp-frow { display:grid; grid-template-columns: minmax(120px, 1.2fr) 2fr 34px; gap:10px; align-items:center; margin-bottom:10px; font-size:.84rem; }
.frp-frow .v { text-align:right; font-weight:700; }

/* tabs */
.frp-tabs { display:flex; gap:6px; overflow-x:auto; margin-bottom: 14px; padding-bottom: 2px; }
.frp-tabs button { border:1px solid var(--line); background: var(--surface); color: var(--body); font-size:.82rem; font-weight:600; border-radius: 99px; padding: 6px 14px; white-space:nowrap; }
.frp-tabs button em { font-style:normal; margin-left:6px; font-size:.72rem; color: var(--mute); }
.frp-tabs button.on { background: var(--ink); color:#fff; border-color: var(--ink); }
.frp-tabs button.on em { color:#cbd5e1; }

/* questions */
.frp-qgrid { display:grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
.frp-q { border:1px solid var(--line); border-radius: 12px; padding: 12px 14px; display:flex; flex-direction:column; gap:8px; }
.frp-q-text { font-size:.84rem; font-weight:600; color: var(--ink); display:flex; justify-content:space-between; gap:10px; }
.frp-q-text .n { font-weight:500; color: var(--mute); font-size:.72rem; white-space:nowrap; }
.frp-q-vals { font-size:.78rem; color: var(--body); }
.frp-split { display:flex; height:10px; border-radius:99px; overflow:hidden; background:#eef2f7; }
.frp-split span { display:block; height:100%; }
.frp-opt { display:grid; grid-template-columns: minmax(70px, 1fr) 1.4fr 70px; gap:8px; align-items:center; font-size:.78rem; }
.frp-opt .v { text-align:right; color: var(--mute); }

/* tables */
.frp-table { width:100%; border-collapse: collapse; font-size:.86rem; color: var(--body); }
.frp-table th { text-align:left; font-size:.76rem; font-weight:700; color: var(--mute); padding: 8px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
.frp-table th.sortable { cursor:pointer; user-select:none; }
.frp-table th.sortable:hover { color: var(--ink); }
.frp-table td { padding: 10px; border-bottom:1px solid #f1f5f9; vertical-align: middle; }
.frp-table tr:last-child td { border-bottom:0; }
.frp-table .r { text-align:right; }
.frp-table td b { color: var(--ink); }
.frp-table .sub { font-size:.72rem; color: var(--mute); margin-top:2px; }
.frp-inline { display:flex; align-items:center; gap:10px; }
.frp-inline > span { font-weight:700; color: var(--ink); min-width: 40px; text-align:right; }
.frp-chip { margin-left:8px; font-size:.68rem; font-weight:700; padding: 2px 8px; border-radius:99px; }
.frp-chip.bad { background:#fee2e2; color: var(--brand); }

/* ledger */
.frp-ledger > div { display:flex; justify-content:space-between; align-items:center; padding: 11px 2px; border-bottom:1px solid #f1f5f9; font-size:.88rem; color: var(--body); }
.frp-ledger > div:last-child { border-bottom:0; }
.frp-ledger b { font-size:1.15rem; color: var(--ink); }
.frp-ledger .alert-row b { color: var(--brand); }

.frp-link { margin-left:auto; border:0; background:transparent; font-weight:700; font-size:.82rem; color: var(--ink); text-decoration:underline; cursor:pointer; padding:0; }
.frp-modal-bg { position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:1050; padding:16px; }
.frp-modal { background:#fff; border-radius:14px; width:min(920px,100%); max-height:85vh; overflow:auto; padding:20px; box-shadow:0 20px 50px rgba(15,23,42,.3); }
.frp-modal-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; }
.frp-modal-head h2 { font-size:1.05rem; margin:0; color: var(--ink); }
.frp-modal-head p { margin:2px 0 0; font-size:.8rem; color: var(--mute); }
.frp-x { border:0; background:#f1f5f9; border-radius:8px; width:32px; height:32px; cursor:pointer; }

@media (prefers-reduced-motion: no-preference) { .frp-bar span { transition: width .35s ease; } }
`;

export default FeedbackReportPage;