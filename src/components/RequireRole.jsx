import React from "react";
import { Navigate } from "react-router-dom";

const RequireRole = ({ children, feedback = false, adminOnly = false, cases = false, blockFeedbackOnly = false, engineerOnly = false }) => {
  const token = sessionStorage.getItem("token");
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const fa = user?.feedbackAccess || "none";

  if (adminOnly) {
    if (!token) return <Navigate to="/" replace />;
    if (user?.role !== "admin") return <Navigate to="/jobsheet" replace />;
  }

  if (engineerOnly) {
    if (!token) return <Navigate to="/" replace />;
    if (user?.role !== "engineer") return <Navigate to="/jobsheet" replace />;
  }

  if (feedback) {
    if (!token || !user?.role) return <Navigate to="/" replace />;
    if (user.role === "admin") return <Navigate to="/feedback-report" replace />;
    if (!(user.role === "user" && fa !== "none")) return <Navigate to="/jobsheet" replace />;
  }

  if (cases) {
    if (!token || !user?.role) return <Navigate to="/" replace />;
    const ok = user.role === "admin" || (user.role === "user" && (!!user.linkedRep || fa !== "none"));
    if (!ok) return <Navigate to="/jobsheet" replace />;
  }

  if (blockFeedbackOnly && user?.role === "user" && fa === "only") {
    return <Navigate to="/feedback" replace />;
  }

  return children;
};

export default RequireRole;