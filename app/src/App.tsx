import { Routes, Route, Navigate } from "react-router-dom";
import { hasCompletedOnboarding } from "./lib/storage";
import { supabaseEnabled } from "./lib/supabase";
import { useAuth } from "./context/AuthContext";
import { ConversationSocketProvider } from "./contexts/ConversationSocketContext";
import { AppShell } from "./components/AppShell";
import { AddContactScreen } from "./screens/Onboarding/AddContactScreen";
import { YoureSetScreen } from "./screens/Onboarding/YoureSetScreen";
import { LoginScreen } from "./screens/Login/LoginScreen";
import Page from "./page";
import { ChatScreen } from "./screens/Chat/ChatScreen";
import { InterventionChat } from "./screens/Intervention/InterventionChat";
import { ManageConversationsScreen } from "./screens/Conversations/ManageConversationsScreen";
import { StatsScreen } from "./screens/Stats/StatsScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { ContactsScreen } from "./screens/Contacts/ContactsScreen";
import { AIChatScreen } from "./screens/AIChat/AIChatScreen";
import { ContactAIChatScreen } from "./screens/AIChat/ContactAIChatScreen";

/** Guards the main app: requires auth (when Supabase enabled) + onboarding. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!supabaseEnabled) {
    if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
    return <>{children}</>;
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
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
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/onboarding" element={<PublicOnboardingOnly><AddContactScreen /></PublicOnboardingOnly>} />
      <Route path="/onboarding/set" element={<PublicOnboardingOnly><YoureSetScreen /></PublicOnboardingOnly>} />
      <Route path="/" element={<AuthGuard><ConversationSocketProvider><AppShell /></ConversationSocketProvider></AuthGuard>}>
        <Route index element={<Page />} />
        <Route path="ai-chat" element={<AIChatScreen />} />
        <Route path="conversations" element={<ManageConversationsScreen />} />
        <Route path="contacts" element={<ContactsScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="chat/:contactId" element={<ChatScreen />} />
      </Route>
      <Route path="/intervention" element={<InterventionChat />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
