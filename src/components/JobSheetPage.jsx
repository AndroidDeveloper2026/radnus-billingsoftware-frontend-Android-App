import React, { useState, useEffect } from "react";
import axios from "axios";
import makeModelData from "../data/makeModelData";
import JobSheetSearchModal from "./JobSheetSearchModal";
import SparePopup from "./SparePopup";
import Select from "react-select";
import RepairStepsTimeline from "./RepairStepsTimeline";
import CustomerAutocomplete from "./CustomerAutocomplete";
import { useNavigate } from "react-router-dom";
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone) => /^\d{10}$/.test(phone);
const isValidIMEI = (imei) => /^\d{15}$/.test(imei);
const isRequired = (value) => value && value.toString().trim().length > 0;
const MAX_JOBS = 5;
const onlyNumbers = (value) => value.replace(/\D/g, "");
const JobSheetPage = ({ editData = null, isEdit = false }) => {
  const [makeList, setMakeList] = useState([]);
  const [modelList, setModelList] = useState([]);
  const navigate = useNavigate();
  const [jobSheetNo, setJobSheetNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [rebilling, setRebilling] = useState(false);
  const pendingNextNo = React.useRef(null);
  const API = import.meta.env.VITE_API_URL;
const [customFaults, setCustomFaults] = useState([]);

  /* ================= VALIDATION (NEW) ================= */
  const [touched, setTouched] = useState({});
  const [formErrors, setFormErrors] = useState({});
 

  // ✅ FIX 1: Null/undefined/empty string check strict-ஆ பண்ணு
const validateField = (name, value) => {
  switch (name) {
    case "customerName":
      return !value || !value?.toString().trim() ? "Customer Name is required" : "";
    
    case "contact":
      // Strict empty check + 10 digit check
      const contactVal = value?.toString().trim();
      if (!contactVal || contactVal === "") return "Contact No is required";
      if (!/^\d{10}$/.test(contactVal)) return "Must be exactly 10 digits";
      return "";
    
    case "email":
      if (!value || value.toString().trim() === "") return "";
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Invalid email format" : "";
    
    default:
      return "";
  }
};

  const handleBlur = (name, value) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setFormErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = () => {
    const errors = {
      customerName: validateField("customerName", customerName),
      contact: validateField("contact", contact),
      email: validateField("email", email),
    };
    setFormErrors(errors);
    setTouched({ customerName: true, contact: true, email: true });
   return !Object.values(errors).some(Boolean);
  };

  /* ================= TIME ================= */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [])


  useEffect(() => {
    axios.get(`${API}/api/makes`)
      .then((res) => setMakeList(res.data))
      .catch((err) => console.error("Make fetch error:", err));
  }, []);

  useEffect(() => {
    if (isEdit && editData) {
      setJobSheetNo(editData.jobSheetNo);
    } else if (pendingNextNo.current) {
      setJobSheetNo(pendingNextNo.current);
      pendingNextNo.current = null;
    } else if (!jobSheetNo) {
      axios.get(`${API}/api/jobsheets/next-number`)
        .then(res => setJobSheetNo(res.data.next))
        .catch(err => console.error(err));
    }
 }, [isEdit, editData]);


  /* ================= SEARCH STATES ================= */

  const [searchText, setSearchText] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [results, setResults] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);


  /* ================= CUSTOMER ================= */
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [altContact, setAltContact] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");


  /* ================= DEVICE ================= */
  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");

 useEffect(() => {
  const selectedMake = make === "__custom" ? customMake : make;

  if (!selectedMake) {
    setModelList([]);
    return;
  }

  axios.get(`${API}/api/models/${selectedMake}`)
    .then(res => setModelList(res.data))
    .catch(err => {
      console.error("Model fetch error:", err);
      setModelList([]);
    });
}, [make, customMake]);

  const [imei, setImei] = useState("");
  const [warranty, setWarranty] = useState("No Warranty");
  const [pattern, setPattern] = useState("");
  const [mobileStatus, setMobileStatus] = useState("");
  const [idProofType, setIdProofType] = useState("");
  const [idProofImage, setIdProofImage] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState(null);

  /* ================= CHECKBOX ARRAYS ================= */
  const [physicalCondition, setPhysicalCondition] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [visualIssues, setVisualIssues] = useState([""]);
  const [faultList, setFaultList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/faults`)
      .then(res => setFaultList(res.data))
      .catch(err => console.error(err));
  }, []);

  const toggleCheckbox = (value, state, setState) => {
    setState(
      state.includes(value)
        ? state.filter(v => v !== value)
        : [...state, value]
    );
  };

/* ── WORKLOAD MAP: { "Barani": 4, "Ajith": 5 } ── */
  const [workloadMap, setWorkloadMap] = useState({});
 
  useEffect(() => {
    axios.get(`${API}/api/engineers`)
      .then(res => setEngineerList(res.data));
  }, []);
 
  // Fetch workload whenever page loads
  useEffect(() => {
    axios.get(`${API}/api/jobsheets/workload`)
      .then(res => {
        const map = {};
        res.data.forEach(e => { map[e.name] = e.activeJobs; });
        setWorkloadMap(map);
      })
      .catch(err => console.error("Workload fetch error:", err));
  }, []); 
  /* ================= SERVICE ================= */
  const today = new Date().toISOString().split("T")[0];
  const [engineer, setEngineer] = useState("");
  const [engineerList, setEngineerList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/engineers`)
      .then(res => setEngineerList(res.data));
  }, []);

  const [dealer, setDealer] = useState("");
  const [drawer, setDrawer] = useState("");

  const [drawerList, setDrawerList] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/drawers`)
      .then(res => setDrawerList(res.data));
  }, []);

  const [serviceCharge, setServiceCharge] = useState("");
  const [spareCharge, setSpareCharge] = useState("");
  const [spareItems, setSpareItems] = useState([]);

  const [sparePopup, setSparePopup] = useState(false);

  const [paymentMode, setPaymentMode] = useState("");
  const [estimate, setEstimate] = useState("");
  const [repairDate, setRepairDate] = useState(today);
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [remarks, setRemarks] = useState("");

  /* ================= VISUAL ISSUES ================= */
  const addIssue = () => setVisualIssues([...visualIssues, ""]);
  const updateIssue = (i, val) => {
    const copy = [...visualIssues];
    copy[i] = val;
    setVisualIssues(copy);
  };
  const removeIssue = (i) =>
    setVisualIssues(visualIssues.filter((_, idx) => idx !== i));


const validateForm = () => {
  const errors = [];

  if (!isRequired(customerName)) errors.push("Customer Name is required");
  if (!isValidPhone(contact)) errors.push("Contact No must be exactly 10 digits");


  // Date validation
  if (repairDate && deliveryDate && new Date(deliveryDate) < new Date(repairDate)) {
    errors.push("Delivery Date cannot be before Repair Date");
  }

  return errors;
};


  /* ================= UPDATE ================= */
const handleUpdate = async () => {
    // ✅ NEW: inline validation
    if (!validateAll()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // ✅ ORIGINAL: date validation still runs
    if (repairDate && deliveryDate && new Date(deliveryDate) < new Date(repairDate)) {
      alert("⚠️ Delivery Date cannot be before Repair Date");
      return;
    }
    try {
      const formData = new FormData();

      formData.append("jobSheetNo", jobSheetNo);

      formData.append(
        "customer",
        JSON.stringify({ name: customerName, contact, altContact, address, email })
      );

      formData.append(
        "device",
        JSON.stringify({
          make: make === "__custom" ? customMake : make,
          model: model === "__custom" ? customModel : model,
          imei,
          warranty,
          pattern,
          mobileStatus,
        })
      );

      formData.append("physicalCondition", JSON.stringify(physicalCondition));
      formData.append("accessories", JSON.stringify(accessories));
      formData.append("visualIssues", JSON.stringify(visualIssues.filter(Boolean)));

      formData.append(
        "service",
        JSON.stringify({
          engineer,
          dealer,
          drawer,
          serviceCharge: Number(serviceCharge || 0),
          spareCharge: Number(spareCharge || 0),
          estimate,
          paymentMode,
          repairDate,
          deliveryDate,
          remarks,
        })
      );

      // ✅ BUG FIX — spareItems update ல் missing ஆச்சு
      formData.append("spareItems", JSON.stringify(spareItems));

      formData.append("idProofType", idProofType);

      if (idProofImage && typeof idProofImage !== "string") {
        formData.append("idProofImage", idProofImage);
      }

      await axios.put(
        `${API}/api/jobsheets/${editData._id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      alert("Job Sheet Updated ✅");
    } catch (err) {
      console.error(err);
      alert("Update failed ❌");
    }
  };

  /* ================= SAVE ================= */

 const handleSave = async () => {

    // 🛑 DOUBLE CLICK STOP
    if (saving) return;

    // ✅ NEW: inline validation replaces alert-based
    if (!validateAll()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // ✅ ORIGINAL: date validation still runs
    if (repairDate && deliveryDate && new Date(deliveryDate) < new Date(repairDate)) {
      alert("⚠️ Delivery Date cannot be before Repair Date");
      return;
    }

   setSaving(true);

    const user = JSON.parse(localStorage.getItem("user"));

    try {
      const formData = new FormData();
      formData.append("jobSheetNo", jobSheetNo);
      formData.append("customer", JSON.stringify({ name: customerName, contact, altContact, address, email }));
      formData.append("device", JSON.stringify({ make: make === "__custom" ? customMake : make, model: model === "__custom" ? customModel : model, imei, warranty, pattern, mobileStatus }));
      formData.append("physicalCondition", JSON.stringify(physicalCondition));
      formData.append("accessories", JSON.stringify(accessories));
      formData.append("visualIssues", JSON.stringify(visualIssues.filter(Boolean)));
      formData.append("service", JSON.stringify({ engineer, dealer, drawer, serviceCharge: Number(serviceCharge || 0), spareCharge: Number(spareCharge || 0), estimate, paymentMode, repairDate, deliveryDate, remarks }));
      formData.append("spareItems", JSON.stringify(spareItems));
      formData.append("idProofType", idProofType);
      if (idProofImage) formData.append("idProofImage", idProofImage);
      if (user) formData.append("createdBy", JSON.stringify({ username: user.username, role: user.role }));

      const res = await axios.post(`${API}/api/jobsheets`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert("Job Sheet Saved ✅");

      const next = await axios.get(`${API}/api/jobsheets/next-number`);
      handleNew(next.data.next);

    } catch (err) {
      console.error(err);
      alert("Save failed ❌");
    } finally {
      setSaving(false);
    }
  };   // ← handleSave ends here

  /* ================= NEW ================= */

  const handleNew = (nextNo = null) => {
    // ✅ clear all fields
    setCustomerName("");
    
    setContact("");
    setAltContact("");
    setAddress("");
    setEmail("");

    setMake("");
    setCustomMake("");
    setModel("");
    setCustomModel("");
    setImei("");
    setWarranty("");
    setPattern("");
    setIdProofType("");
    setIdProofImage(null);
    setIdProofPreview(null);
    setMobileStatus("");

    setPhysicalCondition([]);
    setAccessories([]);
    setVisualIssues([""]);
    setCustomFaults({}); 

    setEngineer("");
    setDealer("");
    setDrawer("");
    setServiceCharge("");
    setSpareCharge("");
      setSpareItems([]); 
    setEstimate("");
    setPaymentMode("");
    setRemarks("");

    // ✅ NEW: reset validation state too
    setTouched({});
    setFormErrors({});
   

    const today = new Date().toISOString().split("T")[0];
    setRepairDate(today);
    setDeliveryDate(today);

 if (nextNo) {
  setJobSheetNo(nextNo); // 🔥 DIRECT SET
} else {
  axios.get(`${API}/api/jobsheets/next-number`)
    .then(res => setJobSheetNo(res.data.next));
}
 };

  /* ================= EDIT DATA ================= */

  useEffect(() => {
    if (!isEdit || !editData) return;
setCustomFaults({}); 
    // CUSTOMER
    setCustomerName(editData.customer?.name || "");
    setContact(editData.customer?.contact || "");
    setAltContact(editData.customer?.altContact || "");
    setAddress(editData.customer?.address || "");
    setEmail(editData.customer?.email || "");


    // DEVICE
    setMake(editData.device?.make || "");
    setModel(editData.device?.model || "");
    setImei(editData.device?.imei || "");
    setWarranty(editData.device?.warranty || "");
    setPattern(editData.device?.pattern || "");
    setIdProofType(editData.device?.idProofType || "");
    setIdProofPreview(editData.idProofImage || "");
    setMobileStatus(editData.device?.mobileStatus || "");

    // CHECKBOX ARRAYS
    setPhysicalCondition(editData.physicalCondition || []);
    setAccessories(editData.accessories || []);
  const savedIssues = editData.visualIssues?.length ? editData.visualIssues : [""];
setVisualIssues(savedIssues);

const rebuilt = {};
savedIssues.forEach((issue, i) => {
  if (issue && !faultList.some(f => f.name.toLowerCase() === issue.toLowerCase())) {
    rebuilt[i] = issue;
  }
});
setCustomFaults(rebuilt);

    // SERVICE
    setEngineer(editData.service?.engineer || "");
    setDealer(editData.service?.dealer || "");
    setDrawer(editData.service?.drawer || "");
    setServiceCharge(editData.service?.serviceCharge || "");
    setSpareCharge(editData.service?.spareCharge || "");
    setSpareItems(editData.spareItems || []);
    setEstimate(editData.service?.estimate || "");
    setPaymentMode(editData.service?.paymentMode || "");
    setRepairDate(editData.service?.repairDate?.slice(0, 10) || today);
    setDeliveryDate(editData.service?.deliveryDate?.slice(0, 10) || today);
    setRemarks(editData.service?.remarks || "");

  }, [isEdit, editData,faultList]);


const [searching, setSearching] = useState(false);

const handleSearch = async () => {
  setSearching(true);
  try {
    const trimmed = searchText.trim();

    // Is it a pure job sheet number like "10" or "JS-010"?
    const isJobSheetNo =
      /^JS-\d+$/i.test(trimmed) ||
      (/^\d{1,4}$/.test(trimmed) && trimmed.length <= 4);

    const res = await axios.get(`${API}/api/jobsheets/filter`, {
      params: {
        q: trimmed || undefined,
        status: searchStatus || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      },
    });

    let filtered = res.data;

    // Only do the exact JS-xxx match when it looks like a job number
    if (trimmed && isJobSheetNo && /^\d+$/.test(trimmed)) {
      const padded = trimmed.padStart(3, "0");
      const exact = `JS-${padded}`;
      filtered = res.data.filter((js) => js.jobSheetNo === exact);
    }

    setResults(filtered);
    setShowSearchModal(true);
  } catch (err) {
    console.error(err);
    alert("Search failed");
  } finally {
    setSearching(false);
  }
};
  const [localEditData, setLocalEditData] = useState(editData);
  useEffect(() => {
    setLocalEditData(editData);
  }, [editData]);


  // ✅ ADD THIS HERE (BEFORE return)

const makeNames = makeList.map(mk => typeof mk === "string" ? mk : mk.name);

const extraMake =
  make &&
  make !== "__custom" &&
  !makeNames.includes(make)
    ? [{ label: make, value: make }]
    : [];

const makeOptions = [
  ...makeNames.map(name => ({ label: name, value: name })),
  ...extraMake,
  { label: "Other (Add New)", value: "__custom" }
];
const modelNames = modelList.map(m => typeof m === "string" ? m : m.name);

// If current model value isn't in the list (e.g. custom model loaded in edit mode),
// add it so the Select shows it correctly
const extraModel =
  model &&
  model !== "__custom" &&
  !modelNames.includes(model)
    ? [{ label: model, value: model }]
    : [];

const modelOptions = [
  ...modelNames.map(name => ({ label: name, value: name })),
  ...extraModel,
  { label: "Other (Add New)", value: "__custom" }
];
/* ── WORKLOAD BADGE HELPER ── */
const getWorkloadBadge = (engName) => {
  const count = workloadMap[engName] || 0;
  const free  = MAX_JOBS - count;

  if (count >= MAX_JOBS)
    return {
      label: `${engName} (FULL 🔴)`,
      disabled: true
    };

  if (count >= 4)
    return {
      label: `${engName} (${free} slot ⚠️)`,
      disabled: false
    };

  return {
    label: `${engName} (${free} free ✅)`,
    disabled: false
  };
};
  return (
    <div className="container-fluid bg-light min-vh-100 p-3">


      {/* HEADER */}
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex justify-content-between flex-wrap gap-3">
          <b className="fs-5">Job Sheet</b>
          <div><b>Job Sheet No:</b> <span className="text-primary">{jobSheetNo}</span></div>
          <div><b>Date:</b> {now.toLocaleDateString()}</div>
          <div><b>Time:</b> {now.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="card shadow-sm mb-3">
        <div className="card-header fw-bold">Search Job Sheet</div>

        <div className="card-body row g-2 align-items-end">

          {/* SMART SEARCH */}
          <div className="col-md-3">
            <input
              className="form-control form-control-sm"
              placeholder="Job Sheet / IMEI / Contact / Name"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {/* STATUS */}
          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Received">Received</option>
              <option value="Pending">Pending</option>
              <option value="Repaired">Repaired</option>
              <option value="Delivered">Delivered</option>
              <option value="Delivered NR/NA">Delivered NR/NA</option>
            </select>
          </div>

          {/* FROM DATE */}
          <div className="col-md-2">
            <input
              type="date"
              className="form-control form-control-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* TO DATE */}
          <div className="col-md-2">
            <input
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* ACTION */}
          <div className="col-md-3 d-flex gap-2">
     <button
  className="btn btn-primary d-flex align-items-center justify-content-center"
  onClick={handleSearch}
  disabled={searching}
  style={{
    fontSize: "16px",
    padding: "14px 14px",
    height: "35px",
    minWidth: "100px",
    width:"50%"
  }}
>
  {searching ? (
    <>
      <span
        className="spinner-border spinner-border-sm me-2"
        style={{ width: "14px", height: "14px" }}
        role="status"
        aria-hidden="true"
      />
      Searching...
    </>
  ) : (
    "Search"
  )}
</button>
            


            
          </div>

        </div>
      </div>
      {/* MAIN GRID */}
      <div className="row g-3">

        {/* LEFT COLUMN */}
        <div className="col-md-3">
          <div className="card shadow-sm mb-3">
            <div className="card-header fw-bold">Physical Condition</div>
            <div className="card-body small">
              {[
                "Colour Faded", "Antenna Broken", "Deformed", "Battery Damaged",
                "LCD Broken / Bleeding", "Tampered Set", "Front Cover Scratches",
                "Scratches On Body", "Water Logged"
              ].map((x, i) => (
                <div className="form-check mb-1" key={i}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={physicalCondition.includes(x)}
                    onChange={() =>
                      toggleCheckbox(x, physicalCondition, setPhysicalCondition)
                    }
                  />

                  <label className="form-check-label">{x}</label>
                </div>
              ))}
              <input className="form-control form-control-sm mt-2" placeholder="Other Details" />
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header fw-bold">Accessories Received</div>
            <div className="card-body small">
              {["Battery", "Charger", "Back Cover", "Memory Card", "SIM"].map((x, i) => (
                <div className="form-check mb-1" key={i}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={accessories.includes(x)}
                    onChange={() =>
                      toggleCheckbox(x, accessories, setAccessories)
                    }
                  />

                  <label className="form-check-label">{x}</label>
                </div>
              ))}
              <input className="form-control form-control-sm mt-2" placeholder="Battery Number" />
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN */}
        <div className="col-md-6">
          <div className="card shadow-sm mb-3">
            <div className="card-header fw-bold">Customer Details</div>
            <div className="card-body row g-2">

              {/* ── Customer Name (VALIDATION ADDED) ── */}
              {/* <div className="col-md-4">
                <input
                  className={`form-control form-control-sm ${
                    touched.customerName && formErrors.customerName ? "is-invalid" :
                    touched.customerName && !formErrors.customerName ? "is-valid" : ""
                  }`}
                  placeholder="Customer Name *"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (touched.customerName)
                      setFormErrors(prev => ({ ...prev, customerName: validateField("customerName", e.target.value) }));
                  }}
                  onBlur={(e) => handleBlur("customerName", e.target.value)}
                />
                {touched.customerName && formErrors.customerName && (
                  <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>⚠️ {formErrors.customerName}</div>
                )}
                {touched.customerName && !formErrors.customerName && customerName && (
                  <div style={{ fontSize: 11, color: "#198754" }}>✅ Looks good!</div>
                )}
              </div> */}

              {/* ── Customer Name (WITH AUTOCOMPLETE) ── */}
<div className="col-md-4">
 <CustomerAutocomplete
  type="name"
  value={customerName}
  onChange={setCustomerName}
  onSelect={(customer) => {
    setCustomerName(customer.name || "");
    setContact(customer.contact || "");
    setAltContact(customer.altContact || "");
    setAddress(customer.address || "");
    setEmail(customer.email || "");
  }}
  placeholder="Customer Name *"
  className={`form-control form-control-sm ${
    touched.customerName && formErrors.customerName ? "is-invalid" :
    touched.customerName && !formErrors.customerName ? "is-valid" : ""
  }`}
 inputProps={{
  onBlur: () => handleBlur("customerName", customerName)
}}
  />
  {touched.customerName && formErrors.customerName && (
    <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>⚠️ {formErrors.customerName}</div>
  )}
  {touched.customerName && !formErrors.customerName && customerName && (
    <div style={{ fontSize: 11, color: "#198754" }}>✅ Looks good!</div>
  )}
</div>

              {/* ── Contact No (VALIDATION ADDED) ── */}
              {/* <div className="col-md-4">
                <input
                  className={`form-control form-control-sm ${
                    touched.contact && formErrors.contact ? "is-invalid" :
                    touched.contact && !formErrors.contact && contact ? "is-valid" : ""
                  }`}
                  placeholder="Contact No *"
                  value={contact}
                  maxLength={10}
                  onChange={(e) => {
                    const val = onlyNumbers(e.target.value);
                    setContact(val);
                    if (touched.contact)
                      setFormErrors(prev => ({ ...prev, contact: validateField("contact", val) }));
                  }}
                  onBlur={(e) => handleBlur("contact", e.target.value)}
                />
                {touched.contact && formErrors.contact && (
                  <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>⚠️ {formErrors.contact}</div>
                )}
                {touched.contact && !formErrors.contact && contact && (
                  <div style={{ fontSize: 11, color: "#198754" }}>✅ Valid number</div>
                )}
              </div> */}

              {/* ── Contact No (WITH AUTOCOMPLETE) ── */}
<div className="col-md-4">
  <CustomerAutocomplete
    type="contact"
    value={contact}
    onChange={setContact}
    filterNumbers={true}
    onSelect={(customer) => {
      setCustomerName(customer.name || "");
      setContact(customer.contact || "");
      setAltContact(customer.altContact || "");
      setAddress(customer.address || "");
      setEmail(customer.email || "");
    }}
    placeholder="Contact No *"
    maxLength={10}
    className={`form-control form-control-sm ${
      touched.contact && formErrors.contact ? "is-invalid" :
      touched.contact && !formErrors.contact && contact ? "is-valid" : ""
    }`}
    // ✅ KEY FIX: onBlur-ல current state value (contact) pass பண்ணு, not e.target.value
    inputProps={{
  onBlur: () => handleBlur("contact", contact)
}}
  />
  {touched.contact && formErrors.contact && (
    <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>⚠️ {formErrors.contact}</div>
  )}
  {touched.contact && !formErrors.contact && contact && (
    <div style={{ fontSize: 11, color: "#198754" }}>✅ Valid number</div>
  )}
</div>

              <div className="col-md-4">
                <input
                  className="form-control form-control-sm"
                  placeholder="Alt Contact"
                  value={altContact}
                  maxLength={10}
                  onChange={(e) => setAltContact(onlyNumbers(e.target.value))}
                />

              </div>
              <div className="col-8">
                <textarea
                  rows="2"
                  className="form-control form-control-sm"
                  placeholder="Customer Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {/* ── Email (VALIDATION ADDED) ── */}
              <div className="col-md-4">
                <input
                  type="email"
                  className={`form-control form-control-sm ${
                    touched.email && formErrors.email ? "is-invalid" :
                    touched.email && !formErrors.email && email ? "is-valid" : ""
                  }`}
                  placeholder="Email ID"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value.trim().toLowerCase();
                    setEmail(val);
                    if (touched.email)
                      setFormErrors(prev => ({ ...prev, email: validateField("email", val) }));
                  }}
                  onBlur={(e) => handleBlur("email", e.target.value.trim())}
                />
                {touched.email && formErrors.email && (
                  <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>⚠️ {formErrors.email}</div>
                )}
                {touched.email && !formErrors.email && email && (
                  <div style={{ fontSize: 11, color: "#198754" }}>✅ Valid email</div>
                )}
              </div>

               {/* ID PROOF TYPE */}
              <div className="col-md-4">
                <select
                  className="form-select form-select-sm"
                  value={idProofType}
                  onChange={(e) => setIdProofType(e.target.value)}
                >
                  <option value="">Select ID Proof</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Election ID">Election ID</option>
                  <option value="ID Not Required">ID Not Required</option>
                  <option value="Dealer Collected">Dealer Collected</option>
                </select>
              </div>

              {/* IMAGE UPLOAD */}
              <div className="col-md-4">
                <input
                  type="file"
                  accept="image/*"
                  className="form-control form-control-sm"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    setIdProofImage(file);

                    if (file) {
                      setIdProofPreview(URL.createObjectURL(file));
                    }
                  }}
                  disabled={
                    idProofType === "ID Not Required" ||
                    idProofType === "Dealer Collected"
                  }
                />


              </div>

            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header fw-bold">Device Details</div>
            <div className="card-body row g-2">

              {/* Row 1 */}
              {/* MAKE */}
             {/* MAKE */}
