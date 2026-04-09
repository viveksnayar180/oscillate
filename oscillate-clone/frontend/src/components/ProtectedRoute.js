import { Navigate } from "react-router-dom";
import { isAdmin, isPOS } from "../lib/roles";

/**
 * Route guard for admin and POS sections.
 * - Not logged in → redirect to /
 * - Logged in but wrong role → redirect to /
 */
export default function ProtectedRoute({ user, role, openAuth, children }) {
  if (!user) {
    // Trigger auth modal and send to home
    if (openAuth) openAuth();
    return <Navigate to="/" replace />;
  }

  if (role === "admin" && !isAdmin(user)) return <Navigate to="/" replace />;
  if (role === "pos" && !isPOS(user)) return <Navigate to="/" replace />;

  return children;
}
