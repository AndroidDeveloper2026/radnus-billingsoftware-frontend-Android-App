import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import JobSheetSidebar from "./JobSheetSidebar";

const API = import.meta.env.VITE_API_URL;

const OUTCOMES = [
  { key: "delivery_confirmed", label: "✅ Delivery confirmed (note who collected it and when)" },
  { key: "customer_confusion", label: "ℹ️ Customer confusion (a family member / someone else collected it)" },
  { key: "status_wrong",       label: "✏️ Status marked wrongly — device is still in the shop" },
  { key: "device_missing",     label: "🔴 Device missing (escalate to admin)" },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.key, o.label]));

const STATUS_CLASS = { open: "red", seen: "amber", resolved: "green", closed: "grey" };
const STATUS_LABEL = { open: "New", seen: "Seen", resolved: "Rep replied", closed: "Closed" };
const SLA_BADGE = { reminder: ["amber", "⏰ 24h+"], escalated: ["red", "🔥 Escalated"] };

const fmtDT = (d) => (d ? new Date(d).toLocaleString("en-GB") : "-");
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

// 9894015223 -> 98940 15223
const fmtPhone = (p = "") => {
  const d = String(p).replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
};
const copyPhone = async (p) => {
  const d = String(p).replace(/\D/g, "").slice(-10);
  try {
    await navigator.clipboard.writeText(d);
  } catch {
    const t = document.createElement("textarea");
    t.value = d;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }
};
const initialsOf = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "#";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

