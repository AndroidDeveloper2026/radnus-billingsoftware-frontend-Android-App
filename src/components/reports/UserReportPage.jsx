import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
const UserReportPage = () => {
  const [jobSheetNo, setJobSheetNo] = useState("");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (search = "") => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/jobsheets/user-report`, {
        params: { jobSheetNo: search }
      });
      setData(res.data || {});
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setData({});
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchData(jobSheetNo);

  const handleDownloadExcel = () => {
  const rows = [];

  Object.keys(data).sort().forEach((user) => {
    const jobs = data[user];
    jobs.forEach((job, i) => {
      rows.push({
        "User":       user,
        "SL No":      i + 1,
        "Job Sheet":  job.jobSheetNo,
        "Customer":   job.customer?.name || "—",
        "Contact":    job.customer?.contact || "—",
        "Device":     [job.device?.make, job.device?.model].filter(Boolean).join(" ") || "—",
        "Status":     job.device?.mobileStatus || "—",
        "Date":       new Date(job.createdAt).toLocaleDateString(),
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "User Report");
  XLSX.writeFile(wb, `UserReport_${new Date().toLocaleDateString()}.xlsx`);
};

  // ✅ SUMMARY STATS
  const allJobs = Object.values(data).flat();
  const totalUsers = Object.keys(data).length;
  const totalJobs = allJobs.length;
  const today = new Date().toLocaleDateString();
  const todayJobs = allJobs.filter(j =>
    new Date(j.createdAt).toLocaleDateString() === today
  ).length;
  const activeJobs = allJobs.filter(j =>
    !["Delivered", "Delivered NR/NA"].includes(j.device?.mobileStatus)
  ).length;

  // ✅ STATUS BADGE
  const statusBadge = (status) => {
    const map = {
      "Received":        { bg: "#E1F5EE", color: "#0F6E56" },
      "Pending":         { bg: "#FAEEDA", color: "#854F0B" },
      "Repaired":        { bg: "#E6F1FB", color: "#185FA5" },
      "Delivered":       { bg: "#EAF3DE", color: "#3B6D11" },
      "Delivered NR/NA": { bg: "#FAECE7", color: "#993C1D" },
    };
    const s = map[status] || { bg: "#F1EFE8", color: "#5F5E5A" };
    return (
      <span style={{
        background: s.bg, color: s.color,
        padding: "2px 10px", borderRadius: 20,
        fontSize: 11, fontWeight: 500
      }}>
        {status || "—"}
      </span>
    );
  };

  // ✅ AVATAR COLOR
  const avatarColors = [
    { bg: "#CECBF6", color: "#3C3489" },
    { bg: "#9FE1CB", color: "#085041" },
    { bg: "#FAC775", color: "#633806" },
    { bg: "#B5D4F4", color: "#0C447C" },
    { bg: "#F4C0D1", color: "#72243E" },
  ];

  const getAvatar = (name, idx) => {
    const c = avatarColors[idx % avatarColors.length];
    return (
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: c.bg, color: c.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 500, flexShrink: 0
      }}>
        {(name || "?")[0].toUpperCase()}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

      <h4 style={{ fontWeight: 500, marginBottom: 20 }}>User JobSheet Report</h4>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total users",  val: totalUsers },
          { label: "Total jobs",   val: totalJobs  },
          { label: "Today's jobs", val: todayJobs  },
          { label: "Active jobs",  val: activeJobs },
        ].map(m => (
          <div key={m.label} style={{
            background: "#f8f9fa", borderRadius: 8,
            padding: "12px 14px"
          }}>
            <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{m.val}</div>
          </div>
        ))}
      </div>
{/* SEARCH */}
<div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
  <input
    className="form-control"
    placeholder="Search by username or job sheet no..."
    value={jobSheetNo}
    onChange={(e) => setJobSheetNo(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
  />
  <button className="btn btn-primary" onClick={handleSearch}>
    Search
  </button>
  {jobSheetNo && (
    <button className="btn btn-outline-secondary" onClick={() => { setJobSheetNo(""); fetchData(""); }}>
      Clear
    </button>
  )}
  {/* ✅ EXCEL DOWNLOAD */}
  <button
    className="btn btn-success"
    onClick={handleDownloadExcel}
    disabled={Object.keys(data).length === 0}
  >
    ⬇ Excel
  </button>
</div>

      {/* LOADING */}
      {loading && <div className="text-center py-4">Loading...</div>}

      {/* EMPTY */}
      {!loading && Object.keys(data).length === 0 && (
        <div className="text-center text-muted py-4">No data found</div>
      )}

      {/* USER GROUPS */}
      {Object.keys(data).sort().map((user, idx) => {
        const jobs = data[user];
        return (
          <div key={user} style={{
            border: "0.5px solid #dee2e6", borderRadius: 10,
            overflow: "hidden", marginBottom: 24
          }}>

            {/* USER HEADER */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", background: "#f8f9fa",
              borderBottom: "0.5px solid #dee2e6"
            }}>
              {getAvatar(user, idx)}
              <div>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{user || "Unknown"}</span>
                <span style={{ fontSize: 12, color: "#6c757d", marginLeft: 8 }}>
                  {jobs.length} jobs
                </span>
              </div>
            </div>

            {/* TABLE */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    {["#", "Job Sheet", "Customer", "Contact", "Device", "Status", "Date"].map(h => (
                      <th key={h} style={{
                        padding: "8px 10px", textAlign: "left",
                        borderBottom: "0.5px solid #dee2e6",
                        color: "#6c757d", fontWeight: 500, fontSize: 12,
                        whiteSpace: "nowrap"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <tr key={job._id} style={{ borderBottom: "0.5px solid #f0f0f0" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >
                      <td style={{ padding: "8px 10px", color: "#6c757d" }}>{i + 1}</td>
                      <td style={{ padding: "8px 10px", color: "#0d6efd", fontWeight: 500 }}>
                        {job.jobSheetNo}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{job.customer?.name || "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#6c757d" }}>
                        {job.customer?.contact || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6c757d" }}>
                        {[job.device?.make, job.device?.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {statusBadge(job.device?.mobileStatus)}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6c757d", whiteSpace: "nowrap" }}>
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        );
      })}

    </div>
  );
};

export default UserReportPage;