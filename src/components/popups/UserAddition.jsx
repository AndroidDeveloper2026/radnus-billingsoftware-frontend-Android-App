import React, { useState, useEffect } from "react";
import axios from "axios";

const UserAddition = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("user"); // "user" | "salesrep"
  const API = import.meta.env.VITE_API_URL;

  // ── USER FORM ──
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "user"
  });
  const [loading, setLoading] = useState(false);

  // ── SALES REP ──
  const [repList, setRepList]   = useState([]);
  const [newName, setNewName]   = useState("");
  const [repLoading, setRepLoading] = useState(false);

  useEffect(() => {
    window.getSelection()?.removeAllRanges();
    fetchReps();
  }, []);

  const fetchReps = () =>
    axios.get(`${API}/api/salesreps`)
      .then(res => setRepList(res.data))
      .catch(() => {});

  // ── HANDLERS: USER ──
  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      alert("All fields required");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API}/api/users`, form);
      alert("User created ✅");
      setForm({ name: "", username: "", password: "", role: "user" });
      onClose();
    } catch (err) {
      alert("Error ❌");
    } finally {
      setLoading(false);
    }
  };

  // ── HANDLERS: SALES REP ──
  const handleAddRep = async () => {
    if (!newName.trim()) { alert("Name required"); return; }
    setRepLoading(true);
    try {
      await axios.post(`${API}/api/salesreps`, { name: newName.trim() });
      setNewName("");
      fetchReps();
    } catch (err) {
      alert(err.response?.data?.message || "Error ❌");
    } finally {
      setRepLoading(false);
    }
  };

  const handleDeleteRep = async (id) => {
    if (!window.confirm("Delete this service rep?")) return;
    await axios.delete(`${API}/api/salesreps/${id}`);
    fetchReps();
  };

  const roleColors = {
    user:     { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", label: "👤 User (Reception)" },
    engineer: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d", label: "🔧 Engineer" },
    admin:    { bg: "#fef3c7", border: "#f59e0b", text: "#b45309", label: "⚙️ Admin" },
  };

  return (
    <>
      {/* OVERLAY */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />

      {/* MODAL */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div
          className="bg-white text-black w-full max-w-md rounded-2xl shadow-2xl p-6"
          onClick={e => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeTab === "user" ? "👤" : "🧑‍💼"}</span>
              <h2 className="text-xl font-bold text-black">
                {activeTab === "user" ? "Add New User" : "Service Rep Management"}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-lg">✖</button>
          </div>

          {/* TAB TOGGLE */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 gap-1">
            {[
              { key: "user",    label: "👤 Add User"    },
              { key: "salesrep", label: "🧑‍💼 Service Reps" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: activeTab === tab.key ? "#fff" : "transparent",
                  color:      activeTab === tab.key ? "#1d4ed8" : "#6b7280",
                  boxShadow:  activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════ USER TAB ══════════════ */}
          {activeTab === "user" && (
            <div className="space-y-4">

              <div>
                <label className="text-sm text-gray-700 font-medium">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 font-medium">Role</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="user">👤 User (Reception)</option>
                  <option value="engineer">🔧 Engineer</option>
                  <option value="admin">⚙️ Admin</option>
                </select>
                <div
                  className="mt-2 px-3 py-1 rounded-full text-xs font-semibold inline-block"
                  style={{
                    background: roleColors[form.role]?.bg,
                    border: `1px solid ${roleColors[form.role]?.border}`,
                    color: roleColors[form.role]?.text,
                  }}
                >
                  {roleColors[form.role]?.label}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save User"}
              </button>

              <button
                onClick={onClose}
                className="w-full border border-gray-300 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>

            </div>
          )}

          {/* ══════════════ SALES REP TAB ══════════════ */}
          {activeTab === "salesrep" && (
            <div>

              {/* ADD INPUT */}
              <div className="flex gap-2 mb-4">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  placeholder="Service Rep Name (e.g. Kalai)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddRep()}
                />
                <button
                  onClick={handleAddRep}
                  disabled={repLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  {repLoading ? "..." : "Add"}
                </button>
              </div>

              {/* LIST */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {repList.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">
                    No service reps yet. Add one above ☝️
                  </p>
                ) : (
                  repList.map((rep, i) => (
                    <div
                      key={rep._id}
                      className="flex justify-between items-center rounded-xl px-4 py-2"
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: "#dcfce7", color: "#166534" }}
                        >
                          {rep.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                          {rep.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRep(rep._id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>

              {repList.length > 0 && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  {repList.length} service rep{repList.length > 1 ? "s" : ""} registered
                </p>
              )}

            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default UserAddition;