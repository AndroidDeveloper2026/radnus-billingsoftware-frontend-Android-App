import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
const DeliveryReport = () => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState([]);
  const API = import.meta.env.VITE_API_URL;

  const fetchReport = async () => {
    try {
      const res = await axios.get(
        `${API}/api/jobsheets/filter`,
        {
          params: { fromDate, toDate }
        }
      );

      let filtered = res.data;

      // DATE FILTER (UNCHANGED)
      filtered = filtered.filter(item => {
        const date = item.service?.repairDate?.slice(0, 10);

        if (fromDate && !toDate) return date === fromDate;
        if (fromDate && toDate) return date >= fromDate && date <= toDate;

        return true;
      });

      // STATUS FILTER (UNCHANGED)
      filtered = filtered.filter(
        item => item.device?.mobileStatus === "Delivered"
      );

      setData(filtered);

    } catch (err) {
      console.error(err);
      alert("Report load failed ❌");
    }
  };

  const handlePrint = () => window.print();

  /* SAME STYLE LIKE REPAIR PAGE */
  const getStatusStyle = (status) => {
    if (status === "Repaired") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-600";
  };
const handleExcelDownload = () => {
  const excelRows = data.map((item, i) => ({
    "SL No": i + 1,
    "Job No": item.jobSheetNo || "-",
    "Customer": item.customer?.name || "-",
    "Make": item.device?.make || "-",
    "Model": item.device?.model || "-",
    "Phone": item.customer?.contact || "-",
    "Date": item.service?.repairDate?.slice(0, 10) || "-",
    "Fault": item.visualIssues?.length ? item.visualIssues.join(", ") : "-",
    "Status": item.device?.mobileStatus || "-",
  }));

  excelRows.push({
    "SL No": "Total", "Job No": data.length, "Customer": "", "Make": "",
    "Model": "", "Phone": "", "Date": "", "Fault": "", "Status": "",
  });

  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Delivery Report");
  XLSX.writeFile(wb, `DeliveryReport_${fromDate || "All"}_to_${toDate || "All"}.xlsx`);
};
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">

      {/* 🔥 MAIN HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Delivery  Report
        </h1>
        <p className="text-gray-500 text-sm">
          Track all repaired devices  delivery
        </p>
      </div>

      {/* 🔥 ACTION BAR */}
      <div className="bg-white shadow-md rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center print:hidden">

        <input
          type="date"
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <button
          onClick={fetchReport}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
        >
          Load Report
        </button>

        <button
          onClick={handlePrint}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
        >
          Print 
        </button>
        <button
  onClick={handleExcelDownload}
  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg shadow"
>
  📥 Excel Download
</button>
      </div>

      {/* 🔥 REPORT CARD */}
      <div className="bg-white rounded-xl shadow-lg border">

        {/* HEADER (NO DUPLICATE TITLE) */}
        <div className="flex justify-between items-center flex-wrap gap-4 border-b p-4 bg-gray-50 rounded-t-xl">

          <div className="text-gray-600 text-sm">
            <span className="font-medium">Total Records:</span>{" "}
            <span className="font-bold text-gray-800">{data.length}</span>
          </div>

          <div className="text-sm text-gray-600 text-right">
            <p><b>From:</b> {fromDate || "-"}</p>
            <p><b>To:</b> {toDate || "-"}</p>
          </div>

        </div>

        {/* 🔥 TABLE */}
        <div className="overflow-auto max-h-[500px]">
          <table className="w-full text-sm border-collapse">

            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr className="text-gray-700">
                <th className="p-3 border">Job No</th>
                <th className="p-3 border">Customer</th>
                <th className="p-3 border">Make</th>
                <th className="p-3 border">Model</th>
                <th className="p-3 border">Phone</th>
                <th className="p-3 border">Date</th>
                <th className="p-3 border">Fault</th>
                <th className="p-3 border">Status</th>
              </tr>
            </thead>

            <tbody>
              {data.length > 0 ? (
                data.map((item, i) => (
                  <tr
                    key={i}
                    className={`border-b hover:bg-gray-50 ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="p-2 border">{item.jobSheetNo || "-"}</td>

                    <td className="p-2 border font-medium text-gray-700">
                      {item.customer?.name || "-"}
                    </td>

                    <td className="p-2 border">{item.device?.make || "-"}</td>

                    <td className="p-2 border">{item.device?.model || "-"}</td>

                    <td className="p-2 border">
                      {item.customer?.contact || "-"}
                    </td>

                    <td className="p-2 border">
                      {item.service?.repairDate?.slice(0, 10) || "-"}
                    </td>

                    <td className="p-2 border">
                      {item.visualIssues?.length
                        ? item.visualIssues.join(", ")
                        : "-"}
                    </td>

                    <td className="p-2 border">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                          item.device?.mobileStatus
                        )}`}
                      >
                        {item.device?.mobileStatus || "-"}
                      </span>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center p-6 text-gray-400">
                    No Data Found
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>
      </div>

      {/* 🔥 PRINT STYLE */}
      <style>
        {`
          @media print {
            body {
              background: white;
            }
            .print\\:hidden {
              display: none;
            }
          }
        `}
      </style>

    </div>
  );
};

export default DeliveryReport;