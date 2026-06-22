import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import Sidebar from './Sidebar.jsx'

function AppShell({ children, currentPath, activeSavedView, onNavigate, themeToggle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { session, signOut } = useAuth()
  const isLogin = location.pathname === '/login'
  const pageTitle =
    currentPath === '/dashboard' ? 'Pipeline dashboard' : currentPath === '/import' ? 'CSV import' : 'Dental leads'

  if (isLogin) return children

  return (
    <div className="app-shell">
      <div className={`shell-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Sidebar
          currentPath={currentPath}
          activeSavedView={activeSavedView}
          onNavigate={(path) => {
            onNavigate(path)
            setSidebarOpen(false)
          }}
        />
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="shell-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-only"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="eyebrow">OmniHealth</p>
              <h1>{pageTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {session?.user?.email ? <span className="user-email">{session.user.email}</span> : null}
            {themeToggle}
            {session ? (
              <button type="button" className="icon-button" onClick={signOut} aria-label="Log out">
                <LogOut size={18} />
              </button>
            ) : null}
          </div>
        </header>
        <div className="shell-content">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
