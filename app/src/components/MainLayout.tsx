import { NavLink, Outlet } from 'react-router-dom'
import './MainLayout.css'

export default function MainLayout() {
  return (
    <div className="main-layout">
      <main className="main-content">
        <Outlet />
      </main>
      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          Chat
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          Stats
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          Settings
        </NavLink>
      </nav>
    </div>
  )
}
