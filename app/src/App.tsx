import { Routes, Route, Navigate } from "react-router-dom";
import { hasCompletedOnboarding, getProductMode } from "./lib/storage";
import { supabaseEnabled } from "./lib/supabase";
import { useAuth } from "./context/AuthContext";
import { ConversationSocketProvider } from "./contexts/ConversationSocketContext";
import { AppShell } from "./components/AppShell";
import { AddContactScreen } from "./screens/Onboarding/AddContactScreen";
import { YoureSetScreen } from "./screens/Onboarding/YoureSetScreen";
import { LoginScreen } from "./screens/Login/LoginScreen";
import { HomeScreen } from "./screens/Home/HomeScreen";
import Page from "./page";
import { ChatScreen } from "./screens/Chat/ChatScreen";
import { ClosureScreen } from "./screens/Closure/ClosureScreen";
import { AIChatScreen } from "./screens/AIChat/AIChatScreen";
import { StatsScreen } from "./screens/Stats/StatsScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { ContactsScreen } from "./screens/Contacts/ContactsScreen";
import { ContactProfileScreen } from "./screens/Contacts/ContactProfileScreen";
import { InterventionChat } from "./screens/Intervention/InterventionChat";
import { EnterpriseScreen } from "./screens/Enterprise/EnterpriseScreen";
import { UploadScreen } from "./screens/Upload/UploadScreen";

/** Guards the main app: requires auth (when Supabase enabled) + onboarding.
 *  Enterprise product mode users are redirected to /enterprise instead of the main app. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!supabaseEnabled) {
    // Enterprise product mode bypasses personal onboarding entirely.
    if (getProductMode() === "enterprise") return <Navigate to="/enterprise" replace />;
    if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
    return <>{children}</>;
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // Enterprise product mode: redirect to enterprise waitlist instead of personal app.
  if (getProductMode() === "enterprise") return <Navigate to="/enterprise" replace />;
  if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnboardingOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!supabaseEnabled) {
    if (hasCompletedOnboarding()) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (hasCompletedOnboarding()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/home" element={<HomeScreen />} />
      <Route path="/upload" element={<UploadScreen />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/enterprise" element={<EnterpriseScreen />} />
      <Route path="/onboarding" element={<PublicOnboardingOnly><AddContactScreen /></PublicOnboardingOnly>} />
      <Route path="/onboarding/set" element={<PublicOnboardingOnly><YoureSetScreen /></PublicOnboardingOnly>} />

      {/* Main app — requires auth + onboarding */}
      <Route path="/" element={<AuthGuard><ConversationSocketProvider><AppShell /></ConversationSocketProvider></AuthGuard>}>
        <Route index element={<Page />} />
        <Route path="contacts" element={<ContactsScreen />} />
        <Route path="contacts/:contactId" element={<ContactProfileScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="chat/:contactId" element={<ChatScreen />} />
        <Route path="closure/:contactId" element={<ClosureScreen />} />
        <Route path="intervention" element={<InterventionChat />} />
        <Route path="ai-chat" element={<AIChatScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
