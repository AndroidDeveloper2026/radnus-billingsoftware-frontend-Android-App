import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  Wrench, LogOut, Search, RefreshCw, ChevronUp, ChevronDown,
  Trash2, Plus, ArrowLeftRight, Phone, Smartphone, AlertCircle,
  FileText, Calendar, CheckCircle2, ClipboardList, MessageSquare,
  Inbox, Undo2, Rocket, Loader2, User, Menu, BarChart3, PackageCheck,
  X, Clock, ArrowUpDown, LayoutList
} from "lucide-react";

const STATUS_STEPS = [
  { key: "Received",   label: "Received",   icon: Inbox,        color: "#3b82f6", bg: "#dbeafe" },
  { key: "Diagnosing", label: "Diagnosing", icon: Search,       color: "#f59e0b", bg: "#fef3c7" },
  { key: "Repairing",  label: "Repairing",  icon: Wrench,       color: "#8b5cf6", bg: "#ede9fe" },
  { key: "Ready",      label: "Ready",      icon: CheckCircle2, color: "#10b981", bg: "#d1fae5" },
  { key: "Return",     label: "Return",     icon: Undo2,        color: "#ef4444", bg: "#fee2e2" },
  { key: "Delivered",  label: "Delivered",  icon: Rocket,       color: "#059669", bg: "#a7f3d0" },
];

// Active view-la kaattura statuses
const ACTIVE_KEYS = ["Received", "Diagnosing", "Repairing", "Ready"];

// Reception status -> engineer status (initial mapping, engineer maathina apram freeze)
const STATUS_ALIAS = { Received: "Received", Pending: "Repairing", Repaired: "Ready" };

// Delivered mattum reception-la irundhu sync aagum
const getEngineerStatus = (job) => {
  const ms = job.device?.mobileStatus;
  if (ms === "Delivered" || ms === "Delivered NR/NA") return "Delivered";
  return job.engineerStatus || STATUS_ALIAS[ms] || "Received";
};

const getStaleDays = (job) => {
  const dates = [new Date(job.createdAt)];
  if (job.statusLogs?.length > 0) {
    const last = job.statusLogs[job.statusLogs.length - 1];
    if (last.timestamp) dates.push(new Date(last.timestamp));
  }
  if (job.repairSteps?.length > 0) {
    job.repairSteps.forEach(s => { if (s.completedAt) dates.push(new Date(s.completedAt)); });
  }
  return Math.floor((Date.now() - new Date(Math.max(...dates)).getTime()) / (1000 * 60 * 60 * 24));
};

const getDeliveredDate = (job) =>
  new Date(job.service?.deliveryDate || job.updatedAt || job.createdAt);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "-";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

const monthKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};

const FADE_MS = 200; // old cards fade-out duration (filter change)

const StaleBadge = ({ days }) => {
  if (days < 2) return null;
  const s = days >= 7
    ? { bg: "#fee2e2", color: "#991b1b", label: `${days}d stale` }
    : days >= 3
    ? { bg: "#fef3c7", color: "#92400e", label: `${days}d stale` }
    : { bg: "#dbeafe", color: "#1e40af", label: `${days}d stale` };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: s.bg, color: s.color, fontSize: "10px", padding: "2px 7px", borderRadius: "8px", fontWeight: 700 }}>
      <AlertCircle size={11} /> {s.label}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const st = STATUS_STEPS.find(s => s.key === status) || STATUS_STEPS[0];
  const Icon = st.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: st.bg, color: st.color, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      <Icon size={12} /> {st.label}
    </span>
  );
};

