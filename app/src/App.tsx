import { Routes, Route, Navigate } from "react-router-dom";
import { hasCompletedOnboarding } from "./lib/storage";
import { ConversationSocketProvider } from "./contexts/ConversationSocketContext";
import { AppShell } from "./components/AppShell";
import { AddContactScreen } from "./screens/Onboarding/AddContactScreen";
import { YoureSetScreen } from "./screens/Onboarding/YoureSetScreen";
import { LoginScreen } from "./screens/Login/LoginScreen";
import { ConversationList } from "./screens/Chat/ConversationList";
import { ChatScreen } from "./screens/Chat/ChatScreen";
import { InterventionChat } from "./screens/Intervention/InterventionChat";
import { ManageConversationsScreen } from "./screens/Conversations/ManageConversationsScreen";
import { StatsScreen } from "./screens/Stats/StatsScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { ContactsScreen } from "./screens/Contacts/ContactsScreen";
import { AIChatScreen } from "./screens/AIChat/AIChatScreen";

/** Single guard: onboarding vs main app. No nested layout wrapper. */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnboardingOnly({ children }: { children: React.ReactNode }) {
  if (hasCompletedOnboarding()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/onboarding" element={<PublicOnboardingOnly><AddContactScreen /></PublicOnboardingOnly>} />
      <Route path="/onboarding/set" element={<PublicOnboardingOnly><YoureSetScreen /></PublicOnboardingOnly>} />
      <Route path="/" element={<OnboardingGuard><ConversationSocketProvider><AppShell /></ConversationSocketProvider></OnboardingGuard>}>
        <Route index element={<ConversationList />} />
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
