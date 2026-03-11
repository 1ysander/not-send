import { useNavigate, useLocation } from "react-router-dom";
import { IconChats, IconAIChat, IconInbox, IconContacts, IconStats, IconSettings } from "./TabNavIcons";

const tabs = [
  { path: "/", end: true, label: "Chats", Icon: IconChats },
  { path: "/ai-chat", end: false, label: "AI", Icon: IconAIChat },
  { path: "/conversations", end: false, label: "Inbox", Icon: IconInbox },
  { path: "/contacts", end: false, label: "Contacts", Icon: IconContacts },
  { path: "/stats", end: false, label: "Stats", Icon: IconStats },
  { path: "/settings", end: false, label: "Settings", Icon: IconSettings },
] as const;

function isActive(path: string, end: boolean, currentPath: string): boolean {
  if (end) return currentPath === "/" || currentPath === "";
  return currentPath === path || currentPath.startsWith(path + "/");
}

export function TabNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav className="bot-nav" role="tablist" aria-label="Main navigation">
      {tabs.map(({ path, end, label, Icon }) => {
        const active = isActive(path, end, pathname);
        return (
          <button
            key={path}
            type="button"
            role="tab"
            aria-current={active ? "page" : undefined}
            className={`bot-nav__btn${active ? " bot-nav__btn--active" : ""}`}
            onClick={() => navigate(path)}
          >
            <Icon className="bot-nav__icon" aria-hidden />
            <span className="bot-nav__label">{label}</span>
            {active && <span className="bot-nav__dot" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}