const EngineerDashboard = () => {
  const { name }    = useParams();
  const navigate    = useNavigate();
  const API         = import.meta.env.VITE_API_URL;
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const engineerName = user?.name || user?.username || name || "";

  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [updating,    setUpdating]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [expandedJob, setExpandedJob] = useState(null);

  // ── view / filter state ──
  const [view,          setView]          = useState("active"); // active | return | delivered | report
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [staleOnly,     setStaleOnly]     = useState(false);
  const [sortOrder,     setSortOrder]     = useState("oldest"); // oldest | newest
  const [monthFilter,   setMonthFilter]   = useState("All");
  const [detailJob,     setDetailJob]     = useState(null);

  const [newStepText,    setNewStepText]    = useState({});
  const [newStepNote,    setNewStepNote]    = useState({});
  const [stepLoading,    setStepLoading]    = useState(null);

  const [transferJobId,    setTransferJobId]    = useState(null);
  const [transferTo,       setTransferTo]       = useState("");
  const [transferNote,     setTransferNote]     = useState("");
  const [transferLoading,  setTransferLoading]  = useState(false);
  const [engineerList,     setEngineerList]     = useState([]);

  useEffect(() => {
    if (user?.role === "engineer") {
      const urlName = name?.toLowerCase();
      const myName  = (user?.name || user?.username)?.toLowerCase();
      if (urlName !== myName) navigate(`/engineer/${myName}`);
    }
  }, [name]);

  useEffect(() => {
    axios.get(`${API}/api/engineers`).then(res => setEngineerList(res.data)).catch(console.error);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/jobsheets/filter`, { params: { engineer: engineerName } });
      setJobs(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (engineerName) fetchJobs(); }, [engineerName]);

  const handleStatusUpdate = async (jobId, newStatus) => {
    setUpdating(jobId);
    try {
      await axios.patch(`${API}/api/jobsheets/${jobId}/status`, { status: newStatus, updatedBy: engineerName });
      setJobs(prev => prev.map(j => j._id === jobId
        ? { ...j, engineerStatus: newStatus, statusLogs: [...(j.statusLogs || []), { status: newStatus, updatedBy: engineerName, timestamp: new Date() }] }
        : j));
    } catch { alert("Update failed"); }
    finally { setUpdating(null); }
  };

  const handleAddStep = async (jobId) => {
    const step = newStepText[jobId]?.trim();
    if (!step) return alert("Step text எழுதுங்க!");
    setStepLoading(jobId);
    try {
      const res = await axios.post(`${API}/api/jobsheets/${jobId}/steps`, { step, note: newStepNote[jobId] || "", completedBy: engineerName });
      setJobs(prev => prev.map(j => j._id === jobId ? res.data : j));
      setNewStepText(prev => ({ ...prev, [jobId]: "" }));
      setNewStepNote(prev => ({ ...prev, [jobId]: "" }));
    } catch { alert("Step add failed"); }
    finally { setStepLoading(null); }
  };

  const handleToggleStep = async (jobId, stepId, currentDone) => {
    try {
      const res = await axios.patch(`${API}/api/jobsheets/${jobId}/steps/${stepId}`, { done: !currentDone, completedBy: engineerName });
      setJobs(prev => prev.map(j => j._id === jobId ? res.data : j));
    } catch { alert("Step update failed"); }
  };

  const handleDeleteStep = async (jobId, stepId) => {
    if (!window.confirm("Delete this step?")) return;
    try {
      const res = await axios.delete(`${API}/api/jobsheets/${jobId}/steps/${stepId}`);
      setJobs(prev => prev.map(j => j._id === jobId ? res.data : j));
    } catch { alert("Delete failed"); }
  };

  const handleTransfer = async () => {
    if (!transferTo) return alert("Please Select the Engineer !");
    if (transferTo === engineerName) return alert("You can't transfer it to yourself!");

    setTransferLoading(true);

    try {
      await axios.patch(`${API}/api/jobsheets/${transferJobId}/transfer`, {
        from: engineerName,
        to: transferTo,
        note: transferNote
      });
      setJobs(prev => prev.filter(j => j._id !== transferJobId));
      setTransferJobId(null);
      setTransferTo("");
      setTransferNote("");

      alert(
        transferTo === "Reception"
          ? `Job returned to Reception!`
          : `Job transferred to ${transferTo}`
      );
    } catch (err) {
      alert(err.response?.data?.message || "Transfer failed");
    } finally {
      setTransferLoading(false);
    }
  };

  /* ================= DERIVED DATA ================= */
  const q = search.toLowerCase();
  const matchesSearch = (j) =>
    !q ||
    j.jobSheetNo?.toLowerCase().includes(q) ||
    j.customer?.name?.toLowerCase().includes(q) ||
    j.customer?.contact?.includes(q) ||
    j.device?.model?.toLowerCase().includes(q);

  const buckets = useMemo(() => {
    const b = { active: [], returned: [], delivered: [] };
    jobs.forEach(j => {
      const st = getEngineerStatus(j);
      if (st === "Delivered") b.delivered.push(j);
      else if (j.isCancelled || st === "Return") b.returned.push(j);
      else if (ACTIVE_KEYS.includes(st)) b.active.push(j);
    });
    return b;
  }, [jobs]);

  const activeCounts = useMemo(() => {
    const c = {};
    ACTIVE_KEYS.forEach(k => { c[k] = 0; });
    buckets.active.forEach(j => { c[getEngineerStatus(j)] += 1; });
    return c;
  }, [buckets]);

  const staleActiveCount = useMemo(
    () => buckets.active.filter(j => getStaleDays(j) >= 3).length,
    [buckets]
  );

  const activeList = useMemo(() => {
    let list = buckets.active.filter(matchesSearch);
    if (statusFilter !== "All") list = list.filter(j => getEngineerStatus(j) === statusFilter);
    if (staleOnly) list = list.filter(j => getStaleDays(j) >= 3);
    list = [...list].sort((a, b) =>
      sortOrder === "oldest"
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt)
    );
    return list;
  }, [buckets, search, statusFilter, staleOnly, sortOrder]);

  /* ── filter change: old cards fade-out -> new cards fade-in ── */
  const filterSig = `${statusFilter}|${staleOnly}|${sortOrder}`;
  const prevSig   = useRef(filterSig);
  const [shownActive, setShownActive] = useState(activeList);
  const [leaving,     setLeaving]     = useState(false);
  const [gridKey,     setGridKey]     = useState(0);

  useEffect(() => {
    if (prevSig.current !== filterSig) {
      // filter/sort maarirukku -> fade-out, apram swap
      prevSig.current = filterSig;
      setLeaving(true);
      const t = setTimeout(() => {
        setShownActive(activeList);
        setLeaving(false);
        setGridKey(k => k + 1); // remount -> card-anim stagger replay
      }, FADE_MS);
      return () => clearTimeout(t);
    }
    // search typing / status update / refresh -> immediate, no fade
    setShownActive(activeList);
    setLeaving(false);
  }, [activeList, filterSig]);

  const deliveredMonths = useMemo(() => {
    const set = new Set(buckets.delivered.map(j => monthKey(getDeliveredDate(j))));
    return [...set].sort().reverse();
  }, [buckets]);

  const deliveredList = useMemo(() => {
    let list = buckets.delivered.filter(matchesSearch);
    if (monthFilter !== "All") list = list.filter(j => monthKey(getDeliveredDate(j)) === monthFilter);
    return [...list].sort((a, b) => getDeliveredDate(b) - getDeliveredDate(a));
  }, [buckets, search, monthFilter]);

  const returnedList = useMemo(
    () => buckets.returned.filter(matchesSearch).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [buckets, search]
  );

  const report = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(startOfDay); weekStart.setDate(weekStart.getDate() - 6);
    const thisMonth = monthKey(now);

    let today = 0, week = 0, month = 0, turnaroundSum = 0, turnaroundCount = 0;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay); d.setDate(d.getDate() - i);
      days.push({ date: d, label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: 0 });
    }

    buckets.delivered.forEach(j => {
      const dd = getDeliveredDate(j);
      if (dd >= startOfDay) today++;
      if (dd >= weekStart) week++;
      if (monthKey(dd) === thisMonth) {
        month++;
        const diff = (dd - new Date(j.createdAt)) / (1000 * 60 * 60 * 24);
        if (diff >= 0) { turnaroundSum += diff; turnaroundCount++; }
      }
      days.forEach(d => {
        if (dd >= d.date && dd < new Date(d.date.getTime() + 24 * 60 * 60 * 1000)) d.count++;
      });
    });

    return {
      today, week, month,
      total: buckets.delivered.length,
      avgTurnaround: turnaroundCount ? (turnaroundSum / turnaroundCount).toFixed(1) : "-",
      days,
      maxDay: Math.max(1, ...days.map(d => d.count)),
    };
  }, [buckets]);

  const otherEngineers = engineerList
    .map(e => e.name || e)
    .filter(n => n.toLowerCase() !== engineerName.toLowerCase());

  /* ================= SIDEBAR ITEMS ================= */
  const navItems = [
    { key: "active",    label: "Active Jobs", icon: LayoutList,   count: buckets.active.length,    color: "#3b82f6" },
    { key: "return",    label: "Return / Cancelled", icon: Undo2, count: buckets.returned.length,  color: "#ef4444" },
    { key: "delivered", label: "Delivered",   icon: PackageCheck, count: buckets.delivered.length, color: "#059669" },
    { key: "report",    label: "My Report",   icon: BarChart3,    count: null,                     color: "#8b5cf6" },
  ];
  const activeNavIndex = Math.max(0, navItems.findIndex(n => n.key === view));
  const activeNav      = navItems[activeNavIndex];

  /* ================= JOB CARD (active view) ================= */
  const renderJobCard = (job, idx = 0) => {
    const currentStatus = getEngineerStatus(job);
    const currentStep   = STATUS_STEPS.find(s => s.key === currentStatus) || STATUS_STEPS[0];
    const CurrentIcon   = currentStep.icon;
    const isUpdating    = updating === job._id;
    const isExpanded    = expandedJob === job._id;
    const steps         = job.repairSteps || [];
    const doneCount     = steps.filter(s => s.done).length;
    const lastTransfer  = job.transferLog?.slice(-1)[0];
    const staleDays     = getStaleDays(job);

    return (
      <div key={job._id} className="card-anim" style={{
        animationDelay: `${Math.min(idx, 8) * 45}ms`,
        background: "#fff", borderRadius: "14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden",
        border: `1px solid ${staleDays >= 7 ? "#fca5a5" : staleDays >= 3 ? "#fcd34d" : "#e2e8f0"}`,
      }}>
        <div style={{ background: "#1e293b", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "14px" }}>{job.jobSheetNo}</span>
            {lastTransfer && lastTransfer.to?.toLowerCase() === engineerName.toLowerCase() && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "2px 6px", borderRadius: "8px", fontWeight: 600 }}>
                <ArrowLeftRight size={10} /> from {lastTransfer.from}
              </span>
            )}
            <StaleBadge days={staleDays} />
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: currentStep.bg, color: currentStep.color, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
            <CurrentIcon size={12} /> {currentStep.label}
          </span>
        </div>

        <div style={{ padding: "14px 16px" }}>
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
              <User size={13} /> {job.customer?.name || "-"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#64748b" }}>
              <Phone size={11} /> {job.customer?.contact || "-"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#475569", marginTop: "4px" }}>
              <Smartphone size={11} /> {job.device?.make || "-"} {job.device?.model || "-"}
            </div>
            {job.visualIssues?.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#7c3aed", marginTop: "4px" }}>
                <AlertCircle size={11} /> {job.visualIssues.filter(Boolean).join(", ")}
              </div>
            )}
            {job.service?.remarks && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#059669", marginTop: "4px" }}>
                <FileText size={11} /> {job.service.remarks}
              </div>
            )}
            {lastTransfer?.note && lastTransfer.to?.toLowerCase() === engineerName.toLowerCase() && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#f59e0b", marginTop: "4px", background: "#fef3c7", padding: "4px 8px", borderRadius: "6px" }}>
                <MessageSquare size={11} /> {lastTransfer.note}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
              <Calendar size={11} /> {fmtDate(job.createdAt)}
            </div>
          </div>

          {/* STATUS BUTTONS */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px", marginBottom: "10px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "8px" }}>UPDATE STATUS:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {STATUS_STEPS.filter(s => s.key !== "Delivered").map(s => {
                const isActive = currentStatus === s.key;
                const Icon = s.icon;
                return (
                  <button key={s.key} onClick={() => !isActive && handleStatusUpdate(job._id, s.key)} disabled={isActive || isUpdating}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                      borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                      cursor: isActive ? "default" : "pointer",
                      border: `2px solid ${s.color}`,
                      background: isActive ? s.color : "#fff",
                      color: isActive ? "#fff" : s.color,
                      boxShadow: isActive ? `0 0 0 3px ${s.bg}` : "none",
                      opacity: isUpdating ? 0.6 : 1,
                    }}>
                    {isUpdating && isActive ? <Loader2 size={12} className="spin" /> : <Icon size={12} />} {s.label}
                  </button>
                );
              })}
              <button onClick={() => setTransferJobId(job._id)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "1px solid #f59e0b", background: "#fff", color: "#92400e" }}>
                <ArrowLeftRight size={12} /> Transfer
              </button>
            </div>
          </div>

          {/* REPAIR STEPS */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
            <div onClick={() => setExpandedJob(isExpanded ? null : job._id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                <Wrench size={12} /> REPAIR STEPS
                {steps.length > 0 && (
                  <span style={{ marginLeft: "6px", background: "#f1f5f9", padding: "1px 7px", borderRadius: "10px", color: "#475569" }}>
                    {doneCount}/{steps.length}
                  </span>
                )}
              </div>
              {isExpanded ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
            </div>
            {steps.length > 0 && (
              <div style={{ background: "#f1f5f9", borderRadius: "4px", height: "5px", marginBottom: "8px" }}>
                <div style={{ background: "#10b981", borderRadius: "4px", height: "5px", width: `${(doneCount / steps.length) * 100}%`, transition: "width 0.3s" }} />
              </div>
            )}
            {isExpanded && (
              <div className="view-anim">
                {steps.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", padding: "10px" }}>No steps yet ↓</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {steps.map((s, i) => (
                      <div key={s._id} style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: s.done ? "#f0fdf4" : "#fafafa", border: `1px solid ${s.done ? "#86efac" : "#e2e8f0"}`, borderRadius: "8px", padding: "8px 10px" }}>
                        <input type="checkbox" checked={s.done} onChange={() => handleToggleStep(job._id, s._id, s.done)} style={{ marginTop: "2px", cursor: "pointer", accentColor: "#10b981" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: s.done ? "#15803d" : "#1e293b", textDecoration: s.done ? "line-through" : "none" }}>{i + 1}. {s.step}</div>
                          {s.note && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                              <FileText size={10} /> {s.note}
                            </div>
                          )}
                          {s.completedBy && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "10px", color: "#7c3aed", marginTop: "2px" }}>
                              <User size={10} /> {s.completedBy}
                            </div>
                          )}
                          {s.done && s.completedAt && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "10px", color: "#86efac", marginTop: "2px" }}>
                              <CheckCircle2 size={10} /> {fmtDateTime(s.completedAt)}
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleDeleteStep(job._id, s._id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px", border: "1px dashed #cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "6px" }}>
                    <Plus size={12} /> Add New Step
                  </div>
                  <input type="text" placeholder="Step description" value={newStepText[job._id] || ""} onChange={e => setNewStepText(prev => ({ ...prev, [job._id]: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", marginBottom: "6px", outline: "none", boxSizing: "border-box" }} />
                  <input type="text" placeholder="Note (optional)" value={newStepNote[job._id] || ""} onChange={e => setNewStepNote(prev => ({ ...prev, [job._id]: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", marginBottom: "8px", outline: "none", boxSizing: "border-box" }} />
                  <button onClick={() => handleAddStep(job._id)} disabled={stepLoading === job._id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", width: "100%" }}>
                    {stepLoading === job._id ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} {stepLoading === job._id ? "Adding..." : "Add Step"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ================= HISTORY TABLE (delivered / return) ================= */
  const renderHistoryTable = (list, mode) => (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#64748b", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "10px 14px" }}>Job No</th>
              <th style={{ padding: "10px 14px" }}>Customer</th>
              <th style={{ padding: "10px 14px" }}>Contact</th>
              <th style={{ padding: "10px 14px" }}>Device</th>
              <th style={{ padding: "10px 14px" }}>Issue</th>
              <th style={{ padding: "10px 14px" }}>Received</th>
              <th style={{ padding: "10px 14px" }}>{mode === "delivered" ? "Delivered" : "Updated"}</th>
              <th style={{ padding: "10px 14px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map(j => (
              <tr key={j._id} onClick={() => setDetailJob(j)}
                style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "#2563eb" }}>{j.jobSheetNo}</td>
                <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 600 }}>{j.customer?.name || "-"}</td>
                <td style={{ padding: "10px 14px", color: "#64748b" }}>{j.customer?.contact || "-"}</td>
                <td style={{ padding: "10px 14px", color: "#475569" }}>{j.device?.make || ""} {j.device?.model || "-"}</td>
                <td style={{ padding: "10px 14px", color: "#7c3aed", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(j.visualIssues || []).filter(Boolean).join(", ") || "-"}
                </td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{fmtDate(j.createdAt)}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>
                  {fmtDate(mode === "delivered" ? getDeliveredDate(j) : j.updatedAt)}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {j.isCancelled
                    ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Cancelled</span>
                    : <StatusPill status={getEngineerStatus(j)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div style={{ textAlign: "center", padding: "50px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Inbox size={28} /> No jobs found
        </div>
      )}
    </div>
  );

  const sectionTitle = {
    active: "Active Jobs",
    return: "Return / Cancelled",
    delivered: "Delivered History",
    report: "My Report",
  }[view];

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>

      {/* ── TRANSFER MODAL ── */}
      {transferJobId && (
        <>
          <div className="fade-anim" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={() => setTransferJobId(null)} />
          <div className="modal-anim" style={{ position: "fixed", top: "50%", left: "50%", background: "#fff", borderRadius: "16px", padding: "24px", width: "400px", maxWidth: "92vw", zIndex: 1001, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowLeftRight size={18} /> Transfer Job
            </h3>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              Job: <b style={{ color: "#2563eb" }}>{jobs.find(j => j._id === transferJobId)?.jobSheetNo}</b> — {jobs.find(j => j._id === transferJobId)?.customer?.name}
            </div>

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Transfer to:</label>
            <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", marginTop: "4px", marginBottom: "12px" }}>
              <option value="">-- Select Target --</option>
              <option value="Reception">Reception (Free up capacity)</option>
              <optgroup label="Engineers">
                {otherEngineers.map((eng, i) => (
                  <option key={i} value={eng}>{eng}</option>
                ))}
              </optgroup>
            </select>

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Note (optional):</label>
            <textarea rows={2} placeholder="e.g. Step 2 done, IC check பண்ணுங்க" value={transferNote} onChange={e => setTransferNote(e.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", marginTop: "4px", marginBottom: "16px", outline: "none", resize: "none", boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleTransfer} disabled={transferLoading}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                {transferLoading ? <><Loader2 size={14} className="spin" /> Transferring...</> : <><ArrowLeftRight size={14} /> Transfer</>}
              </button>
              <button onClick={() => { setTransferJobId(null); setTransferTo(""); setTransferNote(""); }}
                style={{ flex: 1, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DETAIL MODAL (delivered / return rows) ── */}
      {detailJob && (
        <>
          <div className="fade-anim" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={() => setDetailJob(null)} />
          <div className="modal-anim" style={{ position: "fixed", top: "50%", left: "50%", background: "#fff", borderRadius: 16, padding: 24, width: 520, maxWidth: "94vw", maxHeight: "86vh", overflowY: "auto", zIndex: 1001, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#2563eb" }}>{detailJob.jobSheetNo}</span>
                <StatusPill status={getEngineerStatus(detailJob)} />
              </div>
              <button onClick={() => setDetailJob(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8, marginBottom: 14 }}>
              <div><b>{detailJob.customer?.name || "-"}</b> · {detailJob.customer?.contact || "-"}</div>
              <div>{detailJob.device?.make} {detailJob.device?.model}</div>
              <div style={{ color: "#7c3aed" }}>{(detailJob.visualIssues || []).filter(Boolean).join(", ") || "-"}</div>
              {detailJob.service?.remarks && <div style={{ color: "#059669" }}>{detailJob.service.remarks}</div>}
              <div style={{ color: "#94a3b8" }}>Received: {fmtDate(detailJob.createdAt)}</div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>REPAIR STEPS</div>
            {(detailJob.repairSteps || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>No steps recorded</div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {detailJob.repairSteps.map((s, i) => (
                  <div key={s._id} style={{ fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f1f5f9", color: s.done ? "#15803d" : "#475569" }}>
                    {s.done ? "✔" : "○"} {i + 1}. {s.step}
                    {s.note ? <span style={{ color: "#94a3b8" }}> — {s.note}</span> : null}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>STATUS HISTORY</div>
            {(detailJob.statusLogs || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>No history</div>
            ) : (
              [...detailJob.statusLogs].reverse().map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{l.status}{l.updatedBy ? <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {l.updatedBy}</span> : null}</span>
                  <span style={{ color: "#94a3b8" }}>{fmtDateTime(l.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── NAVBAR ── */}
      <div style={{ background: "#1e293b", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
            <Menu size={20} />
          </button>
          <Wrench size={18} color="#fff" />
          <span style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>Engineer Dashboard</span>
          <span style={{ marginLeft: "4px", fontSize: "13px", color: "#60a5fa", fontWeight: 600 }}>/ {engineerName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 16px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start" }}>

        {/* ── SIDEBAR ── */}
        <div style={{
          width: sidebarOpen ? 230 : 0,
          flexShrink: 0,
          background: "#fff",
          borderRight: `1px solid ${sidebarOpen ? "#e2e8f0" : "transparent"}`,
          minHeight: "calc(100vh - 56px)",
          position: "sticky", top: 56,
          overflow: "hidden",
          transition: "width .35s cubic-bezier(.4,0,.2,1), border-color .35s ease",
          willChange: "width",
        }}>
          {/* fixed-width inner → content squish aagaadhu */}
          <div style={{
            width: 230, boxSizing: "border-box", padding: "16px 10px",
            opacity: sidebarOpen ? 1 : 0,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-28px)",
            transition: "opacity .3s ease, transform .35s cubic-bezier(.4,0,.2,1)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "0 10px 8px", letterSpacing: 0.5 }}>MENU</div>

            <div style={{ position: "relative" }}>
              {/* sliding active indicator */}
              <div style={{
                position: "absolute", left: 0, right: 0, height: 40, borderRadius: 10,
                top: activeNavIndex * 44,
                background: activeNav.color,
                boxShadow: `0 4px 12px ${activeNav.color}55`,
                transition: "top .3s cubic-bezier(.4,0,.2,1), background .3s ease, box-shadow .3s ease",
              }} />

              {navItems.map((item, i) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <button key={item.key} onClick={() => setView(item.key)}
                    style={{
                      position: "relative", zIndex: 1, width: "100%", height: 40, marginBottom: 4,
                      display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                      borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                      background: "transparent",
                      color: active ? "#fff" : "#334155", fontWeight: 600, fontSize: 13,
                      transition: `color .25s ease, opacity .3s ease ${sidebarOpen ? i * 50 : 0}ms, transform .35s ease ${sidebarOpen ? i * 50 : 0}ms`,
                      opacity: sidebarOpen ? 1 : 0,
                      transform: sidebarOpen ? "translateX(0)" : "translateX(-16px)",
                    }}>
                    <Icon size={16} color={active ? "#fff" : item.color} style={{ transition: "color .25s" }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.count !== null && (
                      <span style={{
                        background: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                        color: active ? "#fff" : "#475569", fontSize: 11, padding: "1px 8px", borderRadius: 10,
                        transition: "background .25s, color .25s",
                      }}>{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {staleActiveCount > 0 && (
              <div
                onClick={() => { setView("active"); setStaleOnly(true); setStatusFilter("All"); }}
                className="stale-box"
                style={{ marginTop: 16, background: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={14} /> {staleActiveCount} job{staleActiveCount > 1 ? "s" : ""} stale (3+ days)
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, minWidth: 0, padding: "20px", contain: "layout" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b", fontWeight: 700 }}>{sectionTitle}</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {view !== "report" && (
                <div style={{ position: "relative", width: "300px", maxWidth: "100%" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="text" placeholder="Search job no / name / contact / model" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 14px 8px 32px", fontSize: "13px", width: "100%", outline: "none", boxSizing: "border-box", background: "#fff" }} />
                </div>
              )}
              <button onClick={fetchJobs} disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                <RefreshCw size={14} className={loading ? "spin" : ""} /> {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {loading && jobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Loader2 size={22} className="spin" /> Loading...
            </div>
          ) : (
            <div key={view} className="view-anim">
              {/* ═════════ ACTIVE VIEW ═════════ */}
              {view === "active" && (
                <>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <div className="stat-card" onClick={() => setStatusFilter("All")}
                      style={{ background: "#fff", borderRadius: "12px", padding: "12px 20px", boxShadow: statusFilter === "All" ? "0 0 0 2px #1e293b" : "0 1px 4px rgba(0,0,0,0.08)", minWidth: "110px", borderTop: "3px solid #1e293b", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                        <ClipboardList size={13} color="#1e293b" /> All Active
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: "#1e293b" }}>{buckets.active.length}</div>
                    </div>
                    {STATUS_STEPS.filter(s => ACTIVE_KEYS.includes(s.key)).map(s => {
                      const Icon = s.icon;
                      const selected = statusFilter === s.key;
                      return (
                        <div key={s.key} className="stat-card" onClick={() => setStatusFilter(selected ? "All" : s.key)}
                          style={{ background: "#fff", borderRadius: "12px", padding: "12px 20px", boxShadow: selected ? `0 0 0 2px ${s.color}` : "0 1px 4px rgba(0,0,0,0.08)", minWidth: "110px", borderTop: `3px solid ${s.color}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                            <Icon size={13} color={s.color} /> {s.label}
                          </div>
                          <div style={{ fontSize: "24px", fontWeight: 700, color: s.color }}>{activeCounts[s.key] || 0}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => setStaleOnly(v => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${staleOnly ? "#f59e0b" : "#cbd5e1"}`, background: staleOnly ? "#fef3c7" : "#fff", color: staleOnly ? "#92400e" : "#475569" }}>
                      <Clock size={13} /> Stale only
                    </button>
                    <button onClick={() => setSortOrder(o => (o === "oldest" ? "newest" : "oldest"))}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #cbd5e1", background: "#fff", color: "#475569" }}>
                      <ArrowUpDown size={13} /> {sortOrder === "oldest" ? "Oldest first" : "Newest first"}
                    </button>
                    {(statusFilter !== "All" || staleOnly) && (
                      <button onClick={() => { setStatusFilter("All"); setStaleOnly(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "#fee2e2", color: "#991b1b" }}>
                        <X size={12} /> Clear filters
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{activeList.length} job{activeList.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* list wrapper: fade-out on filter change, fade-in via card-anim after swap */}
                  <div style={{
                    opacity: leaving ? 0 : 1,
                    transform: leaving ? "translateY(8px) scale(.99)" : "none",
                    transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
                    pointerEvents: leaving ? "none" : "auto",
                  }}>
                    {shownActive.length === 0 ? (
                      <div key={`empty-${gridKey}`} className="view-anim" style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Inbox size={28} /> No active jobs
                      </div>
                    ) : (
                      <div key={gridKey} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
                        {shownActive.map((j, i) => renderJobCard(j, i))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ═════════ RETURN VIEW ═════════ */}
              {view === "return" && renderHistoryTable(returnedList, "return")}

              {/* ═════════ DELIVERED VIEW ═════════ */}
              {view === "delivered" && (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff" }}>
                      <option value="All">All months</option>
                      {deliveredMonths.map(m => {
                        const [y, mo] = m.split("-");
                        const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                        return <option key={m} value={m}>{label}</option>;
                      })}
                    </select>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{deliveredList.length} delivered</span>
                  </div>
                  <div key={monthFilter} className="view-anim">
                    {renderHistoryTable(deliveredList, "delivered")}
                  </div>
                </>
              )}

              {/* ═════════ REPORT VIEW ═════════ */}
              {view === "report" && (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    {[
                      { label: "Delivered Today", value: report.today, color: "#059669" },
                      { label: "Last 7 Days", value: report.week, color: "#3b82f6" },
                      { label: "This Month", value: report.month, color: "#8b5cf6" },
                      { label: "All Time", value: report.total, color: "#1e293b" },
                      { label: "Avg Turnaround (days)", value: report.avgTurnaround, color: "#f59e0b" },
                      { label: "Stale Active Jobs", value: staleActiveCount, color: "#ef4444" },
                    ].map(c => (
                      <div key={c.label} className="stat-card" style={{ background: "#fff", borderRadius: 12, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", minWidth: 150, borderTop: `3px solid ${c.color}` }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{c.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flex: "1 1 380px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Deliveries — last 7 days</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150 }}>
                        {report.days.map((d, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 4 }}>{d.count}</div>
                            <div style={{ width: "100%", maxWidth: 34, height: `${(d.count / report.maxDay) * 100}%`, minHeight: d.count ? 4 : 2, background: d.count ? "#10b981" : "#e2e8f0", borderRadius: "6px 6px 0 0", transition: "height .3s" }} />
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{d.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flex: "1 1 280px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>Current workload</div>
                      {STATUS_STEPS.filter(s => ACTIVE_KEYS.includes(s.key)).map(s => {
                        const cnt = activeCounts[s.key] || 0;
                        const pct = buckets.active.length ? (cnt / buckets.active.length) * 100 : 0;
                        return (
                          <div key={s.key} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#475569", fontWeight: 600 }}>{s.label}</span>
                              <span style={{ color: s.color, fontWeight: 700 }}>{cnt}</span>
                            </div>
                            <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6 }}>
                              <div style={{ background: s.color, borderRadius: 4, height: 6, width: `${pct}%`, transition: "width .3s" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes viewIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .view-anim  { animation: viewIn .3s ease both; }
        .card-anim  { animation: cardIn .4s cubic-bezier(.2,.8,.2,1) both; }
        .fade-anim  { animation: fadeIn .2s ease both; }
        .modal-anim { animation: modalIn .25s cubic-bezier(.2,.8,.2,1) both; }
        .spin       { animation: spin 0.9s linear infinite; }

        .stat-card { transition: transform .18s ease, box-shadow .18s ease; }
        .stat-card:hover  { transform: translateY(-3px); }
        .stat-card:active { transform: scale(.97); }

        button, select, input { transition: background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease, transform .15s ease; }
        button:active { transform: scale(.96); }

        .stale-box { transition: transform .2s ease, box-shadow .2s ease; }
        .stale-box:hover { transform: translateX(3px); box-shadow: 0 2px 8px rgba(245,158,11,.3); }

        tbody tr { transition: background .15s ease; }
      `}</style>
    </div>
  );
};

export default EngineerDashboard;