/* ---------- STYLES ---------- */
const CASES_CSS = `
.cs-top    { background: linear-gradient(90deg, #B91C1C, #991B1B); color: #fff; padding: 14px 28px; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 2px 8px rgba(127,29,29,.25); }
.cs-brand  { font-weight: 800; font-size: 1.15rem; letter-spacing: .5px; }
.cs-tag    { background: rgba(255,255,255,.18); font-size: .62rem; font-weight: 700; padding: 3px 9px; border-radius: 6px; letter-spacing: .08em; }
.cs-sep    { width: 1px; height: 18px; background: rgba(255,255,255,.35); }
.cs-page   { font-weight: 600; font-size: 1rem; opacity: .95; }
.cs-wrap   { padding: 26px 28px 40px; max-width: 1600px; }

.cs-bar    { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.cs-tabs   { display: flex; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 6px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.cs-tab    { border: 0; background: transparent; color: #475569; font-weight: 600; font-size: .88rem; padding: 9px 20px; border-radius: 10px; transition: all .15s; }
.cs-tab:hover { background: #f1f5f9; color: #0f172a; }
.cs-tab.on { background: #B91C1C; color: #fff; box-shadow: 0 3px 8px rgba(185,28,28,.3); }
.cs-right  { display: flex; align-items: center; gap: 12px; }
.cs-total  { font-size: .8rem; color: #64748b; font-weight: 600; }
.cs-refresh { border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 10px; padding: 8px 16px; font-size: .82rem; font-weight: 600; height: 38px; }
.cs-refresh:hover { background: #1e293b; }

.cs-card   { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.cs-table thead th { background: #f8fafc; color: #64748b; font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 13px 18px; white-space: nowrap; }
.cs-table tbody td { padding: 15px 18px; font-size: .86rem; border-color: #f1f5f9; vertical-align: middle; }
.cs-table tbody tr { cursor: pointer; transition: background .12s; }
.cs-table tbody tr:hover { background: #f8fafc; }
.cs-caseno { font-weight: 800; color: #0f172a; }
.cs-job    { font-weight: 700; color: #334155; }
.cs-cust   { font-weight: 600; color: #0f172a; text-transform: uppercase; font-size: .84rem; }
.cs-cust small { display: block; font-weight: 500; color: #94a3b8; text-transform: none; letter-spacing: .03em; font-variant-numeric: tabular-nums; margin-top: 1px; }
.cs-person { display: flex; align-items: center; gap: 9px; white-space: nowrap; }
.cs-av     { width: 28px; height: 28px; border-radius: 8px; background: #e2e8f0; color: #475569; font-size: .68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.cs-av.admin { background: #0f172a; color: #fff; }
.cs-outcome { font-size: .8rem; color: #475569; max-width: 320px; }
.cs-empty  { text-align: center; color: #64748b; padding: 70px 20px; font-weight: 600; }
.cs-empty .big { font-size: 36px; margin-bottom: 6px; }

.cs-badge  { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 99px; font-size: .72rem; font-weight: 700; border: 1px solid transparent; white-space: nowrap; }
.cs-badge.red   { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.cs-badge.amber { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.cs-badge.green { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.cs-badge.grey  { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.cs-badge.dark  { background: #0f172a; color: #fff; }
.cs-age    { font-weight: 700; font-size: .8rem; color: #475569; background: #f1f5f9; border-radius: 8px; padding: 3px 9px; white-space: nowrap; }
.cs-age.warn { background: #fef3c7; color: #92400e; }

/* ===== detail modal ===== */
.cs-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.6); backdrop-filter: blur(2px); z-index: 1060; overflow-y: auto; padding: 24px 10px; }
.cs-modal  { max-width: 920px; margin: 0 auto; background: #fff; color: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(15,23,42,.35); }
.cs-mhead  { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px 28px; border-bottom: 1px solid #e2e8f0; }
.cs-mtitle { margin: 0; font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.cs-x      { border: 0; background: #f1f5f9; color: #475569; width: 34px; height: 34px; border-radius: 10px; font-size: 1.1rem; line-height: 1; }
.cs-x:hover { background: #e2e8f0; }
.cs-mbody  { padding: 26px 28px; max-height: 78vh; overflow-y: auto; background: #f8fafc; }
.cs-sec    { font-size: .68rem; text-transform: uppercase; letter-spacing: .09em; font-weight: 700; color: #64748b; margin-bottom: 12px; }
.cs-box    { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 22px; }
.cs-grid   { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 28px; }
.cs-kv .k  { font-size: .66rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; margin-bottom: 3px; }
.cs-kv .v  { font-size: .9rem; font-weight: 600; color: #0f172a; word-break: break-word; }
.cs-phone  { display: inline-flex; align-items: center; gap: 8px; }
.cs-copy   { border: 0; background: #0f172a; color: #fff; border-radius: 8px; padding: 3px 10px; font-size: .72rem; font-weight: 600; }
.cs-copy.copied { background: #16a34a; }
.cs-log    { margin-top: 18px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
.cs-log div { font-size: .8rem; color: #64748b; padding: 3px 0 3px 14px; border-left: 2px solid #e2e8f0; margin-left: 4px; }
.cs-ghost  { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 10px; padding: 8px 14px; font-size: .82rem; font-weight: 600; }
.cs-ghost:hover { background: #f1f5f9; }

.cs-msg    { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 12px; font-size: .88rem; }
.cs-msg.system { background: #f1f5f9; color: #64748b; }
.cs-msg.reply  { border-color: #86efac; background: #f0fdf4; }
.cs-msg-top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-size: .8rem; }
.cs-msg-top .role { color: #94a3b8; font-weight: 500; }
.cs-msg-top .at { color: #94a3b8; white-space: nowrap; }
.cs-msg .out { font-weight: 700; color: #15803d; margin-bottom: 4px; }

.cs-form   { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 22px; }
.cs-form.reply { border-color: #86efac; }
.cs-opt    { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 8px; cursor: pointer; font-size: .85rem; transition: all .12s; }
.cs-opt:hover { background: #f8fafc; }
.cs-opt.on { border-color: #16a34a; background: #f0fdf4; }
.cs-opt input { margin-top: 3px; }
.cs-modal .form-control { border-radius: 10px; border-color: #dbe2ea; }
.cs-modal .form-control:focus { border-color: #B91C1C; box-shadow: 0 0 0 3px rgba(185,28,28,.12); }
.cs-modal .btn { border-radius: 10px; font-weight: 600; }
.cs-modal .alert { border-radius: 12px; padding: 14px 18px; }

@media (max-width: 575.98px) {
  .cs-top  { padding: 12px 16px; }
  .cs-wrap { padding: 16px 14px 30px; }
  .cs-mhead, .cs-mbody { padding-left: 16px; padding-right: 16px; }
  .cs-grid { grid-template-columns: 1fr; gap: 14px; }
  .cs-overlay { padding: 0; }
  .cs-modal { border-radius: 0; min-height: 100vh; }
}
`;

