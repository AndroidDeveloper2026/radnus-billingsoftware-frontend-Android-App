// src/components/popups/StoreManagementPopup.jsx
// Super Admin only: see all stores, add a new store, activate / deactivate a store.
// (Job prefix + code are fixed once created because existing job numbers depend on them.)
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const StoreManagementPopup = ({ onClose }) => {
  const [stores, setStores] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStores = async () => {
    try {
      const res = await axios.get(`${API}/api/stores`);
      setStores(res.data || []);
    } catch (err) {
      alert(err.response?.data?.message || "Could not load stores");
    }
  };

  useEffect(() => { fetchStores(); }, []);

  // tell the store pill (bottom-right) to refresh its list
  const notify = () => window.dispatchEvent(new Event("storeListUpdated"));

  const handleAdd = async () => {
    if (!name.trim()) return alert("Enter store name");
    if (!/^[A-Za-z0-9]{2,6}$/.test(code.trim())) return alert("Store code must be 2-6 letters/digits (e.g. CBE)");
    try {
      setSaving(true);
      await axios.post(`${API}/api/stores`, { name: name.trim(), code: code.trim(), city: city.trim() });
      setName(""); setCode(""); setCity("");
      await fetchStores();
      notify();
    } catch (err) {
      alert(err.response?.data?.message || "Could not add store");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    const msg = s.isActive
      ? `Deactivate "${s.name}"?\n\nIts staff will not be able to log in until you activate it again. No data is deleted.`
      : `Activate "${s.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await axios.put(`${API}/api/stores/${s._id}`, { isActive: !s.isActive });
      await fetchStores();
      notify();
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content bg-white text-dark">

          <div className="modal-header bg-white text-dark">
            <h5 className="modal-title">🏬 Store Management</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body bg-white text-dark">

            {/* ADD STORE */}
            <div className="row g-2 mb-3">
              <div className="col-md-5">
                <input
                  className="form-control"
                  placeholder="Store Name (e.g. Coimbatore)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <input
                  className="form-control"
                  placeholder="Code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="col-md-3">
                <input
                  className="form-control"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <button className="btn btn-success w-100" onClick={handleAdd} disabled={saving}>
                  {saving ? "..." : "Add Store"}
                </button>
              </div>
            </div>
            <div className="text-muted small mb-3">
              Job sheet numbers for a new store look like <b>{(code || "CBE").toUpperCase()}-JS-001</b>. Code can't be changed later.
            </div>

            {/* LIST */}
            <table className="table table-bordered bg-white text-dark">
              <thead className="table-light">
                <tr>
                  <th>Store</th>
                  <th>Code</th>
                  <th>Job No. Prefix</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted">No stores yet</td></tr>
                )}
                {stores.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{s.code}</td>
                    <td>{s.jobPrefix}-001</td>
                    <td>{s.city || "-"}</td>
                    <td>
                      <span className={`badge ${s.isActive ? "bg-success" : "bg-secondary"}`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${s.isActive ? "btn-outline-danger" : "btn-outline-success"}`}
                        onClick={() => toggleActive(s)}
                      >
                        {s.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreManagementPopup;