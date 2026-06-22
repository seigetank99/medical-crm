import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import AppShell from './components/layout/AppShell.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import LeadsPage from './pages/LeadsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { savedViews } from './utils/constants.js'
import './App.css'

const THEME_KEY = 'omnihealth-theme'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const activeSavedView = useMemo(() => {
    const query = new URLSearchParams(location.search)
    const saved = query.get('view')
    return savedViews.find((view) => view.id === saved) || null
  }, [location.search])

  return (
    <AppShell
      currentPath={location.pathname}
      activeSavedView={activeSavedView}
      onNavigate={navigate}
      themeToggle={
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
      </Routes>
    </AppShell>
  )
}

export default App
