import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import JobSheetSidebar from "./JobSheetSidebar";

const API = import.meta.env.VITE_API_URL;
const RED = "#B91C1C";

const TABS = [
  { key: "delivered", label: "Delivered" },
  { key: "repaired", label: "Repaired (Not Delivered)" },
  { key: "pending", label: "Received / Pending" },
  { key: "cancelled", label: "Cancelled" },
  { key: "callback", label: "Call Back" },
  { key: "attempts", label: "Attempts" },
  { key: "done", label: "Done" },
];

const SCENARIO_LABEL = {
  delivered: "Delivered", delivered_nrna: "Delivered NR/NA",
  repaired: "Repaired", pending: "Pending", cancelled: "Cancelled",
};

const FLAG_LABEL = {
  delivery_dispute: "⚠️ Delivery dispute", low_rating: "Low rating",
  repeat_issue: "Repeat issue", issue_not_fixed: "Issue not fixed",
  billing_complaint: "Billing complaint", not_informed: "Not informed",
  delay_not_explained: "Delay not explained", wants_cancel: "Wants to cancel",
  charge_complaint: "Charge complaint", accessories_missing: "Accessories missing",
  home_delivery_request: "Home delivery",
};

const ATTEMPT_OPTIONS = [
  { key: "not_answered", label: "Not Answered" },
  { key: "busy", label: "Busy" },
  { key: "switched_off", label: "Switched Off" },
  { key: "callback", label: "Call Back Later" },
  { key: "wrong_number", label: "Wrong Number" },
];

const ATTEMPT_LABEL = Object.fromEntries(ATTEMPT_OPTIONS.map((o) => [o.key, o.label]));

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
const fmtDT = (d) => (d ? new Date(d).toLocaleString("en-GB", { hour12: true }) : "-");   // ✅ 12-hour (4:58:37 pm)
const sameStr = (a, b) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

// Oldest job sheet first
const byReceived = (a, b) => new Date(a.receivedAt || 0) - new Date(b.receivedAt || 0);

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
    // old browser / http fallback
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
  if (!parts.length || name === "-") return "#";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

