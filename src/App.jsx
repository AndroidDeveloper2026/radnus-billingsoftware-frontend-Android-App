import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Firstpage from "./components/Firstpage";
import JobSheetPage from "./components/JobSheetPage";
import JobSheetEditWrapper from "./components/JobSheetEditWrapper";
import Home from "./components/Home";
import EstimateBill from "./components/EstimateBill";
import RepairedReport from "./components/reports/Repairedreport";
// App.jsx / routes-ல்
import ServiceRepReportPage from "./components/reports/ServiceRepReportPage";

import SpareReturnReportPage from "./components/reports/Sparereturnreportpage";
import DailyPendingReport from "./components/reports/DailyPendingReport";
import ReportPage from "./components/reports/MainReportPage";
import RepairPendingReport from "./components/reports/RepairPendingReport";
import DeliveryReport from "./components/reports/DeliveryReport";
import ValueReport from "./components/reports/ValueReport";
import EngineerValueReport from "./components/reports/EngineerValueReport";
import DailyReceivedReport from "./components/reports/DailyReceivedReport";
import DailyDeliveredOKReport from "./components/reports/DailyDeliveredOKReport";
import DailyDeliveredNRNAReport from "./components/reports/DailyDeliveredNRNAReport";
import DailyRepairedReport from "./components/reports/DailyRepairedReport";
import AllReportPage from "./components/reports/AllReportPage";
import EngineerReportPage from "./components/reports/EngineerReportPage";
import DealerReportPage from "./components/reports/DealerReportPage";
import InvoiceBill from "./components/InvoiceBill";
import UserReportPage from "./components/reports/UserReportPage";
import UserListPopup from "./components/popups/UserListPopup";
import SpareReportPage from "./components/reports/SpareReportPage";
import ServiceReportPage from "./components/reports/ServiceReportPage";
import OthersReportPage from "./components/reports/OthersReportPage";
import AdvanceReportPage from "./components/reports/AdvanceReportPage";
import IncomeReportPage from "./components/reports/IncomeReportPage";
import EngineerDashboard from "./components/Engineerdashboard"
import RebillReportPage from "./components/reports/RebillReportPage";
import AskRadnusAI from "./components/AskRadnusAI";   // ✅ NEW — Add 1
import RequireAuth from "./components/RequireAuth";       // ✅ route guard
import StoreSwitcher from "./components/StoreSwitcher";   // ✅ multi-store switcher (floating pill)
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <StoreSwitcher />
      <Routes>
        <Route path="/" element={<Firstpage />} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />

        {/* ✅ Dynamic engineer route - /engineer/ajith, /engineer/barani */}
        <Route path="/engineer/:name" element={<RequireAuth><EngineerDashboard /></RequireAuth>} />

        <Route path="/jobsheet" element={<RequireAuth><Navigate to="/jobsheet/new" replace /></RequireAuth>} />
        <Route path="/jobsheet/new" element={<RequireAuth><JobSheetPage isEdit={false} editData={null} /></RequireAuth>} />
        <Route path="/jobsheet/:id" element={<RequireAuth><JobSheetEditWrapper /></RequireAuth>} />

        <Route path="/estimate-bill/:id" element={<RequireAuth><EstimateBill /></RequireAuth>} />
        <Route path="/invoice/:id" element={<RequireAuth><InvoiceBill /></RequireAuth>} />
        <Route path="/report" element={<RequireAuth><ReportPage /></RequireAuth>} />
               <Route path="/pending-report"  element={<RepairPendingReport />} />
        <Route path="/repaired-report" element={<RequireAuth><RepairedReport /></RequireAuth>} />
        <Route path="/delivered-report" element={<RequireAuth><DeliveryReport /></RequireAuth>} />





        
      
        <Route path="/value-report" element={<RequireAuth><ValueReport /></RequireAuth>} />
        <Route path="/engineer-report" element={<RequireAuth><EngineerValueReport /></RequireAuth>} />
        <Route path="/received-report" element={<RequireAuth><DailyReceivedReport /></RequireAuth>} />
     
      <Route path="/daily-pending-report"   element={<DailyPendingReport />} />
<Route path="/daily-repaired-report"  element={<DailyRepairedReport />} />
<Route path="/daily-delivered-report" element={<RequireAuth><DailyDeliveredOKReport /></RequireAuth>} />
        <Route path="/delivered-nrna-report" element={<RequireAuth><DailyDeliveredNRNAReport /></RequireAuth>} />
        <Route path="/all-report" element={<RequireAuth><AllReportPage /></RequireAuth>} />
        <Route path="/engineer-all-report" element={<RequireAuth><EngineerReportPage /></RequireAuth>} />
        <Route path="/dealer-report" element={<RequireAuth><DealerReportPage /></RequireAuth>} />


<Route path="/salesrep-report" element={<RequireAuth><ServiceRepReportPage /></RequireAuth>} />
<Route path="/service-report" element={<RequireAuth><ServiceReportPage /></RequireAuth>} />
<Route path="/income-report" element={<RequireAuth><IncomeReportPage /></RequireAuth>} />
<Route path="/others-report" element={<RequireAuth><OthersReportPage /></RequireAuth>} />
<Route path="/advance-report" element={<RequireAuth><AdvanceReportPage /></RequireAuth>} />

<Route path="/my-report" element={<RequireAuth><ServiceRepReportPage /></RequireAuth>} />
     
        <Route path="/rebill-report" element={<RequireAuth><RebillReportPage /></RequireAuth>} />
        <Route path="/ask-ai" element={<RequireAuth roles={["admin"]}><AskRadnusAI /></RequireAuth>} />   {/* ✅ NEW — Add 2 */}
        <Route path="/user-list" element={<RequireAuth roles={["admin", "storeManager"]}><UserListPopup /></RequireAuth>} />
        <Route path="/spare-report" element={<RequireAuth><SpareReportPage /></RequireAuth>} />
        <Route path="/spare-return-report" element={<RequireAuth><SpareReturnReportPage /></RequireAuth>} />   {/* 👈 NEW */}
      
      </Routes>
    </BrowserRouter>
  );
}

export default App;