// src/components/RequireAuth.jsx
// Route guard. <RequireAuth> = must be logged in. <RequireAuth roles={["admin"]}> = must also have that role.
// (This is for UX only — the REAL protection is the backend: every API checks the token, role and store.)
import React from "react";
import { Navigate } from "react-router-dom";

const readUser = () => {
  try { return JSON.parse(sessionStorage.getItem("user") || "null"); } catch { return null; }
};

const homeFor = (user) =>
  user?.role === "engineer"
    ? `/engineer/${(user.name || user.username || "").toLowerCase()}`
    : "/jobsheet";

const RequireAuth = ({ roles, children }) => {
  const token = sessionStorage.getItem("token");
  const user = readUser();

  if (!token || !user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
};

export default RequireAuth;