/* ---------- RESPONSIVE STYLES (layout only) ---------- */
const FEEDBACK_CSS = `
/* ===== overlay + shell ===== */
.fb-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(2px); z-index: 1060; overflow-y: auto; padding: 24px 10px; }
.fb-modal   { max-width: 1120px; margin: 0 auto; border-radius: 16px !important; overflow: hidden; box-shadow: 0 24px 60px rgba(15,23,42,0.35); }
.fb-pane    { max-height: 66vh; overflow-y: auto; }
.fb-tabs    { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
.fb-tabs .nav-link { white-space: nowrap; }

/* ===== header ===== */
.fb-head    { background: #fff; padding: 20px 28px; border-bottom: 1px solid #e2e8f0; }
.fb-avatar  { width: 46px; height: 46px; border-radius: 12px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
              background: linear-gradient(135deg, #B91C1C, #7F1D1D); color: #fff; font-weight: 700; font-size: 1rem; letter-spacing: .5px; }
.fb-title   { font-size: 1.15rem; font-weight: 700; color: #0f172a; line-height: 1.2; margin: 0; }
.fb-sub     { font-size: .78rem; color: #64748b; margin-top: 2px; }
.fb-phone   { display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 5px 5px 5px 14px; }
.fb-phone-ico { font-size: 1rem; }
.fb-phone-num { font-size: 1.25rem; font-weight: 700; letter-spacing: .06em; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fb-phone-none { font-size: .85rem; color: #94a3b8; padding: 6px 12px; border: 1px dashed #cbd5e1; border-radius: 12px; }
.fb-copy    { border: 0; background: #0f172a; color: #fff; border-radius: 9px; padding: 7px 14px; font-size: .8rem; font-weight: 600; transition: background .15s; white-space: nowrap; }
.fb-copy:hover { background: #1e293b; }
.fb-copy.copied { background: #16a34a; }
.fb-ghost   { border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 10px; padding: 8px 12px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
.fb-ghost:hover { background: #f1f5f9; }
.fb-ghost:disabled { opacity: .5; }
.fb-x       { border: 0; background: #f1f5f9; color: #475569; width: 34px; height: 34px; border-radius: 10px; font-size: 1.1rem; line-height: 1; }
.fb-x:hover { background: #e2e8f0; }

/* ===== progress + job strip ===== */
.fb-strip-wrap { padding: 16px 28px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.fb-strip-top  { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.fb-strip-lbl  { font-size: .78rem; font-weight: 700; color: #334155; }
.fb-strip-lbl span { color: #64748b; font-weight: 500; }
.fb-progress   { height: 5px; border-radius: 99px; background: #e2e8f0; overflow: hidden; margin-bottom: 14px; }
.fb-progress > span { display: block; height: 100%; background: #16a34a; border-radius: 99px; transition: width .3s; }
.fb-strip   { display: flex; flex-wrap: nowrap; gap: 10px; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }
.fb-pill    { flex: 0 0 auto; white-space: nowrap; text-align: left; min-width: 104px; border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 8px 14px; transition: all .15s; }
.fb-pill:hover { border-color: #94a3b8; }
.fb-pill .no { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: .82rem; color: #0f172a; }
.fb-pill .dt { font-size: .68rem; color: #94a3b8; margin-top: 1px; }
.fb-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; flex: 0 0 auto; }
.fb-pill.done     { background: #f0fdf4; border-color: #86efac; } .fb-pill.done .dot { background: #16a34a; }
.fb-pill.reviewed { background: #f0fdf4; border-color: #bbf7d0; } .fb-pill.reviewed .dot { background: #4ade80; }
.fb-pill.closed   { background: #f0fdf4; border-color: #bbf7d0; } .fb-pill.closed .dot { background: #4ade80; }
.fb-pill.attempted { background: #eff6ff; border-color: #bfdbfe; } .fb-pill.attempted .dot { background: #0ea5e9; }
.fb-pill.skipped  { background: #f1f5f9; border-style: dashed; } .fb-pill.skipped .dot { background: #64748b; }
.fb-pill.other    { background: #f8fafc; opacity: .75; } .fb-pill.other .no { color: #94a3b8; } .fb-pill.other .dot { background: #cbd5e1; }
.fb-pill.active   { background: #0f172a; border-color: #0f172a; opacity: 1; box-shadow: 0 4px 10px rgba(15,23,42,.25); }
.fb-pill.active .no { color: #fff; } .fb-pill.active .dt { color: #cbd5e1; }
.fb-legend  { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 6px; font-size: .72rem; color: #64748b; }
.fb-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }

/* ===== panes ===== */
.fb-left    { background: #f8fafc; }
.fb-right   { background: #fff; }
.fb-modal .row > .fb-left  { padding: 26px 28px !important; }
.fb-modal .row > .fb-right { padding: 26px 30px !important; }
.fb-sec     { font-size: .68rem; text-transform: uppercase; letter-spacing: .09em; font-weight: 700; color: #64748b; margin-bottom: 12px; }
.fb-card    { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; }
.fb-chip    { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 99px; font-size: .74rem; font-weight: 600; border: 1px solid transparent; }
.fb-chip.dark   { background: #0f172a; color: #fff; }
.fb-chip.amber  { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.fb-chip.red    { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.fb-chip.green  { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.fb-chip.grey   { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.fb-chip.slate  { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
.fb-empty   { font-size: .82rem; color: #94a3b8; }

.fb-job-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
.fb-job-no   { font-size: 1.05rem; font-weight: 800; color: #0f172a; }
.fb-grid     { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 28px; }
.fb-kv .k    { margin-bottom: 3px; font-size: .66rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.fb-kv .v    { font-size: .9rem; font-weight: 600; color: #0f172a; word-break: break-word; }
.fb-kv.full  { grid-column: 1 / -1; }

.fb-script   { background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #B91C1C; border-radius: 10px; padding: 16px 20px; font-size: .88rem; color: #334155; line-height: 1.7; }
.fb-script .lbl { display: block; font-size: .66rem; text-transform: uppercase; letter-spacing: .09em; font-weight: 700; color: #B91C1C; margin-bottom: 8px; }

.fb-outcome  { display: flex; flex-wrap: wrap; gap: 10px; }
.fb-out      { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 10px; padding: 10px 18px; font-size: .84rem; font-weight: 600; transition: all .15s; }
.fb-out:hover { background: #f1f5f9; }
.fb-out.yes  { border-color: #16a34a; color: #15803d; }
.fb-out.yes:hover { background: #f0fdf4; }
.fb-out.on   { background: #0f172a; border-color: #0f172a; color: #fff; }
.fb-out.yes.on { background: #16a34a; border-color: #16a34a; color: #fff; }

.fb-attempt  { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 20px; }
.fb-notice   { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; font-size: .84rem; color: #475569; }

/* polish for the forms inside the modal (JobForm / QuestionField) */
.fb-modal .card { border-radius: 12px; border-color: #e2e8f0; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.fb-modal .card-header.bg-light { background: #f8fafc !important; border-bottom: 1px solid #e2e8f0; }
.fb-modal .btn-sm { border-radius: 8px; font-weight: 600; }
.fb-modal .form-control-sm, .fb-modal .form-select-sm { border-radius: 8px; }
.fb-modal table { margin-bottom: 0; }
.fb-modal table th, .fb-modal table td { padding: .6rem .8rem; }
.fb-modal .mb-1 { margin-bottom: .5rem !important; }
.fb-modal .mb-2 { margin-bottom: .85rem !important; }
.fb-modal .mb-3 { margin-bottom: 1.4rem !important; }
.fb-modal .card-header { padding: 14px 20px; }
.fb-modal .card-body   { padding: 20px; }
.fb-modal .form-check  { padding-left: 1.7em; }
.fb-modal .alert       { padding: 14px 18px; }

/* ===== MAIN PAGE ===== */
.fbp-top    { background: linear-gradient(90deg, #B91C1C, #991B1B); color: #fff; padding: 14px 28px; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 2px 8px rgba(127,29,29,.25); }
.fbp-brand  { font-weight: 800; font-size: 1.15rem; letter-spacing: .5px; }
.fbp-tag    { background: rgba(255,255,255,.18); font-size: .62rem; font-weight: 700; padding: 3px 9px; border-radius: 6px; letter-spacing: .08em; }
.fbp-sep    { width: 1px; height: 18px; background: rgba(255,255,255,.35); }
.fbp-page   { font-weight: 600; font-size: 1rem; opacity: .95; }
.fbp-wrap   { padding: 26px 28px 40px; max-width: 1600px; }

.fbp-tabs   { display: flex; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 6px; margin-bottom: 18px; overflow-x: auto; -webkit-overflow-scrolling: touch; width: fit-content; max-width: 100%; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.fbp-tab    { border: 0; background: transparent; color: #475569; font-weight: 600; font-size: .88rem; padding: 9px 16px; border-radius: 10px; white-space: nowrap; display: flex; align-items: center; gap: 8px; transition: all .15s; }
.fbp-tab:hover { background: #f1f5f9; color: #0f172a; }
.fbp-tab.on { background: #B91C1C; color: #fff; box-shadow: 0 3px 8px rgba(185,28,28,.3); }
.fbp-count  { background: #e2e8f0; color: #334155; font-size: .72rem; font-weight: 700; padding: 2px 9px; border-radius: 99px; }
.fbp-tab.on .fbp-count { background: rgba(255,255,255,.25); color: #fff; }

.fbp-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.fbp-f label { display: block; font-size: .66rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: #64748b; margin-bottom: 5px; }
.fbp-filters .form-control { border-radius: 9px; border-color: #dbe2ea; min-height: 38px; }
.fbp-filters .form-control:focus { border-color: #B91C1C; box-shadow: 0 0 0 3px rgba(185,28,28,.12); }
.fbp-refresh { border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 10px; padding: 8px 16px; font-size: .82rem; font-weight: 600; height: 38px; }
.fbp-refresh:hover { background: #1e293b; }
.fbp-note   { font-size: .8rem; color: #64748b; margin: 14px 2px 18px; }
.fbp-loading { font-size: .85rem; color: #64748b; margin-bottom: 12px; }

.fbp-grid   { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px; grid-auto-rows: 1fr; }   /* every card = same height */
.fbp-card   { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.fbp-card:hover { transform: translateY(-2px); border-color: #cbd5e1; box-shadow: 0 10px 24px rgba(15,23,42,.1); }
.fbp-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.fbp-av     { width: 42px; height: 42px; border-radius: 11px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #B91C1C, #7F1D1D); color: #fff; font-weight: 700; font-size: .9rem; }
.fbp-name   { font-weight: 700; color: #0f172a; font-size: 1rem; line-height: 1.25; text-transform: uppercase; }
.fbp-phone  { font-size: .82rem; color: #64748b; font-variant-numeric: tabular-nums; letter-spacing: .03em; margin-top: 1px; }
.fbp-jobs   { flex: 0 0 auto; background: #0f172a; color: #fff; font-size: .72rem; font-weight: 700; padding: 4px 11px; border-radius: 99px; white-space: nowrap; }
.fbp-meta   { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.fbp-list   { border-top: 1px solid #f1f5f9; flex: 1 1 auto; }
.fbp-job    { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.fbp-job-top { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.fbp-job-no { font-weight: 800; color: #0f172a; font-size: .85rem; }
.fbp-job-dev { font-size: .85rem; color: #334155; }
.fbp-job-dates { font-size: .76rem; color: #94a3b8; margin-top: 4px; }
.fbp-more   { font-size: .78rem; color: #64748b; padding: 12px 0 2px; font-weight: 600; }
.fbp-cta    { margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: .8rem; font-weight: 700; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; transition: color .15s; }
.fbp-card:hover .fbp-cta { color: #B91C1C; }

.fbp-table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.fbp-table thead th { background: #f8fafc; color: #64748b; font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; white-space: nowrap; }
.fbp-table tbody td { padding: 13px 16px; font-size: .86rem; border-color: #f1f5f9; }
.fbp-table tbody tr:hover { background: #f8fafc; }
.fbp-empty  { text-align: center; color: #64748b; padding: 70px 20px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 16px; font-weight: 600; }

@media (max-width: 575.98px) {
  .fbp-top  { padding: 12px 16px; }
  .fbp-wrap { padding: 16px 14px 30px; }
  .fbp-grid { grid-template-columns: 1fr; gap: 14px; }
  .fbp-filters { padding: 14px; }
  .fbp-f { flex: 1 1 140px; }
}

/* ===== responsive ===== */
@media (max-width: 991.98px) {
  /* bottom padding keeps the last content clear of the mobile browser bar / home indicator */
  .fb-overlay { padding: 0 0 calc(90px + env(safe-area-inset-bottom, 0px)); -webkit-overflow-scrolling: touch; }
  /* overflow must be visible, otherwise position:sticky inside the modal never sticks */
  .fb-modal   { border-radius: 0 !important; min-height: 100vh; min-height: 100dvh; overflow: visible; }
  .fb-pane    { max-height: none; overflow: visible; }
  .fb-left    { border-right: 0 !important; border-top: 1px solid #e2e8f0; }
  .fb-head    { position: static; background: #fff; }
  /* job sheet strip stays pinned at the top while the form scrolls */
  .fb-strip-wrap { position: sticky; top: 0; z-index: 6; padding-top: 10px; padding-bottom: 8px; box-shadow: 0 4px 10px rgba(15,23,42,.08); }
  .fb-strip-wrap .fb-strip-top { margin-bottom: 8px; }
  .fb-strip-wrap .fb-progress  { margin-bottom: 8px; }
  /* all job sheet pills visible: wrap into a grid (3 per row on phones) instead of a sideways scroll.
     Sticky height is capped at 2 rows; with more job sheets the grid scrolls vertically. */
  .fb-strip-wrap .fb-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; overflow-x: visible; overflow-y: auto; max-height: 120px; padding-bottom: 2px; }
  .fb-strip-wrap .fb-pill  { min-width: 0; padding: 6px 10px; }
  /* legend kept (same as desktop) but squeezed into one swipeable line */
  .fb-strip-wrap .fb-legend    { flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; gap: 6px 14px; margin-top: 2px; padding-bottom: 2px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .fb-strip-wrap .fb-legend::-webkit-scrollbar { display: none; }
  .fb-strip-wrap .fb-legend > * { flex: 0 0 auto; }
}

@media (max-width: 575.98px) {
  .fb-head, .fb-strip-wrap { padding-left: 16px; padding-right: 16px; }
  .fb-modal .row > .fb-left, .fb-modal .row > .fb-right { padding: 18px 16px !important; }
  .fb-grid { gap: 14px 16px; }
  .fb-modal .btn-sm { padding: 0.45rem 0.8rem; font-size: 0.9rem; }
  .fb-modal .form-select-sm,
  .fb-modal .form-control-sm { min-height: 40px; font-size: 1rem; }
  .fb-head-actions { width: 100%; }
  .fb-head-actions > * { flex: 1 1 auto; }
  .fb-phone { width: 100%; justify-content: space-between; }
}
`;

