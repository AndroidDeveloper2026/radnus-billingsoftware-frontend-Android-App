import React, { useEffect, useState } from "react";
import axios from "axios";

const GLOBAL_ROLES = ["admin", "gm"];

const UserListPopup = ({ onClose }) => {

  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const API = import.meta.env.VITE_API_URL;

  // Only the Super Admin can move users between stores (a Store Manager just sees the list)
  const me = (() => { try { return JSON.parse(sessionStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const isAdmin = me?.role === "admin";

  useEffect(() => {
    fetchUsers();
    if (isAdmin) {
      axios.get(`${API}/api/stores`).then(res => setStores(res.data || [])).catch(() => {});
    }
  }, []);

  const fetchUsers = async () => {
    // ?all=1 → show EVERY user (even ones with no store yet), not only the store selected in the pill
    const res = await axios.get(`${API}/api/users`, { params: { all: 1 } });
    setUsers(res.data);
  };

  const handleDelete = async (id) => {

    if (!window.confirm("Delete this user?")) return;

    try {
      await axios.delete(`${API}/api/users/${id}`);
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }

    fetchUsers();
  };

  // ✅ Assign / move an existing user to a store
  const handleStoreChange = async (u, newStoreId) => {
    if (!newStoreId || newStoreId === (u.storeId?._id || "")) return;
    const target = stores.find(s => s._id === newStoreId);
    const msg = u.storeId
      ? `Move "${u.username}" from ${u.storeId.name} to ${target?.name}?\n\nOld job sheets stay in ${u.storeId.name}. ${u.username} will only see ${target?.name} data from now on.`
      : `Assign "${u.username}" to ${target?.name}?`;
    if (!window.confirm(msg)) return;
    try {
      await axios.put(`${API}/api/users/${u._id}`, { storeId: newStoreId });
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
    fetchUsers();
  };

  return (

    <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content bg-white text-dark">

          {/* HEADER */}
          <div className="modal-header bg-white text-dark">
            <h5 className="modal-title">👤 User List</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>

          {/* BODY */}
          <div className="modal-body bg-white text-dark">

            <table className="table table-bordered bg-white text-dark align-middle">

              <thead className="table-light">
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Store</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {users.map((u) => {
                  const isGlobal = GLOBAL_ROLES.includes(u.role);
                  const missingStore = !isGlobal && !u.storeId;
                  return (
                    <tr key={u._id} style={missingStore ? { background: "#fff1f2" } : undefined}>
                      <td>{u.username}</td>
                      <td>{u.role}</td>
                      <td>
                        {isGlobal ? (
                          <span className="text-muted">All stores</span>
                        ) : isAdmin ? (
                          <select
                            className={`form-select form-select-sm ${missingStore ? "border-danger" : ""}`}
                            value={u.storeId?._id || ""}
                            onChange={(e) => handleStoreChange(u, e.target.value)}
                          >
                            <option value="">⚠️ Not assigned — select store</option>
                            {stores.map(s => (
                              <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          u.storeId?.name || "-"
                        )}
                      </td>

                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(u._id)}
                        >
                          Delete
                        </button>

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

            {isAdmin && users.some(u => !GLOBAL_ROLES.includes(u.role) && !u.storeId) && (
              <div className="small text-danger">
                ⚠️ Red rows have no store yet — they can't log in until you assign one.
              </div>
            )}

          </div>

        </div>
      </div>
    </div>

  );
};

export default UserListPopup;