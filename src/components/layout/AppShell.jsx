import { Menu } from 'lucide-react'
import { useState } from 'react'
import Sidebar from './Sidebar.jsx'

function AppShell({ children, currentPath, activeSavedView, onNavigate, themeToggle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pageTitle =
    currentPath === '/dashboard' ? 'Pipeline dashboard' : currentPath === '/import' ? 'CSV import' : 'Dental leads'

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
          <div className="topbar-actions">{themeToggle}</div>
        </header>
        <div className="shell-content">{children}</div>
      </div>
    </div>
  )
}

export default AppShell
