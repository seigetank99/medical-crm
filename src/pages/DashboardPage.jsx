import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics.js'

const statConfig = [
  { key: 'totalDentists', label: 'Total Dentists', accent: '#0f766e' },
  { key: 'totalOrthodontists', label: 'Total Orthodontists', accent: '#0f766e' },
  { key: 'totalOralSurgeons', label: 'Total Oral Surgeons', accent: '#2563eb' },
  { key: 'totalPediatricDentists', label: 'Total Pediatric Dentists', accent: '#9333ea' },
  { key: 'totalPeriodontists', label: 'Total Periodontists', accent: '#ea580c' },
  { key: 'totalEndodontists', label: 'Total Endodontists', accent: '#db2777' },
  { key: 'contactedLeads', label: 'Contacted Leads', accent: '#0f766e' },
  { key: 'activeProspects', label: 'Active Prospects', accent: '#ca8a04' },
  { key: 'clients', label: 'Clients', accent: '#2563eb' },
  { key: 'upcomingFollowUps', label: 'Upcoming Follow Ups', accent: '#dc2626' },
]

function DashboardPage() {
  const { metrics, loading, error, configured } = useDashboardMetrics()

  if (!configured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description="Add your Supabase URL and anon key to start loading dashboard metrics from the dentists table."
      />
    )
  }

  if (loading) return <LoadingState label="Loading dashboard metrics..." />

  if (error) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        description={error}
      />
    )
  }

  return (
    <div className="dashboard-page">
      <section className="stats-grid">
        {statConfig.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={(metrics[card.key] || 0).toLocaleString()}
            accent={card.accent}
          />
        ))}
      </section>

      <section className="dashboard-lower">
        <article className="panel insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Operating guidance</h2>
              <p>Focus the outreach team on owners with recent follow-up windows.</p>
            </div>
          </div>
          <ul className="insight-list">
            <li>Prioritize orthodontists and oral surgeons in NY and NJ first for higher average enterprise value.</li>
            <li>Use saved views to separate owner-led practices from associates and group practices.</li>
            <li>Keep contact notes current so advisory handoffs preserve context across the team.</li>
          </ul>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Coverage snapshot</h2>
              <p>MVP is tuned for 25,000+ dental records with server-side paging and filters.</p>
            </div>
          </div>
          <div className="coverage-grid">
            <div>
              <span>Regions</span>
              <strong>NY, NJ, CT</strong>
            </div>
            <div>
              <span>Database</span>
              <strong>Supabase Postgres</strong>
            </div>
            <div>
              <span>Workflow</span>
              <strong>Prospect to client</strong>
            </div>
            <div>
              <span>Expansion path</span>
              <strong>Other provider verticals</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}

export default DashboardPage