/* ---------- DETAIL ---------- */
const CaseDetail = ({ id, onClose, onChanged }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState("");
  const [copied, setCopied] = useState(false);     // UI only

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/cases/${id}`);
      setData(r.data);
      onChanged();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (path, body, okReset = true) => {
    setBusy(true);
    try {
      await axios.post(`${API}/api/cases/${id}/${path}`, body);
      if (okReset) { setText(""); setOutcome(""); }
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
    } finally {
      setBusy(false);
    }
  };

  const c = data?.case;
  const job = data?.job;
  const perm = data?.perm;

  const onCopy = async () => {
    await copyPhone(c.contact);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cs-overlay">
      <div className="cs-modal">
        <div className="cs-mhead">
          <h5 className="cs-mtitle">
            {c ? `Case #${c.caseNo} · ${c.jobSheetNo}` : "Case"}
            {c && <span className={`cs-badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>}
          </h5>
          <button type="button" className="cs-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="cs-mbody">
          {error && <div className="alert alert-danger">{error}</div>}
          {!data && !error && <div className="text-muted">Loading...</div>}

          {data && (
            <>
              {c.routedTo === "admin" && (
                <div className="alert alert-warning small mb-4">
                  Routed to admin: {c.routeNote || "-"}
                </div>
              )}

              {/* JOB INFO */}
              <div className="cs-sec">Job details</div>
              <div className="cs-box">
                <div className="cs-grid">
                  <div className="cs-kv">
                    <div className="k">Customer</div>
                    <div className="v">
                      {c.customerName}
                      {c.contact && (
                        <span className="cs-phone ms-2">
                          <span>{fmtPhone(c.contact)}</span>
                          <button type="button" className={`cs-copy ${copied ? "copied" : ""}`} onClick={onCopy}>
                            {copied ? "✓ Copied" : "📋 Copy"}
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cs-kv"><div className="k">Device</div><div className="v">{job?.device?.make} {job?.device?.model}</div></div>
                  <div className="cs-kv"><div className="k">Job status</div><div className="v">{job?.device?.mobileStatus || "-"}</div></div>
                  <div className="cs-kv"><div className="k">Delivery date</div><div className="v">{fmt(job?.service?.deliveryDate)}</div></div>
                  <div className="cs-kv"><div className="k">Engineer</div><div className="v">{job?.service?.engineer || "-"}</div></div>
                  <div className="cs-kv"><div className="k">Service rep</div><div className="v">{job?.service?.serviceRep || "-"}</div></div>
                  <div className="cs-kv"><div className="k">Job created by</div><div className="v">{job?.createdBy?.username || "-"} on {fmt(job?.createdAt)}</div></div>
                </div>

                {job?.statusLogs?.length > 0 && (
                  <div className="cs-log">
                    <div className="cs-sec" style={{ marginBottom: 8 }}>Status log</div>
                    {job.statusLogs.map((l, i) => (
                      <div key={i}>{l.status} — {l.updatedBy || "-"} · {fmtDT(l.timestamp)}</div>
                    ))}
                  </div>
                )}

                {(perm.isAdmin || perm.isAssignee) && (
                  <button type="button" className="cs-ghost mt-3" onClick={() => navigate(`/jobsheet/${c.jobSheet}`)}>
                    Open Job Sheet →
                  </button>
                )}
              </div>

              {/* THREAD */}
              <div className="cs-sec">Conversation</div>
              <div className="mb-4">
                {c.messages.map((m, i) => (
                  <div key={i} className={`cs-msg ${m.kind === "system" ? "system" : m.kind === "reply" ? "reply" : ""}`}>
                    <div className="cs-msg-top">
                      <b>{m.by?.name || "-"} <span className="role">({m.by?.role})</span></b>
                      <span className="at">{fmtDT(m.at)}</span>
                    </div>
                    {m.outcome && <div className="out">{OUTCOME_LABEL[m.outcome]}</div>}
                    {m.text && <div>{m.text}</div>}
                  </div>
                ))}
              </div>

              {perm.adminReadOnly && c.status !== "closed" && (
                <div className="alert alert-secondary small mb-0">
                  View only. This case is being handled by {c.assignedTo?.name || "the rep"}.
                  You will be able to act on it if it is escalated.
                </div>
              )}

              {/* REP REPLY */}
              {perm.canResolve && (
                <div className="cs-form reply">
                  <div className="cs-sec">Reply (outcome)</div>
                  {OUTCOMES.map((o) => (
                    <label className={`cs-opt ${outcome === o.key ? "on" : ""}`} key={o.key} htmlFor={o.key}>
                      <input className="form-check-input" type="radio" id={o.key} name="outcome"
                        checked={outcome === o.key} onChange={() => setOutcome(o.key)} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                  <textarea className="form-control form-control-sm my-3" rows={3}
                    placeholder="Details (who collected it, when, any evidence...)"
                    value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn btn-sm btn-success" disabled={busy || !outcome}
                    onClick={() => act("resolve", { outcome, text })}>Send reply</button>
                </div>
              )}

              {/* CREATOR HINT */}
              {perm.isCreator && c.status === "resolved" && (
                <div className="alert alert-success small mb-4">
                  The rep has replied. Please call the customer and inform them, then close the case below.
                </div>
              )}

              {/* MESSAGE / CLOSE */}
              {perm.canMessage && (
                <div className="cs-form mb-0">
                  <textarea className="form-control form-control-sm mb-3" rows={3}
                    placeholder={perm.canClose ? "Message / closing note" : "Message"}
                    value={perm.canResolve ? "" : text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={perm.canResolve} />
                  {!perm.canResolve && (
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-dark" disabled={busy || !text.trim()}
                        onClick={() => act("message", { text })}>Send message</button>
                      {perm.canClose && (
                        <button className="btn btn-sm btn-outline-danger" disabled={busy}
                          onClick={() => act("close", { text })}>Close case</button>
                      )}
                    </div>
                  )}
                  {perm.canResolve && perm.canClose && (
                    <button className="btn btn-sm btn-outline-danger" disabled={busy}
                      onClick={() => act("close", { text: "Closed by admin" })}>Close case (admin)</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- PAGE ---------- */
const CasesPage = () => {
  const [scope, setScope] = useState("active");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await axios.get(`${API}/api/cases`, { params: { scope } });
      setList(r.data);
    } catch (e) {
      setError(`${e.response?.status || ""} ${e.response?.data?.message || e.message}`);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{CASES_CSS}</style>
      <JobSheetSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cs-top">
          <span className="cs-brand">RADNUS</span>
          <span className="cs-tag">SERVICE PRO</span>
          <span className="cs-sep" />
          <span className="cs-page">Cases</span>
        </div>

        <div className="cs-wrap text-dark">
          <div className="cs-bar">
            <div className="cs-tabs">
              {[["active", "Active"], ["closed", "Closed"]].map(([k, l]) => (
                <button key={k} type="button" className={`cs-tab ${scope === k ? "on" : ""}`}
                  onClick={() => setScope(k)}>{l}</button>
              ))}
            </div>
            <div className="cs-right">
              <span className="cs-total">{list.length} case(s)</span>
              <button type="button" className="cs-refresh" onClick={load}>↻ Refresh</button>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="cs-card">
            <div className="table-responsive">
              <table className="table cs-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Case</th><th>Job</th><th>Customer</th><th>Status</th>
                    <th>Assigned to</th><th>Raised by</th><th>Age</th><th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c._id} onClick={() => setOpenId(c._id)}>
                      <td className="cs-caseno">#{c.caseNo}</td>
                      <td className="cs-job">{c.jobSheetNo}</td>
                      <td>
                        <div className="cs-cust">
                          {c.customerName}
                          <small>{c.contact ? fmtPhone(c.contact) : ""}</small>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          <span className={`cs-badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                          {SLA_BADGE[c.sla] && <span className={`cs-badge ${SLA_BADGE[c.sla][0]}`}>{SLA_BADGE[c.sla][1]}</span>}
                          {c.escalated && <span className="cs-badge red">🔴 Device missing</span>}
                        </div>
                      </td>
                      <td>
                        {c.assignedTo?.name ? (
                          <span className="cs-person"><span className="cs-av">{initialsOf(c.assignedTo.name)}</span>{c.assignedTo.name}</span>
                        ) : (
                          <span className="cs-person"><span className="cs-av admin">A</span><span className="text-muted">Admin</span></span>
                        )}
                      </td>
                      <td>
                        {c.createdBy?.name && (
                          <span className="cs-person"><span className="cs-av">{initialsOf(c.createdBy.name)}</span>{c.createdBy.name}</span>
                        )}
                      </td>
                      <td><span className={`cs-age ${c.ageHours >= 24 ? "warn" : ""}`}>{c.ageHours}h</span></td>
                      <td className="cs-outcome">{c.outcome ? OUTCOME_LABEL[c.outcome] : "-"}</td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr style={{ cursor: "default" }}>
                      <td colSpan={8}>
                        <div className="cs-empty"><div className="big">🎉</div>No cases</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {openId && <CaseDetail id={openId} onClose={() => { setOpenId(null); load(); }} onChanged={load} />}
    </div>
  );
};

export default CasesPage;