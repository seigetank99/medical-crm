import { BarChart3, Bookmark, Building2, Filter, LayoutList, Upload } from 'lucide-react'
import { navItems, savedViews } from '../../utils/constants.js'

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
          <span>New York</span>
          <span>New Jersey</span>
          <span>Connecticut</span>
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-title">
          <Building2 size={16} />
          <span>Focus specialties</span>
        </div>
        <ul className="sidebar-list">
          <li>General Dentists</li>
          <li>Orthodontists</li>
          <li>Oral Surgeons</li>
          <li>Pediatric Dentists</li>
          <li>Periodontists</li>
          <li>Endodontists</li>
        </ul>
      </section>

      <section className="sidebar-section">
        <div className="section-title">
          <Bookmark size={16} />
          <span>Saved views</span>
        </div>
        <div className="saved-views">
          {savedViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`saved-view ${activeSavedView?.id === view.id ? 'active' : ''}`}
              onClick={() => onNavigate(`/leads?view=${view.id}`)}
            >
              <span>{view.label}</span>
              <small>{view.description}</small>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

export default Sidebar