const FlagBadges = ({ flags = [] }) => (
  <>
    {flags.map((f) => (
      <span key={f} className={`badge me-1 ${f === "delivery_dispute" ? "bg-danger" : "bg-warning text-dark"}`}>
        {FLAG_LABEL[f] || f}
      </span>
    ))}
  </>
);

/* ---------- ONE QUESTION ---------- */
const QuestionField = ({ q, value, onChange }) => {
  if (q.type === "rating") {
    return (
      <div className="d-flex gap-1 align-items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`btn btn-sm ${Number(value) >= n ? "btn-warning" : "btn-outline-secondary"}`}>★</button>
        ))}
        {value ? <span className="ms-2 small">{value}/5</span> : null}
      </div>
    );
  }
  if (q.type === "yesno") {
    return (
      <div className="btn-group btn-group-sm">
        {["Yes", "No"].map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`btn ${sameStr(value, o) ? "btn-dark" : "btn-outline-secondary"}`}>{o}</button>
        ))}
      </div>
    );
  }
  if (q.type === "choice") {
    return (
      <div className="d-flex flex-wrap gap-1">
        {(q.options || []).map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`btn btn-sm ${value === o ? "btn-dark" : "btn-outline-secondary"}`}>{o}</button>
        ))}
      </div>
    );
  }
  return (
    <input className="form-control form-control-sm" value={value || ""}
      onChange={(e) => onChange(e.target.value)} />
  );
};

