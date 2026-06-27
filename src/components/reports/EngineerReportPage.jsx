import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
const EngineerReportPage = () => {
  const [data, setData] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [engineerList, setEngineerList] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState(""); // ✅ NEW
  const API = import.meta.env.VITE_API_URL;

  /* FETCH */
  const fetchData = async () => {
    try {
      const [jobRes, engRes] = await Promise.all([
        axios.get(`${API}/api/jobsheets/filter`),
        axios.get(`${API}/api/engineers`),        // ✅ engineer list
      ]);
      setData(jobRes.data);
      setEngineerList(engRes.data);
      processData(jobRes.data, "");
    } catch (err) {
      console.error(err);
      alert("Failed ❌");
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* PROCESS */
  const processData = (rawData, engFilter) => {
    let filtered = [...rawData];

    if (search) {
      filtered = filtered.filter((item) =>
        item.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.customer?.contact?.includes(search)
      );
    }

    if (fromDate && toDate) {
      filtered = filtered.filter((item) => {
        const date = new Date(item.createdAt).toISOString().slice(0, 10);
        return date >= fromDate && date <= toDate;
      });
    } else if (fromDate && !toDate) {
      filtered = filtered.filter((item) => {
        const date = new Date(item.createdAt).toISOString().slice(0, 10);
        return date === fromDate;
      });
    }

    // ✅ PARTICULAR ENGINEER FILTER
    if (engFilter) {
      filtered = filtered.filter(
        (item) => item.service?.engineer?.trim().toLowerCase() === engFilter.toLowerCase()
      );
    }

    // ✅ GROUP BY ENGINEER
    const grouped = {};
    filtered.forEach((item) => {
      const eng = item.service?.engineer?.trim() || "No Engineer";
      if (!grouped[eng]) grouped[eng] = [];
      grouped[eng].push(item);
    });

    setGroupedData(grouped);
  };

  const applyFilter = () => processData(data, selectedEngineer);
  const handlePrint = () => window.print();

  const getStatusStyle = (status) => {
    if (status === "Delivered") return "bg-green-100 text-green-700";
    if (status === "Pending") return "bg-yellow-100 text-yellow-700";
    if (status === "Received") return "bg-blue-100 text-blue-700";
    if (status === "Delivered NR/NA") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };
const handleExcelDownload = () => {
  const excelRows = [];

  Object.entries(groupedData).forEach(([engineer, records]) => {
    // Engineer header row
    excelRows.push({
      "SL No": `👨‍🔧 ${engineer} (${records.length} jobs)`,
      "Job No": "", "Customer": "", "Contact": "",
      "Saved Date": "", "Delivered Date": "", "Engineer": "", "Status": "",
    });

    // Data rows
    records.forEach((item, i) => {
      excelRows.push({
        "SL No": i + 1,
        "Job No": item.jobSheetNo || "-",
        "Customer": item.customer?.name || "-",
        "Contact": item.customer?.contact || "-",
        "Saved Date": new Date(item.createdAt).toISOString().slice(0, 10),
        "Delivered Date": item.service?.deliveryDate
          ? new Date(item.service.deliveryDate).toISOString().slice(0, 10)
          : "-",
        "Engineer": item.service?.engineer || "No Engineer",
        "Status": item.device?.mobileStatus || "-",
      });
    });

    // Blank separator
    excelRows.push({
      "SL No": "", "Job No": "", "Customer": "", "Contact": "",
      "Saved Date": "", "Delivered Date": "", "Engineer": "", "Status": "",
    });
  });

  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Engineer Report");
  XLSX.writeFile(wb, `EngineerReport_${fromDate || "All"}_to_${toDate || "All"}.xlsx`);
};
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Engineer Reports</h1>
        <p className="text-gray-500 text-sm">Engineer-wise job tracking report</p>
      </div>

      <div className="bg-white shadow-md rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center print:hidden">

        {/* ✅ ENGINEER DROPDOWN */}
        <select
          value={selectedEngineer}
          onChange={(e) => setSelectedEngineer(e.target.value)}
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Engineers</option>
          {engineerList.map((e) => (
            <option key={e._id} value={e.name}>{e.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search name / contact"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-400"
        />

        <button
          onClick={applyFilter}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
        >
          Apply Filter
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

      {/* GROUPED SECTIONS */}
      {Object.keys(groupedData).length > 0 ? (
        Object.entries(groupedData).map(([engineer, records], idx) => (
          <div key={idx} className="mb-6 bg-white rounded-xl shadow-lg border">

            <div className="bg-blue-50 px-4 py-3 font-semibold text-gray-700 border-b rounded-t-xl">
              👨‍🔧 {engineer}
              <span className="ml-2 text-sm text-gray-500">({records.length} jobs)</span>
            </div>

            <div className="overflow-auto max-h-[400px]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr className="text-gray-700">
                    <th className="p-3 border">SL No</th>
                    <th className="p-3 border">Job No</th>
                    <th className="p-3 border">Customer</th>
                    <th className="p-3 border">Contact</th>
                    <th className="p-3 border">Saved Date</th>
                    <th className="p-3 border">Delivered Date</th>
                    <th className="p-3 border">Engineer</th>

                    <th className="p-3 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item, i) => (
                    <tr key={i} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="p-2 border">{i + 1}</td>
                      <td className="p-2 border font-medium text-blue-700">{item.jobSheetNo || "-"}</td>
                      <td className="p-2 border font-medium text-gray-700">{item.customer?.name || "-"}</td>
                      <td className="p-2 border">{item.customer?.contact || "-"}</td>
                      <td className="p-2 border">{new Date(item.createdAt).toISOString().slice(0, 10)}</td>
                      <td className="p-2 border">
                        {item.service?.deliveryDate
                          ? new Date(item.service.deliveryDate).toISOString().slice(0, 10)
                          : "-"}
                      </td>
                      <td className="p-2 border font-medium text-purple-700">
  {item.service?.engineer || "No Engineer"}
</td>
                      <td className="p-2 border">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusStyle(item.device?.mobileStatus)}`}>
                          {item.device?.mobileStatus || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <p className="text-center mt-6 text-gray-400">No Data Found</p>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
};

export default EngineerReportPage;