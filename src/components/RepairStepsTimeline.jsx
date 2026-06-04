import React, { useEffect, useState } from "react";
import axios from "axios";

/* ─── STATUS CONFIG — vivid full-bg highlight ─── */
const STATUS_CONFIG = {
  Received:          { bg: "#DBEAFE", color: "#1D4ED8", border: "#3B82F6", dot: "#3B82F6" },
  Pending:           { bg: "#FEF3C7", color: "#92400E", border: "#F59E0B", dot: "#F59E0B" },
  "In Progress":     { bg: "#FEF3C7", color: "#92400E", border: "#F59E0B", dot: "#F59E0B" },
  Repairing:         { bg: "#FDE8D8", color: "#9A3412", border: "#F97316", dot: "#F97316" },
  Diagnosing:        { bg: "#EDE9FE", color: "#5B21B6", border: "#8B5CF6", dot: "#8B5CF6" },
  Ready:             { bg: "#D1FAE5", color: "#065F46", border: "#10B981", dot: "#10B981" },
  Delivered:         { bg: "#D1FAE5", color: "#065F46", border: "#10B981", dot: "#10B981" },
  "Delivered NR/NA": { bg: "#D1FAE5", color: "#065F46", border: "#10B981", dot: "#10B981" },
};

const getStatusStyle = (status) =>
  STATUS_CONFIG[status] || { bg: "#F3F4F6", color: "#374151", border: "#9CA3AF", dot: "#9CA3AF" };

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }) : null;