/* ---------- FORM FOR ONE JOB ---------- */
const JobForm = ({ job, questions, spokeWith, doNotCall, externalStatus, onSaved }) => {
  const [ans, setAns] = useState({});
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlags, setSavedFlags] = useState(null);
  const [err, setErr] = useState("");
  const [notify, setNotify] = useState(true);
  const [repRemark, setRepRemark] = useState("");
  const [caseInfo, setCaseInfo] = useState(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipped, setSkipped] = useState(false);

  const isSkipped = skipped || externalStatus === "skipped";

  const visible = (q) => !q.showIf?.key || sameStr(ans[q.showIf.key], q.showIf.value);
  const qs = questions.filter((q) => q.scenario === job.scenario && visible(q));
  const dispute = sameStr(ans.received, "No");

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const answers = Object.entries(ans).map(([key, answer]) => ({ key, answer }));
      const res = await axios.post(`${API}/api/feedback`, {
        jobSheetId: job._id, spokeWith, answers, comments, doNotCall,
        notifyRep: dispute && notify,
        repRemark,
      });
      setSavedFlags(res.data.flags || []);
      setCaseInfo(res.data.case || null);
      onSaved(job._id, "done");
    } catch (e) {
      setErr(e.response?.data?.message || "Save failed ❌");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    setErr("");
    try {
      await axios.post(`${API}/api/feedback/skip`, { jobSheetIds: [job._id], reason: skipReason });
      setSkipped(true);
      onSaved(job._id, "skipped");
    } catch (e) {
      setErr(e.response?.data?.message || "Skip failed ❌");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`card mb-3 ${savedFlags || isSkipped ? "border-success" : ""}`}>
      <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-1 bg-light">
        <div>
          <b>{job.jobSheetNo}</b> · {job.make} {job.model}
          <span className="badge bg-secondary ms-2">{SCENARIO_LABEL[job.scenario] || job.scenario}</span>
        </div>
        <small className="text-muted">
          Received: {fmt(job.receivedAt)} · Delivered: {job.deliveryDate ? fmt(job.deliveryDate) : "-"} · {job.engineer || "-"} / {job.serviceRep || "-"}
        </small>
      </div>

      <div className="card-body">
        {isSkipped ? (
          <div className="text-muted fw-bold">Skipped ⏭️ {skipReason ? `(${skipReason})` : ""}</div>
        ) : savedFlags ? (
          <div>
            <div className="text-success fw-bold">Saved ✅</div>
            <FlagBadges flags={savedFlags} />
            {caseInfo && (
              <div className="small mt-2 text-danger">
                Case #{caseInfo.caseNo} → {caseInfo.assignedTo || "Admin"}
                {caseInfo.routeNote && <span className="text-muted"> ({caseInfo.routeNote})</span>}
              </div>
            )}
          </div>
        ) : (
          <>
            {dispute && (
              <div className="border border-danger rounded p-2 mb-3">
                <div className="small text-danger fw-semibold mb-1">
                  ⚠️ Delivery dispute — this will be flagged in the admin report
                </div>
                <div className="form-check mb-1">
                  <input id={`notify-${job._id}`} type="checkbox" className="form-check-input"
                    checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  <label htmlFor={`notify-${job._id}`} className="form-check-label small">
                    Notify the Service Rep
                  </label>
                </div>
                {notify && (
                  <textarea className="form-control form-control-sm" rows={2}
                    placeholder="Remark for the Service Rep (what the customer said...)"
                    value={repRemark} onChange={(e) => setRepRemark(e.target.value)} />
                )}
              </div>
            )}

            {qs.map((q) => (
              <div key={q.key} className="mb-3">
                <div className="small fw-semibold mb-1">
                  {q.text} {q.required && <span className="text-danger">*</span>}
                </div>
                <QuestionField q={q} value={ans[q.key]} onChange={(v) => setAns({ ...ans, [q.key]: v })} />
              </div>
            ))}

            <div className="mb-2">
              <div className="small fw-semibold mb-1">Remarks</div>
              <textarea className="form-control form-control-sm" rows={2}
                value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>

            {err && <div className="alert alert-danger py-1 small">{err}</div>}

            <button className="btn btn-sm btn-success" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Feedback"}
            </button>

            <div className="d-flex flex-wrap gap-2 align-items-center mt-3 pt-2 border-top">
              <select className="form-select form-select-sm" style={{ maxWidth: 300, flex: "1 1 200px" }}
                value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
                <option value="">Skip feedback for this job...</option>
                <option>Internal / staff job</option>
                <option>Customer doesn't want to discuss</option>
                <option>Not relevant</option>
              </select>
              {skipReason && (
                <button className="btn btn-sm btn-outline-secondary" onClick={skip} disabled={saving}>
                  Skip
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ---------- ALREADY REVIEWED PANEL ---------- */
const ReviewedPanel = ({ list, title = "✅ Already reviewed" }) => (
  <div className="border border-success rounded p-2 mb-3">
    <div className="fw-bold text-success mb-2">{title}</div>
    {list.map((f, i) => (
      <div key={i} className={i > 0 ? "border-top pt-2 mt-2" : ""}>
        <div className="d-flex flex-wrap justify-content-between gap-1 small">
          <b>{SCENARIO_LABEL[f.scenario] || f.scenario}</b>
          <span>{f.rating ? `⭐ ${f.rating}/5` : ""}</span>
        </div>
        <div className="small text-muted">
          Reviewed on {fmt(f.collectedAt)} by {f.collectedBy?.name || "-"}
        </div>
        <div className="my-1"><FlagBadges flags={f.flags} /></div>
        {(f.answers || []).map((a, k) => (
          <div key={k} className="small">
            <span className="text-muted">{a.questionText}</span>{" "}
            <b>{a.type === "rating" ? `${a.answer}/5` : String(a.answer)}</b>
          </div>
        ))}
        {f.comments && <div className="small mt-1">Remarks: “{f.comments}”</div>}
      </div>
    ))}
  </div>
);

const KIND_BADGE = {
  pending: ["bg-warning text-dark", "Feedback pending"],
  done: ["bg-success", "Saved"],
  skipped: ["bg-secondary", "Skipped"],
  reviewed: ["bg-success", "Already reviewed"],
    attempted: ["bg-info text-dark", "Attempt saved"],
  closed:   ["bg-success", "Reviewed · No response"],
  other: ["bg-light text-dark border", "Not in queue"],
};

/* ---------- CALL SCREEN ---------- */
const CallModal = ({ group, questions, onClose, onDone, onInternal, onRefresh }) => {
  const queueJobs = [...group.jobs].sort(byReceived).map((j) => ({ ...j, inQueue: true }));

  const [activeId, setActiveId] = useState(queueJobs[0]._id);   // oldest job sheet is selected first
  const [status, setStatus] = useState({});                     // { [jobId]: "done" | "skipped" }
  const [history, setHistory] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [outcome, setOutcome] = useState(null);                 // null | "answered" | attempt key
  const [spokeWith, setSpokeWith] = useState("customer");
  const [callbackAt, setCallbackAt] = useState("");
  const [note, setNote] = useState("");
  const [dnd, setDnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);               // UI only: "Copied" feedback

  useEffect(() => {
    const empty = { jobs: [], feedbacks: [], names: [], visitCount: 0 };
    if (!group.phone) { setHistory(empty); return; }
    axios.get(`${API}/api/feedback/history`, { params: { phone: group.phone } })
      .then((r) => setHistory(r.data))
      .catch(() => setHistory(empty));
  }, [group.phone]);

  // All job sheets of this customer = queue jobs + the other jobs found in history
  const queueIds = new Set(queueJobs.map((j) => String(j._id)));
  const otherJobs = (history?.jobs || [])
    .filter((h) => !queueIds.has(String(h._id)))
    .map((h) => ({
      _id: h._id,
      jobSheetNo: h.jobSheetNo,
      make: h.device?.make || "",
      model: h.device?.model || "",
      status: h.device?.mobileStatus || "",
      receivedAt: h.createdAt,
      issues: h.visualIssues || [],
      deliveryDate: h.service?.deliveryDate || null,
      engineer: h.service?.engineer || "",
      serviceRep: h.service?.serviceRep || "",
      inQueue: false,
    }));
  const allJobs = [...queueJobs, ...otherJobs].sort(byReceived);

  const reviewedOf = (j) => (history?.feedbacks || []).filter((f) => f.jobSheetNo === j.jobSheetNo);
  const attemptedOf = (j) => (history?.attempted || []).find((a) => a.jobSheetNo === j.jobSheetNo);
  const kindOf = (j) => {
    if (status[j._id]) return status[j._id];                    // done / skipped in this call
    if (j.inQueue) return j.attempts > 0 ? "attempted" : "pending";
        const att = attemptedOf(j);
    if (att) return att.state === "unreachable" ? "closed" : "attempted";
    return reviewedOf(j).length ? "reviewed" : "other";
  };

  const sel = allJobs.find((j) => j._id === activeId) || queueJobs[0];
  const selKind = kindOf(sel);

  const pending = queueJobs.filter((j) => !status[j._id]);
  const doneCount = queueJobs.length - pending.length;
  const currentIds = allJobs.map((j) => j._id);
  const lastFeedback = history?.feedbacks?.[0];

  // UI only: pill colour state
  const pillState = (j) => (j._id === sel._id ? "active" : kindOf(j));

  const onCopy = async () => {
    await copyPhone(group.contact);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nameBit = group.customerName && group.customerName !== "-" ? ` ${group.customerName}` : "";
  const script =
    `Hello${nameBit}, this is Radnus Service calling. ` +
    `You gave your ${sel.make} ${sel.model} for service${sel.issues?.length ? ` (${sel.issues.join(", ")})` : ""} on ${fmt(sel.receivedAt)}` +
    `${sel.deliveryDate ? ` and it was delivered on ${fmt(sel.deliveryDate)}` : ""}. ` +
    `May I take 2 minutes of your time for some feedback?`;

  const markStatus = (id, kind) => setStatus((p) => ({ ...p, [id]: kind }));

  // Attempt (not answered / busy / ...) is saved ONLY for the job sheet being discussed
  const submitAttempt = async () => {
    if (!sel.inQueue || status[sel._id]) { alert("This job sheet is already handled"); return; }
    if (outcome === "callback" && !callbackAt) {
      alert("Please select a call back date and time");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/api/feedback/attempt`, {
        jobSheetIds: [sel._id],
        status: outcome,
        note,
        nextCallAt: callbackAt ? new Date(callbackAt).toISOString() : undefined,
        doNotCall: dnd,
      });
      markStatus(sel._id, "attempted");
      axios.get(`${API}/api/feedback/history`, { params: { phone: group.phone } })
        .then((r) => setHistory(r.data))
        .catch(() => { });
      setOutcome(null); setNote(""); setCallbackAt(""); setDnd(false);
      onRefresh && onRefresh();            // queue count updates immediately
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
    } finally {
      setBusy(false);
    }
  };

  const closeUnreachable = async () => {
    if (!window.confirm(
      `Close ${sel.jobSheetNo} as unreachable?\n\nIt will move to the Done tab and will not be called again.`
    )) return;
    setBusy(true);
    try {
      await axios.post(`${API}/api/feedback/unreachable`, {
        jobSheetIds: [sel._id],
        note: "Closed after unsuccessful attempts",
      });
      onDone();
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
      setBusy(false);
    }
  };

  const skipAllPending = async () => {
    if (!pending.length) return;
    if (!window.confirm(
      `Skip feedback for all ${pending.length} pending job sheet(s)?\n\nThey will not appear in the queue again.`
    )) return;
    setBusy(true);
    try {
      await axios.post(`${API}/api/feedback/skip`, {
        jobSheetIds: pending.map((j) => j._id),
        reason: "Skipped remaining job sheets",
      });
      setStatus((p) => {
        const next = { ...p };
        queueJobs.forEach((j) => { if (!next[j._id]) next[j._id] = "skipped"; });
        return next;
      });
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fb-overlay">
      <div className="fb-modal bg-white text-dark">

        {/* HEADER */}
        <div className="fb-head d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
            <div className="fb-avatar">{initialsOf(group.customerName)}</div>
            <div style={{ minWidth: 0 }}>
              <h5 className="fb-title text-break">
                {group.customerName}
                {group.isDealer && <span className="fb-chip amber ms-2 align-middle">Dealer</span>}
              </h5>
              <div className="fb-sub">
                {allJobs.length} job sheet(s){!group.contact && " · No number"}
              </div>
            </div>
          </div>

          <div className="fb-head-actions d-flex flex-wrap gap-2 align-items-center">
            {group.contact ? (
              <div className="fb-phone">
                <span className="fb-phone-ico">📞</span>
                <span className="fb-phone-num">{fmtPhone(group.contact)}</span>
                <button type="button" className={`fb-copy ${copied ? "copied" : ""}`} onClick={onCopy}>
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
            ) : (
              <div className="fb-phone-none">No number</div>
            )}
            <button type="button" className="fb-ghost" onClick={onInternal}>🏢 Staff / Internal</button>
            <button type="button" className="fb-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* JOB SHEET STRIP */}
        <div className="fb-strip-wrap">
          <div className="fb-strip-top">
            <div className="fb-strip-lbl">
              Job sheets <span>· {doneCount} of {queueJobs.length} done in this call</span>
            </div>
            {pending.length > 0 && queueJobs.length > 1 && (
              <button type="button" className="fb-ghost" onClick={skipAllPending} disabled={busy}>
                ⏭ Skip all pending ({pending.length})
              </button>
            )}
          </div>

          <div className="fb-progress">
            <span style={{ width: `${queueJobs.length ? (doneCount / queueJobs.length) * 100 : 0}%` }} />
          </div>

          <div className="fb-strip">
            {allJobs.map((j) => (
              <button key={j._id} type="button" className={`fb-pill ${pillState(j)}`}
                onClick={() => setActiveId(j._id)}
                title={`${j.make} ${j.model} · ${KIND_BADGE[kindOf(j)][1]}`}>
                <div className="no"><i className="dot" />{j.jobSheetNo}</div>
                <div className="dt">{fmt(j.receivedAt)}</div>
              </button>
            ))}
          </div>

          <div className="fb-legend">
            <span><i style={{ background: "#f59e0b" }} />Pending</span>
            <span><i style={{ background: "#16a34a" }} />Saved / reviewed</span>
            <span><i style={{ background: "#0ea5e9" }} />Attempt saved</span>
            <span><i style={{ background: "#64748b" }} />Skipped</span>
            <span><i style={{ background: "#cbd5e1" }} />Not in feedback queue</span>
          </div>
        </div>

        <div className="row g-0">
          {/* LEFT: HISTORY (compact) */}
          <div className="col-lg-5 order-2 order-lg-1 border-end fb-pane fb-left fb-history">
            <div className="fb-sec">📋 Customer History</div>

            {!history ? <div className="fb-empty">Loading...</div> : (
              <>
                <div className="d-flex flex-wrap gap-1 mb-3">
                  <span className="fb-chip dark">{history.visitCount} visit(s)</span>
                  {history.hasDispute && <span className="fb-chip red">⚠️ Previous delivery dispute</span>}
                  {history.names?.length > 1 && (
                    <span className="fb-chip amber">Names: {history.names.join(", ")}</span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="fb-sec">Last feedback</div>
                  {lastFeedback ? (
                    <div className="fb-card small">
                      <div className="d-flex justify-content-between gap-2">
                        <b>{lastFeedback.jobSheetNo} · {SCENARIO_LABEL[lastFeedback.scenario] || lastFeedback.scenario}</b>
                        <span>{lastFeedback.rating ? `⭐ ${lastFeedback.rating}/5` : ""}</span>
                      </div>
                      <div className="text-muted">{fmt(lastFeedback.collectedAt)} · {lastFeedback.collectedBy?.name}</div>
                      <div className="mt-1"><FlagBadges flags={lastFeedback.flags} /></div>
                      {lastFeedback.comments && <div className="mt-1">“{lastFeedback.comments}”</div>}
                    </div>
                  ) : (
                    <div className="fb-empty">No feedback collected yet</div>
                  )}
                </div>

                <button type="button" className="fb-ghost mb-3"
                  onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Hide history" : `Show all visits (${history.visitCount})`}
                </button>

                {showAll && (
                  <>
                    <div className="fb-sec">Past jobs</div>
                    <div className="fb-card p-0 mb-3 table-responsive">
                      <table className="table table-sm small align-middle">
                        <thead className="table-light">
                          <tr><th>Job</th><th>Received</th><th>Delivered</th><th>Device</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {history.jobs.map((h) => (
                            <tr key={h._id}
                              className={h._id === sel._id ? "table-primary" : queueIds.has(String(h._id)) ? "table-warning" : ""}>
                              <td>
                                {h.jobSheetNo}
                                {h.repeatOf && <div className="text-danger">🔁 repeat of {h.repeatOf}</div>}
                              </td>
                              <td>{fmt(h.createdAt)}</td>
                              <td>{h.service?.deliveryDate ? fmt(h.service.deliveryDate) : "-"}</td>
                              <td>{h.device?.make} {h.device?.model}</td>
                              <td>{h.device?.mobileStatus}</td>
                            </tr>
                          ))}
                          {history.jobs.length === 0 && <tr><td colSpan={5} className="text-muted">No history</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <div className="fb-sec">Past feedback</div>
                    {history.feedbacks.length === 0 && <div className="fb-empty">No feedback collected yet</div>}
                    {history.feedbacks.map((f, i) => (
                      <div key={i} className="fb-card small mb-2">
                        <div className="d-flex justify-content-between gap-2">
                          <b>{f.jobSheetNo} · {SCENARIO_LABEL[f.scenario] || f.scenario}</b>
                          <span>{f.rating ? `⭐ ${f.rating}/5` : ""}</span>
                        </div>
                        <div className="text-muted">{fmt(f.collectedAt)} · {f.collectedBy?.name}</div>
                        <FlagBadges flags={f.flags} />
                        {f.comments && <div className="mt-1">“{f.comments}”</div>}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* RIGHT: SELECTED JOB SHEET */}
          <div className="col-lg-7 order-1 order-lg-2 fb-pane fb-right">

            {/* Selected job sheet details */}
            <div className="fb-card mb-3">
              <div className="fb-job-head">
                <span className="fb-job-no">{sel.jobSheetNo}</span>
                <span className={`badge ${KIND_BADGE[selKind][0]}`}>{KIND_BADGE[selKind][1]}</span>
              </div>
              <div className="fb-grid">
                <div className="fb-kv"><div className="k">Make</div><div className="v">{sel.make || "-"}</div></div>
                <div className="fb-kv"><div className="k">Model</div><div className="v">{sel.model || "-"}</div></div>
                <div className="fb-kv"><div className="k">Received</div><div className="v">{fmt(sel.receivedAt)}</div></div>
                <div className="fb-kv"><div className="k">Delivered</div><div className="v">{sel.deliveryDate ? fmt(sel.deliveryDate) : "-"}</div></div>
                <div className="fb-kv"><div className="k">Status</div><div className="v">{sel.status || "-"}</div></div>
                <div className="fb-kv"><div className="k">Engineer</div><div className="v">{sel.engineer || "-"}</div></div>
                <div className="fb-kv full"><div className="k">Service rep</div><div className="v">{sel.serviceRep || "-"}</div></div>
                <div className="fb-kv full">
                  <div className="k mb-1">Visual inspection (issues reported)</div>
                  {(sel.issues || []).length > 0 ? (
                    <div className="d-flex flex-wrap gap-1">
                      {sel.issues.map((x, i) => (
                        <span key={i} className="fb-chip amber">{x}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="fb-empty">Not recorded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Already reviewed / not in queue info */}
            {!history && !sel.inQueue && <div className="fb-empty mb-3">Loading...</div>}
            {selKind === "reviewed" && <ReviewedPanel list={reviewedOf(sel)} />}
            {history && !["done", "skipped"].includes(status[sel._id]) && (() => {
              const a = attemptedOf(sel);
              if (!a) return null;
              const list = a.callAttempts || [];
              return (
                <div className="fb-notice mb-3" style={{ borderLeft: "4px solid #0ea5e9" }}>
                  <div className="fw-bold mb-1">
                    📵 Previous attempts for {sel.jobSheetNo} · {list.length}
                  </div>
                  {[...list].reverse().map((t, i) => (
                    <div key={i} className="small">
                      <b>{ATTEMPT_LABEL[t.status] || t.status}</b> · {fmtDT(t.at)}
                      {t.by ? ` · ${t.by}` : ""}
                      {t.note ? ` — "${t.note}"` : ""}
                    </div>
                  ))}
                  {a.state === "open" && a.nextCallAt && (
                    <div className="small mt-1">Next call: {fmtDT(a.nextCallAt)}</div>
                  )}
                  {a.state === "unreachable" && (
                                        <div className="small mt-1 text-success fw-semibold">
                      ✔ Reviewed — closed as no response. Moved to the Done tab.
                    </div>
                  )}
                  {a.state === "open" && sel.inQueue && (
                    <button type="button" className="btn btn-sm btn-outline-danger mt-2"
                      disabled={busy} onClick={closeUnreachable}>
                      📵 No response — close &amp; move to Done
                    </button>
                  )}
                                    {!sel.inQueue && a.state === "open" && (
                    <div className="small mt-1">Use the <b>Attempts</b> tab to call again.</div>
                  )}
                </div>
              );
            })()}
            {selKind === "other" && history && (
              <div className="fb-notice">
                This job sheet is not in the feedback queue right now (too recent, skipped,
                marked as internal, or a call back is scheduled).
              </div>
            )}
            {sel.inQueue && reviewedOf(sel).length > 0 && (
              <ReviewedPanel list={reviewedOf(sel)} title="Earlier feedback for this job sheet" />
            )}

            {/* Call section — stays mounted so typed answers are kept when switching job sheets */}
            <div className={sel.inQueue ? "" : "d-none"}>
              <div className="fb-script mb-3">
                <span className="lbl">Opening</span>
                {script}
              </div>

              <div className="fb-sec">Call outcome</div>
              <div className="fb-outcome mb-3">
                <button type="button" className={`fb-out yes ${outcome === "answered" ? "on" : ""}`}
                  onClick={() => setOutcome("answered")}>✅ Answered</button>
                {ATTEMPT_OPTIONS.map((o) => (
                  <button key={o.key} type="button"
                    className={`fb-out ${outcome === o.key ? "on" : ""}`}
                    onClick={() => setOutcome(o.key)}>{o.label}</button>
                ))}
              </div>

              {/* Not answered etc. (applies to all pending job sheets of this customer) */}
              {outcome && outcome !== "answered" && !status[sel._id] && (
                <div className="fb-attempt">
                  {outcome === "callback" && (
                    <div className="mb-2">
                      <label className="small fw-semibold">Call back date / time</label>
                      <input type="datetime-local" className="form-control form-control-sm"
                        value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
                    </div>
                  )}
                  <input className="form-control form-control-sm mb-2" placeholder="Note (optional)"
                    value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="form-check mb-3">
                    <input id="dnd" type="checkbox" className="form-check-input" checked={dnd}
                      onChange={(e) => setDnd(e.target.checked)} />
                    <label htmlFor="dnd" className="form-check-label small">
                      Customer asked not to call again (Do Not Disturb)
                    </label>
                  </div>
                  <button className="btn btn-sm btn-dark" onClick={submitAttempt} disabled={busy}>
                    {busy ? "Saving..." : `Save attempt (${sel.jobSheetNo})`}
                  </button>
                </div>
              )}

              {/* Attempt saved for this job sheet */}
              {sel.inQueue && status[sel._id] === "attempted" && outcome !== "answered" && (
                <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2 mb-0">
                  <span>
                    📵 {sel.jobSheetNo} attempt saved. It stays in the Attempts tab for the next call.{" "}
                    {pending.length > 0
                      ? `${pending.length} more job sheet(s) pending. Pick one above to continue.`
                      : "No more pending job sheets."}
                  </span>
                  <div className="d-flex gap-2">
                    {pending.length > 0 && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setActiveId(pending[0]._id)}>
                        Next pending job
                      </button>
                    )}
                    <button className="btn btn-sm btn-primary" onClick={onDone}>Finish call</button>
                  </div>
                </div>
              )}

              {/* Answered → only the selected job sheet's form is visible */}
              {outcome === "answered" && (
                <>
                  <div className="fb-attempt d-flex flex-wrap gap-4 align-items-end mb-3">
                    <div>
                      <label className="small fw-semibold d-block mb-1">Spoke with</label>
                      <select className="form-select form-select-sm" value={spokeWith}
                        onChange={(e) => setSpokeWith(e.target.value)}>
                        <option value="customer">Customer</option>
                        <option value="family">Family member</option>
                        <option value="other">Other person</option>
                      </select>
                    </div>
                    <div className="form-check mb-1">
                      <input id="dnd2" type="checkbox" className="form-check-input" checked={dnd}
                        onChange={(e) => setDnd(e.target.checked)} />
                      <label htmlFor="dnd2" className="form-check-label small">Do Not Disturb</label>
                    </div>
                  </div>

                  {queueJobs.map((job) => (
                    <div key={job._id} className={job._id === sel._id ? "" : "d-none"}>
                      <JobForm job={job} questions={questions}
                        spokeWith={spokeWith} doNotCall={dnd}
                        externalStatus={status[job._id]}
                        onSaved={markStatus} />
                    </div>
                  ))}

                  {sel.inQueue && status[sel._id] && (
                    <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2 mb-0">
                      <span>
                        {status[sel._id] === "done" ? "✅" : status[sel._id] === "attempted" ? "📵" : "⏭️"} {sel.jobSheetNo}{" "}
                        {status[sel._id] === "done" ? "saved" : status[sel._id] === "attempted" ? "attempt saved" : "skipped"}.{" "}
                        {pending.length > 0
                          ? `${pending.length} more job sheet(s) pending. Pick one above if the customer wants to discuss it.`
                          : "All job sheets are completed."}
                      </span>
                      <div className="d-flex gap-2">
                        {pending.length > 0 && (
                          <button className="btn btn-sm btn-outline-success" onClick={() => setActiveId(pending[0]._id)}>
                            Next pending job
                          </button>
                        )}
                        <button className="btn btn-sm btn-success" onClick={onDone}>Finish call</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
/* ---------- MAIN PAGE ---------- */
const FeedbackPage = () => {
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.key === t) ? t : "delivered";
  });
  const [queue, setQueue] = useState({ counts: {}, groups: [], config: {} });
  const [doneList, setDoneList] = useState([]);
  const [attemptList, setAttemptList] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visible, setVisible] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const dateParams = {};
      if (dateFrom) dateParams.from = dateFrom;
      if (dateTo) dateParams.to = dateTo;

      const queueTab = tab === "done" || tab === "attempts" ? "delivered" : tab;
      const [q, a, d] = await Promise.all([
        axios.get(`${API}/api/feedback/queue`, { params: { tab: queueTab, ...dateParams } }),
        axios.get(`${API}/api/feedback/attempts`),
        tab === "done" ? axios.get(`${API}/api/feedback/done`) : Promise.resolve(null),
      ]);
      setQueue(q.data);
      setAttemptList(a.data);
      if (d) setDoneList(d.data);
    } catch (e) {
      setError(`${e.response?.status || ""} ${e.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo]);

  useEffect(() => {
    axios.get(`${API}/api/feedback/questions`).then((r) => setQuestions(r.data)).catch(() => { });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setVisible(60); }, [tab, dateFrom, dateTo, search]);

  const openAttempt = (f) => {
    if (!f.job) { alert("Job sheet not found"); return; }
    setActive({
      key: `att_${f._id}`,
      phone: f.phone || "",
      customerName: f.customerName || "-",
      contact: f.contact || "",
      isDealer: !!f.isDealer,
      jobs: [f.job],
      oldestDays: f.job.daysOld || 0,
    });
  };

  const markInternal = async (g) => {
    if (!window.confirm(
      `Mark ${g.customerName} (${g.contact || "no number"}) as Staff / Internal?\n\n` +
      `All jobs for this number will move to Done and will no longer appear in the queue.`
    )) return;
    try {
      await axios.post(`${API}/api/feedback/internal`, {
        phone: g.phone,
        customerName: g.customerName,
        jobSheetIds: g.jobs.map((j) => j._id),
      });
      setActive(null);
      load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed ❌");
    }
  };

  const q = search.trim().toLowerCase();
  const groups = (queue.groups || []).filter(
    (g) =>
      !q ||
      g.customerName.toLowerCase().includes(q) ||
      (g.contact || "").includes(q) ||
      g.jobs.some((j) => String(j.jobSheetNo).toLowerCase().includes(q))
  );

  return (
    <div className="fbp" style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{FEEDBACK_CSS}</style>
      <JobSheetSidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* HEADER */}
        <div className="fbp-top">
          <span className="fbp-brand">RADNUS</span>
          <span className="fbp-tag">SERVICE PRO</span>
          <span className="fbp-sep" />
          <span className="fbp-page">Customer Feedback</span>
        </div>

        <div className="fbp-wrap text-dark">
          {/* TABS */}
          <div className="fbp-tabs fb-tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button"
                className={`fbp-tab ${tab === t.key ? "on" : ""}`}
                onClick={() => setTab(t.key)}>
                {t.label}
                <span className="fbp-count">
                  {t.key === "attempts" ? attemptList.length : (queue.counts?.[t.key] ?? 0)}
                </span>
              </button>
            ))}
          </div>

          {/* FILTER BAR */}
          <div className="fbp-filters">
            <div className="fbp-f" style={{ flex: "1 1 240px", maxWidth: 340 }}>
              <label>Search</label>
              <input className="form-control form-control-sm"
                placeholder="Name / number / job no" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="fbp-f">
              <label>Job sheet from</label>
              <input type="date" className="form-control form-control-sm" value={dateFrom}
                max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="fbp-f">
              <label>Job sheet to</label>
              <input type="date" className="form-control form-control-sm" value={dateTo}
                min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {(dateFrom || dateTo) && (
              <button type="button" className="fb-ghost"
                onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear dates</button>
            )}
            <button type="button" className="fbp-refresh" onClick={load}>↻ Refresh</button>
          </div>

          {queue.config?.minAgeDays != null && (
            <div className="fbp-note">
              {queue.config.maxAgeDays > 0
                ? `Job sheets created ${queue.config.minAgeDays}–${queue.config.maxAgeDays} days ago`
                : `All job sheets older than ${queue.config.minAgeDays} days`}
              {(dateFrom || dateTo) && ` · filtered: ${dateFrom || "start"} → ${dateTo || "latest"}`}
            </div>
          )}

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {loading && <div className="fbp-loading">Loading...</div>}

          {/* DONE TAB */}
          {tab === "done" ? (
            <div className="fbp-table-card">
              <div className="table-responsive">
                <table className="table fbp-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Job</th><th>Customer</th><th>Status</th><th>Type</th>
                      <th>Rating</th><th>Flags</th><th>By</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doneList.map((f) => (
                      <tr key={f._id}>
                        <td className="fw-semibold">{f.jobSheetNo}</td>
                        <td>{f.customerName}</td>
                        <td>
                          {f.state === "internal" && <span className="badge bg-dark">🏢 Internal</span>}
                          {f.state === "skipped" && <span className="badge bg-secondary" title={f.skipReason}>Skipped</span>}
                          {f.state === "done" && <span className="badge bg-success">Done</span>}
                          {f.state === "unreachable" && (() => {
                            const list = f.callAttempts || [];
                            const last = list[list.length - 1];
                            return (
                              <>
                                <span className="badge bg-danger">
                                  📵 Unreachable · {list.length} attempt(s)
                                </span>
                                <div className="small text-muted mt-1">
                                  Last: {ATTEMPT_LABEL[last?.status] || "-"}
                                </div>
                              </>
                            );
                          })()}
                        </td>
                        <td>{SCENARIO_LABEL[f.scenario] || f.scenario}</td>
                        <td>{f.rating ? `⭐ ${f.rating}` : "-"}</td>
                        <td><FlagBadges flags={f.flags} /></td>
                        <td>{f.collectedBy?.name || (f.callAttempts || []).slice(-1)[0]?.by || "-"}</td>
                        <td className="text-nowrap">{fmtDT(f.updatedAt)}</td>
                      </tr>
                    ))}
                    {doneList.length === 0 && <tr><td colSpan={8} className="text-muted text-center py-4">Nothing here yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === "attempts" ? (
            /* ATTEMPTS TAB */
            <div className="fbp-table-card">
              <div className="table-responsive">
                <table className="table fbp-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Job</th><th>Customer</th><th>Last attempt</th>
                      <th>Attempts</th><th>Next call</th><th>Type</th><th>By</th><th>Date</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attemptList.map((f) => {
                      const list = f.callAttempts || [];
                      const last = list[list.length - 1];
                      return (
                        <tr key={f._id} style={{ cursor: "pointer" }} onClick={() => openAttempt(f)}>
                          <td className="fw-semibold">{f.jobSheetNo}</td>
                          <td>
                            {f.customerName}
                            {f.contact && <div className="small text-muted">{f.contact}</div>}
                          </td>
                          <td>
                            <span className={`badge ${f.state === "unreachable" ? "bg-danger" : "bg-info text-dark"}`}>
                              📵 {ATTEMPT_LABEL[last?.status] || "Attempt"}
                            </span>
                            {f.state === "unreachable" && <div className="small text-danger mt-1">Unreachable</div>}
                            {last?.note && <div className="small text-muted mt-1">{last.note}</div>}
                          </td>
                          <td>{list.length}</td>
                          <td className="text-nowrap">
                            {f.state === "open" && f.nextCallAt ? fmtDT(f.nextCallAt) : "-"}
                          </td>
                          <td>{SCENARIO_LABEL[f.scenario] || f.scenario}</td>
                          <td>{last?.by || "-"}</td>
                          <td className="text-nowrap">{fmtDT(last?.at || f.updatedAt)}</td>
                          <td className="text-nowrap">
                            <button type="button" className="btn btn-sm btn-dark"
                              onClick={(e) => { e.stopPropagation(); openAttempt(f); }}>
                              Open call →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {attemptList.length === 0 && (
                      <tr><td colSpan={9} className="text-muted text-center py-4">No pending attempts</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* QUEUE CARDS — one card per customer */
            <>
              <div className="fbp-grid">
                {groups.slice(0, visible).map((g) => {
                  const sorted = [...g.jobs].sort(byReceived);
                  return (
                    <div className="fbp-card" key={g.key} onClick={() => setActive(g)}>
                      <div className="fbp-card-head">
                        <div className="fbp-av">{initialsOf(g.customerName)}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="fbp-name text-break">{g.customerName}</div>
                          <div className="fbp-phone">{g.contact ? fmtPhone(g.contact) : "No number"}</div>
                        </div>
                        <span className="fbp-jobs">{g.jobs.length} job(s)</span>
                      </div>

                      <div className="fbp-meta">
                        <span className="fb-chip grey">⏱ oldest {g.oldestDays} days</span>
                        {g.isDealer && <span className="fb-chip amber">Dealer</span>}
                        {g.lastCalledAt && (
                          <span className="fb-chip slate">Last feedback call: {fmt(g.lastCalledAt)}</span>
                        )}
                      </div>

                      <div className="fbp-list">
                        {sorted.slice(0, 3).map((j) => (
                          <div key={j._id} className="fbp-job">
                            <div className="fbp-job-top">
                              <span className="fbp-job-no">{j.jobSheetNo}</span>
                              <span className="fbp-job-dev text-break">{j.make} {j.model}</span>
                              <span className="fb-chip grey">{j.status || "-"}</span>
                              {j.attempts > 0 && <span className="fb-chip amber">{j.attempts} attempt(s)</span>}
                            </div>
                            <div className="fbp-job-dates">
                              Received {fmt(j.receivedAt)}{j.deliveryDate ? ` · Delivered ${fmt(j.deliveryDate)}` : ""}
                            </div>
                            {j.nextCallAt && <div className="fbp-job-dates">Call back: {fmtDT(j.nextCallAt)}</div>}
                          </div>
                        ))}
                        {sorted.length > 3 && (
                          <div className="fbp-more">+{sorted.length - 3} more job sheet(s)</div>
                        )}
                      </div>

                      <div className="fbp-cta">Open call →</div>
                    </div>
                  );
                })}
              </div>

              {groups.length > visible && (
                <div className="text-center my-4">
                  <button type="button" className="fb-ghost" onClick={() => setVisible((v) => v + 60)}>
                    Show more ({groups.length - visible} more customers)
                  </button>
                </div>
              )}
              {!loading && groups.length === 0 && (
                <div className="fbp-empty">
                  <div style={{ fontSize: 36 }}>🎉</div>
                  No pending feedback in this tab
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {active && (
        <CallModal
          key={active.key}
          group={active}
          questions={questions}
          onClose={() => { setActive(null); load(); }}
          onDone={() => { setActive(null); load(); }}
          onInternal={() => markInternal(active)}
          onRefresh={load}
        />
      )}
    </div>
  );
};

export default FeedbackPage;