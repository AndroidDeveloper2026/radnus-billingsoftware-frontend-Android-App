import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

const AllReportPage = () => {
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ── FILTER STATES ── */
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("");
  const [engineer, setEngineer]   = useState("");
  const [dealer, setDealer]       = useState("");
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");

  const [engineerList, setEngineerList] = useState([]);

  const API = import.meta.env.VITE_API_URL;

  /* ── FETCH ENGINEERS FOR DROPDOWN ── */
  useEffect(() => {
    axios.get(`${API}/api/engineers`)
      .then(res => setEngineerList(res.data))
      .catch(err => console.error(err));
  }, []);

  /* ── FETCH DATA (SERVER-SIDE FILTER) ── */
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)   params.q        = search.trim();
      if (status)   params.status   = status;
      if (engineer) params.engineer = engineer;
      if (dealer)   params.dealer   = dealer.trim();
      if (fromDate) params.fromDate = fromDate;
      if (toDate)   params.toDate   = toDate;

      const res = await axios.get(`${API}/api/jobsheets/filter`, { params });
      setFilteredData(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch data ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ── LOAD ALL ON MOUNT ── */
  useEffect(() => {
    fetchData();
  }, []);

  /* ── RESET FILTER ── */
  const handleReset = () => {
    setSearch("");
    setStatus("");
    setEngineer("");
    setDealer("");
    setFromDate("");
    setToDate("");
    setTimeout(() => {
      axios.get(`${API}/api/jobsheets/filter`)
        .then(res => setFilteredData(res.data))
        .catch(err => console.error(err));
    }, 100);
  };

  /* ── PRINT ── */
  const handlePrint = () => window.print();

  /* ── EXCEL DOWNLOAD ── */
  const handleExcelDownload = () => {
    if (filteredData.length === 0) {
      alert("No data to export ❌");
      return;
    }

    const rows = filteredData.map((item, index) => ({
      "SL No":            index + 1,
      "Job Sheet No":     item.jobSheetNo || "-",
      "Customer Name":    item.customer?.name || "-",
      "Contact":          item.customer?.contact || "-",
      "Alt Contact":      item.customer?.altContact || "-",
      "Email":            item.customer?.email || "-",
      "Address":          item.customer?.address || "-",
      "Make":             item.device?.make || "-",
      "Model":            item.device?.model || "-",
      "IMEI":             item.device?.imei || "-",
      "Warranty":         item.device?.warranty || "-",
      "Status":           item.device?.mobileStatus || "-",
      "Engineer":         item.service?.engineer || "-",
      "Dealer":           item.service?.dealer || "-",
      "Drawer":           item.service?.drawer || "-",
      "Service Charge":   item.service?.serviceCharge || 0,
      "Spare Charge":     item.service?.spareCharge || 0,
      "Total":            (Number(item.service?.serviceCharge || 0) + Number(item.service?.spareCharge || 0)),
      "Payment Mode":     item.service?.paymentMode || "-",
      "Estimate":         item.service?.estimate || "-",
      "Repair Date":      item.service?.repairDate ? new Date(item.service.repairDate).toLocaleDateString("en-IN") : "-",
      "Delivery Date":    item.service?.deliveryDate ? new Date(item.service.deliveryDate).toLocaleDateString("en-IN") : "-",
      "Problems":         item.visualIssues?.join(", ") || "-",
      "Physical Condition": item.physicalCondition?.join(", ") || "-",
      "Accessories":      item.accessories?.join(", ") || "-",
      "Remarks":          item.service?.remarks || "-",
      "Saved Date":       new Date(item.createdAt).toLocaleDateString("en-IN"),
      "Created By":       item.createdBy?.username || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    /* Column widths */
    ws["!cols"] = [
      { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 13 }, { wch: 13 },
      { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 17 },
      { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 14 },
      { wch: 13 }, { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 22 },
      { wch: 22 }, { wch: 13 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Reports");

    const fileName = `All_Report_${fromDate || "all"}_to_${toDate || "all"}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  /* ── STATUS BADGE ── */
  const getStatusStyle = (s) => {
    if (s === "Delivered")      return { background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" };
    if (s === "Pending")        return { background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" };
    if (s === "Received")       return { background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" };
    if (s === "Delivered NR/NA") return { background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" };
    return { background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 };
  };

  /* ── TOTALS ── */
  const totalService = filteredData.reduce((s, i) => s + Number(i.service?.serviceCharge || 0), 0);
  const totalSpare   = filteredData.reduce((s, i) => s + Number(i.service?.spareCharge || 0), 0);
  const totalAmount  = totalService + totalSpare;

  /* ════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "20px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: 0, color: "#1e293b", fontWeight: 700 }}>📋 All Reports</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>Complete job sheet report overview</p>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="print-hidden" style={{
        background: "#fff", borderRadius: "12px", padding: "16px",
        marginBottom: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>

          {/* Search */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Search</label>
            <input
              type="text"
              placeholder="Name / Contact / Job No / IMEI"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchData()}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", width: "220px" }}
            />
          </div>

          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", width: "150px" }}
            >
              <option value="">All Status</option>
              <option value="Received">Received</option>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
              <option value="Delivered NR/NA">Delivered NR/NA</option>
            </select>
          </div>

          {/* Engineer */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Engineer</label>
            <select
              value={engineer}
              onChange={e => setEngineer(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", width: "140px" }}
            >
              <option value="">All Engineers</option>
              {engineerList.map((eng, i) => (
                <option key={i} value={eng.name || eng}>{eng.name || eng}</option>
              ))}
            </select>
          </div>

          {/* Dealer */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Dealer</label>
            <input
              type="text"
              placeholder="Dealer name"
              value={dealer}
              onChange={e => setDealer(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", width: "130px" }}
            />
          </div>

          {/* From Date */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px" }}
            />
          </div>

          {/* To Date */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 10px", fontSize: "13px" }}
            />
          </div>

          {/* Buttons */}
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: "#2563eb", color: "#fff", border: "none",
              borderRadius: "8px", padding: "8px 18px", fontWeight: 600,
              fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            {loading ? "⏳ Loading..." : "🔍 Apply Filter"}
          </button>

          <button
            onClick={handleReset}
            style={{
              background: "#64748b", color: "#fff", border: "none",
              borderRadius: "8px", padding: "8px 14px", fontWeight: 600,
              fontSize: "13px", cursor: "pointer"
            }}
          >
            ↺ Reset
          </button>

          <button
            onClick={handleExcelDownload}
            style={{
              background: "#16a34a", color: "#fff", border: "none",
              borderRadius: "8px", padding: "8px 14px", fontWeight: 600,
              fontSize: "13px", cursor: "pointer"
            }}
          >
            📥 Excel Download
          </button>

          <button
            onClick={handlePrint}
            style={{
              background: "#0891b2", color: "#fff", border: "none",
              borderRadius: "8px", padding: "8px 14px", fontWeight: 600,
              fontSize: "13px", cursor: "pointer"
            }}
          >
            🖨️ Print
          </button>

        </div>
      </div>

      {/* ── SUMMARY ROW ── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        {[
          { label: "Total Records", value: filteredData.length, color: "#2563eb" },
          { label: "Service Charge", value: `₹${totalService.toLocaleString("en-IN")}`, color: "#7c3aed" },
          { label: "Spare Charge",   value: `₹${totalSpare.toLocaleString("en-IN")}`,   color: "#db2777" },
          { label: "Total Amount",   value: `₹${totalAmount.toLocaleString("en-IN")}`,  color: "#059669" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: "10px", padding: "10px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)", minWidth: "140px"
          }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
        <div style={{
          background: "#fff", borderRadius: "10px", padding: "10px 18px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)", fontSize: "12px", color: "#64748b",
          display: "flex", flexDirection: "column", justifyContent: "center"
        }}>
          <div><b>From:</b> {fromDate || "-"}</div>
          <div><b>To:</b>   {toDate   || "-"}</div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{
        background: "#fff", borderRadius: "12px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0", overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto", maxHeight: "62vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>

            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#1e293b", color: "#fff" }}>
                {[
                  "SL", "Job No", "Name", "Contact", "Alt Contact",
                  "Make", "Model", "IMEI", "Warranty", "Status",
                  "Engineer", "Dealer", "Drawer",
                  "Svc ₹", "Spare ₹", "Total ₹", "Payment",
                  "Problems", "Physical Cond.", "Accessories",
                  "Repair Date", "Delivery Date", "Remarks",
                  "Saved Date", "Created By"
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 8px", textAlign: "left", fontWeight: 600,
                    fontSize: "11px", whiteSpace: "nowrap", borderRight: "1px solid #334155"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="25" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    ⏳ Loading...
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((item, index) => {
                  const svc   = Number(item.service?.serviceCharge || 0);
                  const spare = Number(item.service?.spareCharge   || 0);
                  const rowBg = index % 2 === 0 ? "#fff" : "#f8fafc";
                  const td    = { padding: "8px 8px", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", color: "#1e293b" };
                  return (
                    <tr key={index} style={{ background: rowBg }} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                      <td style={{ ...td, color: "#64748b" }}>{index + 1}</td>
                      <td style={{ ...td, fontWeight: 700, color: "#2563eb" }}>{item.jobSheetNo || "-"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{item.customer?.name || "-"}</td>
                      <td style={td}>{item.customer?.contact || "-"}</td>
                      <td style={td}>{item.customer?.altContact || "-"}</td>
                      <td style={td}>{item.device?.make || "-"}</td>
                      <td style={td}>{item.device?.model || "-"}</td>
                      <td style={td}>{item.device?.imei || "-"}</td>
                      <td style={td}>{item.device?.warranty || "-"}</td>
                      <td style={td}>
                        <span style={getStatusStyle(item.device?.mobileStatus)}>
                          {item.device?.mobileStatus || "-"}
                        </span>
                      </td>
                      <td style={td}>{item.service?.engineer || "-"}</td>
                      <td style={td}>{item.service?.dealer || "-"}</td>
                      <td style={td}>{item.service?.drawer || "-"}</td>
                      <td style={{ ...td, color: "#7c3aed", fontWeight: 600 }}>₹{svc.toLocaleString("en-IN")}</td>
                      <td style={{ ...td, color: "#db2777", fontWeight: 600 }}>₹{spare.toLocaleString("en-IN")}</td>
                      <td style={{ ...td, color: "#059669", fontWeight: 700 }}>₹{(svc + spare).toLocaleString("en-IN")}</td>
                      <td style={td}>{item.service?.paymentMode || "-"}</td>
                      <td style={{ ...td, maxWidth: "160px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        {item.visualIssues?.filter(Boolean).join(", ") || "-"}
                      </td>
                      <td style={{ ...td, maxWidth: "160px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        {item.physicalCondition?.join(", ") || "-"}
                      </td>
                      <td style={{ ...td, maxWidth: "120px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        {item.accessories?.join(", ") || "-"}
                      </td>
                      <td style={td}>
                        {item.service?.repairDate
                          ? new Date(item.service.repairDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td style={td}>
                        {item.service?.deliveryDate
                          ? new Date(item.service.deliveryDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td style={{ ...td, maxWidth: "140px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        {item.service?.remarks || "-"}
                      </td>
                      <td style={td}>
                        {new Date(item.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td style={td}>{item.createdBy?.username || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="25" style={{ textAlign: "center", padding: "50px", color: "#94a3b8", fontSize: "15px" }}>
                    📭 No Data Found
                  </td>
                </tr>
              )}
            </tbody>

            {/* FOOTER TOTALS */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr style={{ background: "#1e293b", color: "#fff", fontWeight: 700 }}>
                  <td colSpan="13" style={{ padding: "10px 8px", textAlign: "right", fontSize: "12px" }}>
                    TOTAL ({filteredData.length} records):
                  </td>
                  <td style={{ padding: "10px 8px", color: "#c4b5fd" }}>₹{totalService.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 8px", color: "#f9a8d4" }}>₹{totalSpare.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "10px 8px", color: "#6ee7b7" }}>₹{totalAmount.toLocaleString("en-IN")}</td>
                  <td colSpan="9"></td>
                </tr>
              </tfoot>
            )}

          </table>
        </div>
      </div>

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          body { background: white; font-size: 11px; }
          table { font-size: 10px; }
          th, td { padding: 4px 5px !important; }
        }
      `}</style>

    </div>
  );
};

export default AllReportPage;