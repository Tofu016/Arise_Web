import { Routes, Route, Navigate } from "react-router-dom";
import MainPage from "./pages/MainPage";
import AdminLayout from "./layouts/AdminLayout";
import NodeEditorPage from "./pages/admin/NodeEditorPage";
import NodeFlowchartPage from "./pages/admin/NodeFlowchartPage";
import NavigationEditorPage from "./pages/admin/NavigationEditorPage";
import RoomEditorPage from "./pages/admin/RoomEditorPage";
import MarkerManagementPage from "./pages/admin/MarkerManagementPage";
import UserPanelPage from "./pages/admin/UserPanelPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import PhotoCoverageAdminPage from "./pages/admin/PhotoCoverageAdminPage";
import EmergencyCoveragePage from "./pages/admin/EmergencyCoveragePage";
import SignagePage from "./pages/admin/SignagePage";
import DirectoryPage from "./pages/admin/DirectoryPage";
import KiosksPage from "./pages/admin/KiosksPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";
// Per BRAND.md's documented import order — tokens.css defines every
// var(--accent)/var(--surface)/var(--font-sans-display)/etc. that
// index.css (and every component's className) actually references.
// These two were missing entirely from this file — meaning every one of
// those CSS custom properties was undefined app-wide, silently falling
// back to each property's own initial value (transparent backgrounds,
// default black text, no custom font), regardless of how correct any
// individual component's CSS was. This is very likely the true root
// cause behind a lot of "nothing visually changed" confusion across
// many separate fixes, not something specific to any one of them.
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./index.css";
// After index.css on purpose: motion.css layers entrance animations and
// easing over existing selectors, and must win same-specificity ties.
import "./styles/motion.css";

export default function App() {
  return (
    // ToastProvider wraps everything, above AuthProvider — a toast can be
    // fired from code that runs outside any auth-gated route (e.g. a
    // mutation resolving after sign-out), and useCollection's mutate()
    // needs useToast() to always resolve regardless of route.
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Genuinely public — no RequireAuth wrapper at all, same as
              /login above. Indoor navigation doesn't require an account;
              see IndoorUploads_API's serve() for the matching backend
              change — removing the gate here alone, without that one,
              would have left the page reachable but every photo failing
              to load for a logged-out visitor. */}
          <Route path="/" element={<MainPage />} />
          {/* Nested under one shared layout — useNodes() is called once in
              AdminLayout and passed down to whichever section is active via
              Outlet context, rather than each section independently
              re-fetching the same node data and losing track of
              the current selection on every navigation. */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="node-editor" replace />} />
            <Route path="node-editor" element={<NodeEditorPage />} />
            <Route path="node-flowchart" element={<NodeFlowchartPage />} />
            <Route path="navigation-editor" element={<NavigationEditorPage />} />
            <Route path="room-and-facility-editor" element={<RoomEditorPage />} />
            <Route path="marker-management" element={<MarkerManagementPage />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="emergency-coverage" element={<EmergencyCoveragePage />} />
            <Route path="user-panel" element={<UserPanelPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="photo-coverage" element={<PhotoCoverageAdminPage />} />
            {/* Named for the page, like every admin route. Only the API,
                file paths and class names avoid "ad" (see utils/signage.js):
                this is an in-app route, not a request ad blockers filter. */}
            <Route path="advertisements" element={<SignagePage />} />
            <Route path="kiosks" element={<KiosksPage />} />
            {/* Any other /admin/* path (a stale bookmark to a renamed page,
                e.g. the old /admin/users) would otherwise render the admin
                shell around an empty content area. */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          {/* Any other path — most likely a stale bookmark to the removed
              /tour page or one of its two admin editors — lands on the
              indoor navigator instead of a blank screen. Same reasoning as
              the /admin/* catch-all above. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      <ToastContainer />
    </ToastProvider>
  );
}