/* ─── AVATAR ─── */
const AVATAR_COLORS = [
  ["#DBEAFE","#1D4ED8"], ["#D1FAE5","#065F46"], ["#EDE9FE","#5B21B6"],
  ["#FEF3C7","#92400E"], ["#FCE7F3","#9D174D"], ["#FDE8D8","#9A3412"],
];
const Avatar = ({ name, size = 26 }) => {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  const [bg, color] = AVATAR_COLORS[idx];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, border: `1.5px solid ${color}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38), fontWeight: 700, color,
      flexShrink: 0, letterSpacing: "-0.5px", userSelect: "none",
    }}>
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════ */
const RepairStepsTimeline = ({ jobId }) => {
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(false);
  const API = import.meta.env.VITE_API_URL;

  const fetchData = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/jobsheets/${jobId}`);
      setJobData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [jobId]);
  if (!jobId) return null;

  const steps       = jobData?.repairSteps || [];
  const statusLogs  = jobData?.statusLogs  || [];
  const transferLog = jobData?.transferLog || [];
  const doneCount   = steps.filter(s => s.done).length;
  const pct         = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  const card = {
    background: "#fff", border: "1px solid #E5E7EB",
    borderRadius: 16, marginBottom: 20, overflow: "hidden",
  };
  const cardHeader = {
    padding: "14px 20px", borderBottom: "1px solid #F3F4F6",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#FAFAFA",
  };

  return (
    <div style={{ marginTop: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══ REPAIR STEPS ══ */}
      <div style={card}>
        <div style={cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "#D1FAE5", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🛠️</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Engineer repair steps
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {steps.length > 0 && (
              <span style={{
                background: pct === 100 ? "#D1FAE5" : "#FEF3C7",
                color: pct === 100 ? "#065F46" : "#92400E",
                fontSize: 13, fontWeight: 700,
                padding: "4px 12px", borderRadius: 20,
              }}>
                {doneCount}/{steps.length} done
              </span>
            )}
            <button onClick={fetchData} disabled={loading} style={{
              display: "flex", alignItems: "center", gap: 6,
              border: "1px solid #E5E7EB", borderRadius: 8,
              background: "#fff", color: "#6B7280",
              fontSize: 13, fontWeight: 600,
              padding: "6px 14px", cursor: "pointer",
            }}>
              <span style={{ display:"inline-block", animation: loading ? "spin 1s linear infinite" : "none", fontSize: 15 }}>
                ⟳
              </span>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 20px" }}>

          {/* PROGRESS */}
          {steps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>Progress</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: pct === 100 ? "#065F46" : "#92400E" }}>
                  {pct}%
                </span>
              </div>
              <div style={{ height: 8, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${pct}%`,
                  background: pct === 100
                    ? "linear-gradient(90deg,#10B981,#34D399)"
                    : "linear-gradient(90deg,#F59E0B,#FCD34D)",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          )}

          {/* STEPS LIST */}
          {loading ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", padding: "28px 0", fontSize: 14 }}>
              Loading steps...
            </div>
          ) : steps.length === 0 ? (
            <div style={{
              textAlign: "center", color: "#9CA3AF", padding: "28px 0",
              fontSize: 14, background: "#FAFAFA", borderRadius: 12,
              border: "1.5px dashed #E5E7EB",
            }}>
              No repair steps added yet
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: 17, top: 36, bottom: 24,
                width: 2, background: "#F3F4F6", zIndex: 0,
              }} />
              {steps.map((s, idx) => (
                <div key={s._id || idx} style={{
                  display: "flex", gap: 14, marginBottom: 14,
                  position: "relative", zIndex: 1,
                }}>
                  {/* Circle */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700,
                    background: s.done ? "#D1FAE5" : "#F9FAFB",
                    border: `2px solid ${s.done ? "#10B981" : "#E5E7EB"}`,
                    color: s.done ? "#065F46" : "#9CA3AF",
                    zIndex: 1,
                  }}>
                    {s.done ? "✓" : idx + 1}
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1, borderRadius: 12, padding: "12px 16px",
                    background: s.done ? "#F0FDF4" : "#FAFAFA",
                    border: `1px solid ${s.done ? "#A7F3D0" : "#E5E7EB"}`,
                    borderLeft: `4px solid ${s.done ? "#10B981" : "#D1D5DB"}`,
                  }}>
                    {/* title + pill */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                      <span style={{
                        fontSize: 15, fontWeight: 600,
                        color: s.done ? "#065F46" : "#111827",
                        textDecoration: s.done ? "line-through" : "none",
                        textDecorationColor: "#6EE7B7",
                        flex: 1,
                      }}>
                        {s.step}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: s.done ? "#D1FAE5" : "#F3F4F6",
                        color: s.done ? "#065F46" : "#6B7280",
                        fontSize: 12, fontWeight: 700,
                        padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: s.done ? "#10B981" : "#9CA3AF",
                        }} />
                        {s.done ? "Done" : "Pending"}
                      </span>
                    </div>

                    {/* note */}
                    {s.note && (
                      <div style={{
                        fontSize: 13, color: "#6B7280",
                        background: "#fff", borderRadius: 7,
                        padding: "5px 10px", marginBottom: 8,
                        borderLeft: "3px solid #E5E7EB",
                      }}>
                        {s.note}
                      </div>
                    )}

                    {/* meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Avatar name={s.completedBy} size={22} />
                        <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                          {s.completedBy || "Unknown"}
                        </span>
                      </div>
                      {s.done && s.completedAt && (
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                          {fmtDate(s.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ TRANSFER HISTORY ══ */}
      {transferLog.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "#DBEAFE", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>🔀</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Transfer history</span>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...transferLog]
              .sort((a, b) => new Date(a.transferredAt) - new Date(b.transferredAt))
              .map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 10,
                  background: "#FAFAFA", border: "1px solid #E5E7EB",
                  borderRadius: 12, padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#991B1B" }}>{log.from}</span>
                    </div>
                    <span style={{ fontSize: 18, color: "#D1D5DB", fontWeight: 300 }}>→</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#065F46" }}>{log.to}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmtDate(log.transferredAt)}</span>
                    {log.note && (
                      <span style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>"{log.note}"</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ══ STATUS HISTORY ══ */}
      {statusLogs.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "#FEF3C7", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>📋</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Status history</span>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[...statusLogs].reverse().map((log, i) => {
              const sc = getStatusStyle(log.status);
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                  padding: "11px 16px", borderRadius: 11,
                  background: sc.bg,
                  border: `1px solid ${sc.border}55`,
                  borderLeft: `4px solid ${sc.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: sc.color }}>
                        {log.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar name={log.updatedBy} size={22} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: sc.color + "cc" }}>
                        {log.updatedBy}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: sc.color + "99", fontWeight: 500 }}>
                    {fmtDate(log.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default RepairStepsTimeline;