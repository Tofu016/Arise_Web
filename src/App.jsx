import { Routes, Route, Navigate } from "react-router-dom";
import MainPage from "./pages/MainPage";
import AdminLayout from "./layouts/AdminLayout";
import NodeEditorPage from "./pages/admin/NodeEditorPage";
import NodeFlowchartPage from "./pages/admin/NodeFlowchartPage";
import NavigationEditorPage from "./pages/admin/NavigationEditorPage";
import RoomEditorPage from "./pages/admin/RoomEditorPage";
import UserPanelPage from "./pages/admin/UserPanelPage";
import TourStopsPage from "./pages/admin/TourStopsPage";
import TourNavigationEditorPage from "./pages/admin/TourNavigationEditorPage";
import PublicTourPage from "./pages/PublicTourPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForgotEmail from "./pages/ForgotEmail";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
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

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forgot-email" element={<ForgotEmail />} />
        {/* Genuinely public — no RequireAuth wrapper at all, same as
            /login etc. above. This is the whole point of the Virtual
            Tour: showcasing the campus to visitors who aren't registered
            users, not just approved account holders. */}
        <Route path="/tour" element={<PublicTourPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainPage />
            </RequireAuth>
          }
        />
        {/* Nested under one shared layout — useNodes() is called once in
            AdminLayout and passed down to whichever section is active via
            Outlet context, rather than each section independently
            re-subscribing to the same Firestore data and losing track of
            the current selection on every navigation. */}
        <Route
          path="/admin"
          element={
            <RequireAuth requireRole="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="node-editor" replace />} />
          <Route path="node-editor" element={<NodeEditorPage />} />
          <Route path="node-flowchart" element={<NodeFlowchartPage />} />
          <Route path="virtual-map-navigation-editor" element={<NavigationEditorPage />} />
          <Route path="room-editor" element={<RoomEditorPage />} />
          <Route path="users" element={<UserPanelPage />} />
          <Route path="tour-stops" element={<TourStopsPage />} />
          <Route path="campus-tour-navigation-editor" element={<TourNavigationEditorPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
