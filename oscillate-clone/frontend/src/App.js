import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { upsertProfile } from "@/lib/db";
import AuthModal from "@/components/AuthModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import POSPage from "@/pages/POSPage";
import EventDetailPage from "@/pages/EventDetailPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import AdminPage from "@/pages/AdminPage";
import VenueDetailPage from "@/pages/VenueDetailPage";
import SearchPage from "@/pages/SearchPage";
import ProfilePage from "@/pages/ProfilePage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import TermsPage from "@/pages/legal/TermsPage";
import CookiePage from "@/pages/legal/CookiePage";
import RefundPage from "@/pages/legal/RefundPage";

function App() {
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    // Restore session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setAuthOpen(false);
        // Seed profiles row on first Google sign-in
        if (event === "SIGNED_IN") {
          upsertProfile(u.id, {
            display_name: u.user_metadata?.full_name || null,
            avatar_url:   u.user_metadata?.avatar_url || null,
          }).catch(() => {});
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const openAuth = () => setAuthOpen(true);

  return (
    <BrowserRouter>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <Routes>
        <Route path="/" element={<LandingPage user={user} openAuth={openAuth} />} />
        <Route path="/event/:eventId" element={<EventDetailPage user={user} openAuth={openAuth} />} />
        <Route path="/venue/:venueId" element={<VenueDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="/profile" element={<ProfilePage user={user} openAuth={openAuth} />} />

        {/* Role-protected routes */}
        <Route path="/admin" element={
          <ProtectedRoute user={user} role="admin" openAuth={openAuth}>
            <AdminPage user={user} />
          </ProtectedRoute>
        } />
        <Route path="/pos" element={
          <ProtectedRoute user={user} role="pos" openAuth={openAuth}>
            <POSPage />
          </ProtectedRoute>
        } />

        {/* Legal */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiePage />} />
        <Route path="/refund" element={<RefundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
