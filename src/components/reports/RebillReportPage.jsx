import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const RebillReportPage = () => {
  const [data,         setData]         = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [search,       setSearch]       = useState("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [expandedId,   setExpandedId]   = useState(null);

  const API      = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  /* ── FETCH ── */
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/jobsheets/filter`);
      // Only jobs that have been rebilled at least once
      const rebilled = res.data.filter(
        item => item.rebillHistory && item.rebillHistory.length > 0
      );
      setData(rebilled);
      setFiltered(rebilled);
    } catch (err) {
      console.error(err);
      alert("Failed to load ❌");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── FILTER ── */
  const applyFilter = () => {
    let f = [...data];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(item =>
        item.customer?.name?.toLowerCase().includes(q) ||
        item.customer?.contact?.includes(q) ||
        item.jobSheetNo?.toLowerCase().includes(q)
      );
    }
    if (fromDate) {
      f = f.filter(item => {
        const d = new Date(item.createdAt).toISOString().slice(0, 10);
        return toDate ? (d >= fromDate && d <= toDate) : d === fromDate;
      });
    }
    setFiltered(f);
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const fmtCurrency = (n) =>
    `₹${Number(n || 0).toLocaleString("en-IN")}`;

  /* ── STATUS PILL ── */
  const statusStyle = (s) => {
    const map = {
      "Received":         { bg: "#DBEAFE", color: "#1D4ED8" },
      "Pending":          { bg: "#FEF3C7", color: "#92400E" },
      "Repairing":        { bg: "#EDE9FE", color: "#5B21B6" },
      "Diagnosing":       { bg: "#EDE9FE", color: "#5B21B6" },
      "Ready":            { bg: "#D1FAE5", color: "#065F46" },
      "Delivered":        { bg: "#D1FAE5", color: "#065F46" },
      "Delivered NR/NA":  { bg: "#D1FAE5", color: "#065F46" },
    };
    return map[s] || { bg: "#F3F4F6", color: "#374151" };
  };

  /* ── TOTALS ── */
  const totalRebills   = filtered.reduce((sum, j) => sum + (j.rebillHistory?.length || 0), 0);
  const totalRevenue   = filtered.reduce((sum, j) => {
    const hist = j.rebillHistory?.reduce((s, r) => s + (r.serviceCharge || 0) + (r.spareCharge || 0), 0) || 0;
    const curr = (j.service?.serviceCharge || 0) + (j.service?.spareCharge || 0);
    return sum + hist + curr;
  }, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        .rb-row { transition: background 0.12s; cursor: pointer; }
        .rb-row:hover { background: #f8fafc !important; }
        .filter-in { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: none; background: #fff; }
        .filter-in:focus { border-color: #6366f1; }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>🔄 Rebill Report</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Jobs that were reopened and rebilled after invoice</p>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigate(-1)}
              style={{ background: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              ← Back
            </button>
            <button onClick={() => window.print()}
              style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🖨️ Print
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total Rebilled Jobs",    value: filtered.length,       color: "#6366f1", bg: "#eef2ff", icon: "📋" },
            { label: "Total Rebill Instances", value: totalRebills,           color: "#f59e0b", bg: "#fffbeb", icon: "🔄" },
            { label: "Total Revenue (All)",    value: fmtCurrency(totalRevenue), color: "#10b981", bg: "#f0fdf4", icon: "💰" },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, borderRadius: 12, padding: "16px 18px", border: `1.5px solid ${c.color}22` }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div className="no-print" style={{ background: "#fff", borderRadius: 14, padding: "14px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Search</label>
            <input className="filter-in" placeholder="Job No / Name / Contact" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>From</label>
            <input type="date" className="filter-in" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>To</label>
            <input type="date" className="filter-in" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button onClick={applyFilter}
            style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🔍 Filter
          </button>
          <button onClick={fetchData}
            style={{ background: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            🔄 Reset
          </button>
        </div>

        {/* TABLE */}
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>

          {/* Table header info */}
          <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
              {filtered.length} job{filtered.length !== 1 ? "s" : ""} found
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Click a row to see rebill history</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8", fontSize: 14 }}>⏳ Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8", fontSize: 14 }}>No rebill records found</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                    {["#", "Job No", "Customer", "Contact", "Device", "Engineer", "Status", "Rebills", "Current Total", "All-time Total"].map((h, i) => (
                      <th key={i} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job, idx) => {
                    const ss        = statusStyle(job.device?.mobileStatus);
                    const rebills   = job.rebillHistory?.length || 0;
                    const histTotal = job.rebillHistory?.reduce((s, r) => s + (r.serviceCharge || 0) + (r.spareCharge || 0), 0) || 0;
                    const currTotal = (job.service?.serviceCharge || 0) + (job.service?.spareCharge || 0);
                    const allTime   = histTotal + currTotal;
                    const isExpanded = expandedId === job._id;

                    return (
                      <React.Fragment key={job._id}>
                        {/* MAIN ROW */}
                        <tr className="rb-row"
                          style={{ background: isExpanded ? "#f0f9ff" : idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f1f5f9" }}
                          onClick={() => setExpandedId(isExpanded ? null : job._id)}>
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>{job.jobSheetNo}</span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{job.customer?.name || "-"}</td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{job.customer?.contact || "-"}</td>
                          <td style={{ padding: "10px 12px", color: "#64748b" }}>{job.device?.make} {job.device?.model}</td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{job.service?.engineer || "-"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20 }}>
                              {job.device?.mobileStatus || "-"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 800, padding: "2px 9px", borderRadius: 20 }}>
                              🔄 ×{rebills}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{fmtCurrency(currTotal)}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "#6366f1" }}>{fmtCurrency(allTime)}</td>
                        </tr>

                        {/* EXPANDED — REBILL HISTORY */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} style={{ padding: "0 12px 12px 48px", background: "#f0f9ff" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 8, marginTop: 8 }}>
                                📋 Rebill history for {job.jobSheetNo}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {job.rebillHistory.map((rb, ri) => (
                                  <div key={ri} style={{
                                    background: "#fff", border: "1px solid #bfdbfe", borderRadius: 8,
                                    padding: "10px 14px", display: "flex", flexWrap: "wrap",
                                    justifyContent: "space-between", gap: 10,
                                  }}>
                                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                                      <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                                        Repair #{ri + 1}
                                      </span>
                                      <span style={{ color: "#475569", fontSize: 12 }}>
                                        Service: <b style={{ color: "#0f172a" }}>{fmtCurrency(rb.serviceCharge)}</b>
                                      </span>
                                      <span style={{ color: "#475569", fontSize: 12 }}>
                                        Spare: <b style={{ color: "#0f172a" }}>{fmtCurrency(rb.spareCharge)}</b>
                                      </span>
                                      <span style={{ color: "#6366f1", fontSize: 12, fontWeight: 700 }}>
                                        Total: {fmtCurrency((rb.serviceCharge || 0) + (rb.spareCharge || 0))}
                                      </span>
                                      {rb.remarks && (
                                        <span style={{ color: "#94a3b8", fontSize: 11, fontStyle: "italic" }}>
                                          "{rb.remarks}"
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDate(rb.rebilledAt)}</span>
                                      <span style={{ fontSize: 11, color: "#64748b" }}>by <b>{rb.rebilledBy}</b></span>
                                    </div>
                                  </div>
                                ))}

                                {/* Current (active) repair */}
                                <div style={{
                                  background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
                                  padding: "10px 14px", display: "flex", flexWrap: "wrap",
                                  justifyContent: "space-between", gap: 10,
                                }}>
                                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                                      Current Repair #{job.rebillHistory.length + 1}
                                    </span>
                                    <span style={{ color: "#475569", fontSize: 12 }}>
                                      Service: <b style={{ color: "#0f172a" }}>{fmtCurrency(job.service?.serviceCharge)}</b>
                                    </span>
                                    <span style={{ color: "#475569", fontSize: 12 }}>
                                      Spare: <b style={{ color: "#0f172a" }}>{fmtCurrency(job.service?.spareCharge)}</b>
                                    </span>
                                    <span style={{ color: "#10b981", fontSize: 12, fontWeight: 700 }}>
                                      Total: {fmtCurrency((job.service?.serviceCharge || 0) + (job.service?.spareCharge || 0))}
                                    </span>
                                    {job.device?.mobileStatus && (
                                      <span style={{ background: statusStyle(job.device.mobileStatus).bg, color: statusStyle(job.device.mobileStatus).color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12 }}>
                                        {job.device.mobileStatus}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); navigate(`/jobsheet/${job._id}`); }}
                                    style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                    Open →
                                  </button>
                                </div>
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
        </div>

      </div>
    </div>
  );
};

export default RebillReportPage;