<div className="col-md-4">
  <Select
    options={makeOptions}
    value={makeOptions.find(opt => opt.value === make) || null}
    onChange={(selected) => {
      setMake(selected?.value || "");
      setCustomMake("");
      setModel("");
      setCustomModel("");
    }}
    placeholder="Search Make..."
    isClearable
  />

  {make === "__custom" && (
    <input
      className="form-control form-control-sm mt-2"
      placeholder="Enter Make"
      value={customMake}
      onChange={(e) => setCustomMake(e.target.value)}
    />
  )}
</div>

{/* MODEL */}
<div className="col-md-4">
  <Select
    options={modelOptions}
    value={modelOptions.find(opt => opt.value === model) || null}
    onChange={(selected) => {
      setModel(selected?.value || "");
      setCustomModel("");
    }}
    placeholder="Search Model..."
    isClearable
  />

  {model === "__custom" && (
    <input
      className="form-control form-control-sm mt-2"
      placeholder="Enter Model"
      value={customModel}
      onChange={(e) => setCustomModel(e.target.value)}
    />
  )}
</div>


              <div className="col-md-4">
                <input
                  className="form-control form-control-sm"
                  placeholder="IMEI *"
                  value={imei}
                  maxLength={15}
                  onChange={(e) => setImei(onlyNumbers(e.target.value))}
                />

              </div>

              {/* Row 2 */}
              <div className="col-md-4">
                <select
                  className="form-select form-select-sm"
                  value={mobileStatus}
                  onChange={(e) => setMobileStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Received">Received</option>
                  <option value="Pending">Pending</option>
                  <option value="Repaired">Repaired</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Delivered NR/NA">Delivered NR/NA</option>
                </select>
              </div>
              <div className="col-md-4">
                <select
                  className="form-select form-select-sm"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                >
                  <option value="">Warranty</option>
                  <option value="No Warranty">No Warranty</option>
                  <option value="3 months">3 Months</option>
                  <option value="6 months">6 Months</option>
                  <option value="1 year">1 Year</option>
                </select>

              </div>
              <div className="col-md-4">
                <input
                  className="form-control form-control-sm"
                  placeholder="Pattern / PIN"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                />

              </div>

              {/* Row 3 – ID Type & ID Number */}
             
              {/* {idProofPreview && (
  <img
    src={idProofPreview}
    alt="ID Preview"
    style={{ width: "120px", marginTop: "5px" }}
  />
)} */}


            </div>
          </div>


          <div className="card shadow-sm">
            <div className="card-header fw-bold">Service / Repair Details</div>

            <div className="card-body">

              {/* ROW 1 – Engineer / Dealer / Drawer */}
              <div className="row g-2">
                <div className="row g-2">

                  {/* Engineer – DROPDOWN */}
                <div className="col-md-4">
                    <select
                      className="form-select form-select-sm"
                      value={engineer}
                      onChange={e => setEngineer(e.target.value)}
                      style={{ borderColor: engineer && (workloadMap[engineer] || 0) >= MAX_JOBS ? "#ef4444" : "" }}
                    >
                      <option value="">Select Engineer</option>
                      {engineerList.map((eng, i) => {
                        const name  = eng.name || eng;
                        const badge = getWorkloadBadge(name);
                        return (
                          <option key={i} value={name} disabled={badge.disabled}>
                            {badge.label}
                          </option>
                        );
                      })}
                    </select>
 
                    {/* WORKLOAD STATUS UNDER DROPDOWN */}
                    {engineer && (() => {
                      const count = workloadMap[engineer] || 0;
                      const free  = MAX_JOBS - count;
                      if (count >= MAX_JOBS) return (
                        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: "#991b1b", background: "#fee2e2", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                          🔴 Full capacity — choose another engineer
                        </div>
                      );
                      if (count >= 4) return (
                        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                          ⚠️ {count}/{MAX_JOBS} jobs — {free} slot left
                        </div>
                      );
                      return (
                        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 500, color: "#166534", background: "#dcfce7", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                          ✅ {count}/{MAX_JOBS} jobs — {free} slots free
                        </div>
                      );
                    })()}
                  </div>
 

                  {/* Dealer – TEXTBOX */}
                  <div className="col-md-4">
                    <input
                      placeholder="Dealer Name"
                      className="form-control form-control-sm"
                      value={dealer}
                      onChange={(e) => setDealer(e.target.value)}
                    />

                  </div>

                  {/* Drawer – DROPDOWN */}
                  <div className="col-md-4">
                    <select
                      className="form-select form-select-sm"
                      value={drawer}
                      onChange={(e) => setDrawer(e.target.value)}
                    >
                      <option value="">Select Drawer</option>

                      {drawerList.map((d, i) => (
                        <option key={i} value={d.name || d}>
                          {d.name || d}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* ROW 2 – Charges & Payment */}
              <div className="row g-2 mt-1">
                <div className="col-md-3">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Service Charges"
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(onlyNumbers(e.target.value))}
                    min="0"
                  />

                </div>


                <div className="col-md-3">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Spare Charges"
                    value={spareCharge}
                    readOnly
                    onClick={() => setSparePopup(true)}
                    style={{ cursor: "pointer", background: "#f8f9fa" }}
                  />
                </div>


                <div className="col-md-3">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Estimate Amount / Time"
                    value={estimate}
                    onChange={(e) => setEstimate(onlyNumbers(e.target.value))}
                  />

                </div>

                <div className="col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option>Payment Mode</option>
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </div>
              </div>

              {/* ROW 3 – Repair & Delivery Date */}
              <div className="row g-2 mt-2">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Repair Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={repairDate}
                    onChange={(e) => setRepairDate(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Delivery Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* ROW 4 – Remarks */}
              <div className="row g-2 mt-2">
                <div className="col-12">
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />

                </div>
              </div>

            </div>
          </div>
        </div>
<div className="col-md-3">
  <div className="card shadow-sm h-100">
    <div className="card-header fw-bold">Visual Inspection</div>
    <div className="card-body">

      {visualIssues.map((issue, i) => (
        <div className="mb-2" key={i}>

          {/* DROPDOWN */}
          <select
            className="form-select form-select-sm"
           value={customFaults[i] !== undefined ? "__custom" : (issue || "")}
            onChange={(e) => {
              if (e.target.value === "__custom") {
                // dropdown "__custom" select பண்ணும்போது
                // customFaults-ல் empty string வை, visualIssues-ல் "" வை
                setCustomFaults(prev => ({ ...prev, [i]: "" }));
                updateIssue(i, "");
              } else {
               
                setCustomFaults(prev => {
                  const copy = { ...prev };
                  delete copy[i];
                  return copy;
                });
                updateIssue(i, e.target.value);
              }
            }}
          >
            <option value="">Select Issue</option>
            {faultList.map(f => (
              <option key={f._id} value={f.name}>
                {f.name}
              </option>
            ))}
            <option value="__custom">Other (Add New)</option>
          </select>

          {/* CUSTOM INPUT — "__custom" select ஆனால் மட்டும் காட்டு */}
          {customFaults[i] !== undefined && (
            <input
              className="form-control form-control-sm mt-2"
              placeholder="Enter Fault"
              value={customFaults[i]}
              onChange={(e) => {
                const val = e.target.value;
                // customFaults update பண்ணு (input காட்டுவதற்கு)
                setCustomFaults(prev => ({ ...prev, [i]: val }));
                // visualIssues-ல் typed value store பண்ணு (save-க்கு)
                updateIssue(i, val);
              }}
            />
          )}

          {/* REMOVE BUTTON */}
          {visualIssues.length > 1 && (
            <button
              className="btn btn-outline-danger btn-sm mt-1 w-100"
              onClick={() => {
                removeIssue(i);
                setCustomFaults(prev => {
                  const copy = { ...prev };
                  delete copy[i];
                  return copy;
                });
              }}
            >
              ✕ Remove
            </button>
          )}

        </div>
      ))}

      <button
        className="btn btn-outline-primary btn-sm w-100"
        onClick={addIssue}
      >
        + Add Issue
      </button>

    </div>
  </div>
</div>

      </div>

      {/* ACTION BAR */}
      <div className="position-fixed bottom-0 start-0 w-100 bg-white border-top p-2 shadow">
        <div className="d-flex justify-content-center gap-2 flex-wrap">

          {/* SAVE */}
          {!isEdit && (
            <button
              className="btn btn-success btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}

        {/* UPDATE (LOCK CONDITION) */}
{isEdit && (!localEditData?.isInvoiced || localEditData?.rebillPending) && (
  <button className="btn btn-warning btn-sm" onClick={handleUpdate}>
    {localEditData?.rebillPending ? "💾 Save Rebill" : "Update"}
  </button>
)}
         {/* LOCK MESSAGE + REBILL BUTTON */}
{isEdit && localEditData?.isInvoiced && (
  <div className="d-flex align-items-center gap-2">
    <div className="alert alert-danger text-center mb-0 p-1" style={{ fontSize: 12 }}>
      🔒 Invoice Generated — Edit Disabled
    </div>
    <button
      onClick={async () => {
        const rebillCount = (localEditData.rebillHistory?.length || 0) + 1;
        const confirmed = window.confirm(
          `⚠️ Rebill Confirmation\n\nThis will:\n• Unlock the job sheet for editing\n• Clear current charges (Rebill #${rebillCount})\n• Set status back to "Received"\n• Save old invoice to rebill history\n\nProceed?`
        );
        if (!confirmed) return;
        setRebilling(true);
        try {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const res = await axios.put(`${API}/api/jobsheets/${localEditData._id}/rebill`, {
            rebilledBy: user?.username || "admin",
          });
          setLocalEditData(res.data);
          setMobileStatus("Received");
          setServiceCharge("");
          setSpareCharge("");
          setSpareItems([]);
          setRemarks("");
          alert(`✅ Rebill #${rebillCount} opened! Add new charges and generate invoice.`);
        } catch (err) {
          console.error(err);
          alert("Rebill failed ❌");
        } finally {
          setRebilling(false);
        }
      }}
      disabled={rebilling}
      style={{
        background: "#f59e0b", color: "#fff", border: "none",
        fontWeight: 700, fontSize: 12, padding: "5px 12px",
        borderRadius: 8, whiteSpace: "nowrap", cursor: "pointer",
      }}
    >
      {rebilling ? "⏳..." : `🔄 Rebill${(localEditData.rebillHistory?.length || 0) > 0 ? ` #${(localEditData.rebillHistory.length || 0) + 1}` : ""}`}
    </button>
  </div>
)}

          {/* REFRESH */}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>

          {/* ESTIMATE */}
          <button
            className="btn btn-info btn-sm"
            onClick={() => {
              if (!editData?._id) {
                alert("Please save Job Sheet first");
                return;
              }
            
             window.open(`${window.location.origin}/estimate-bill/${editData._id}`, "_blank");
            }}
          >
            Estimate
          </button>

        <button
  className="btn btn-danger btn-sm"
  onClick={async () => {
    if (!localEditData?._id) {
      alert("Please save Job Sheet first");
      return;
    }

    try {
      // Open Invoice Page
      window.open(
        `${window.location.origin}/invoice/${localEditData._id}`,
        "_blank"
      );

      // Mark as Invoiced only
      await axios.put(
        `${API}/api/jobsheets/${localEditData._id}/invoice`
      );

      // Lock Edit
      setLocalEditData(prev => ({
        ...prev,
        isInvoiced: true
      }));

      alert("Invoice Generated Successfully 🔒");

      // Refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Invoice failed ❌");
    }
  }}
>
  Invoice
</button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate("/home")}
          >
            Home
          </button>
<button
  className="btn btn-outline-dark btn-sm"
  onClick={() => navigate("/jobsheet/new")}
>
  New
</button>


        </div>
      </div>
      {showSearchModal && (
        <JobSheetSearchModal
          data={results}
          onClose={() => setShowSearchModal(false)}
        />
      )}

   {sparePopup && (
        <SparePopup
          onClose={() => setSparePopup(false)}
          setSpareCharge={setSpareCharge}
          setSpareItems={setSpareItems}
             existingItems={spareItems} 
        />
      )}

      {/* ✅ REPAIR STEPS TIMELINE */}
      {isEdit && editData?._id && (
        <RepairStepsTimeline jobId={editData._id} />
      )}

   

      <div style={{ height: "80px" }} />
    </div>

  );
};

export default JobSheetPage;