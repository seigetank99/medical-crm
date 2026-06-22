import { BarChart3, Database, Filter, LayoutList, Upload } from 'lucide-react'
import { navItems } from '../../utils/constants.js'

const territoryFilters = [
  { label: 'New York', viewId: 'ny-dentists' },
  { label: 'New Jersey', viewId: 'nj-dentists' },
  { label: 'Connecticut', viewId: 'ct-dentists' },
]

function Sidebar({ currentPath, activeSavedView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">OH</div>
        <div>
          <strong>OmniHealth</strong>
          <span>Healthcare advisory pipeline</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const iconMap = {
            dashboard: BarChart3,
            leads: LayoutList,
            database: Database,
            import: Upload,
          }
          const Icon = iconMap[item.icon] || LayoutList
          const active = currentPath === item.path
          return (
            <button
              key={item.path}
              type="button"
              className={`nav-button ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <section className="sidebar-section">
        <div className="section-title">
          <Filter size={16} />
          <span>Territory</span>
        </div>
        <div className="sidebar-pills">
          {territoryFilters.map((territory) => (
            <button
              key={territory.viewId}
              type="button"
              className={activeSavedView?.id === territory.viewId ? 'active' : ''}
              onClick={() => onNavigate(`/leads?view=${territory.viewId}`)}
            >
              {territory.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

export default Sidebar
