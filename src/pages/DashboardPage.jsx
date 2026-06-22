import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics.js'
import { formatDate, formatDoctorName } from '../utils/formatters.js'

const statConfig = [
  { key: 'totalLeads', label: 'Total Leads', accent: '#0f766e' },
  { key: 'generalDentists', label: 'General Dentists', accent: '#2563eb' },
  { key: 'orthodontists', label: 'Orthodontists', accent: '#0f766e' },
  { key: 'oralSurgeons', label: 'Oral Surgeons', accent: '#2563eb' },
  { key: 'pediatricDentists', label: 'Pediatric Dentists', accent: '#9333ea' },
  { key: 'periodontists', label: 'Periodontists', accent: '#ea580c' },
  { key: 'endodontists', label: 'Endodontists', accent: '#db2777' },
  { key: 'newLeads', label: 'New Leads', accent: '#64748b' },
  { key: 'activeProspects', label: 'Active Prospects', accent: '#ca8a04' },
  { key: 'proposalSent', label: 'Proposal Sent', accent: '#9333ea' },
  { key: 'clients', label: 'Clients', accent: '#2563eb' },
  { key: 'overdueFollowUps', label: 'Overdue Follow Ups', accent: '#dc2626' },
  { key: 'followUpsDueToday', label: 'Due Today', accent: '#ea580c' },
  { key: 'followUpsThisWeek', label: 'Due This Week', accent: '#0f766e' },
  { key: 'highScoreLeads', label: 'High Score Leads', accent: '#0f766e' },
  { key: 'upcomingTasks', label: 'Upcoming Tasks', accent: '#2563eb' },
  { key: 'overdueTasks', label: 'Overdue Tasks', accent: '#dc2626' },
]

function DashboardPage() {
  const { metrics, loading, error, configured } = useDashboardMetrics()

  if (!configured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description="Add your Supabase URL and anon key to start loading dashboard metrics."
      />
    )
  }

  if (loading) return <LoadingState label="Loading dashboard metrics..." />

  if (error) return <EmptyState title="Dashboard unavailable" description={error} />

  return (
    <div className="dashboard-page">
      <section className="stats-grid">
        {statConfig.map((card) => (
          <StatCard key={card.key} label={card.label} value={(metrics[card.key] || 0).toLocaleString()} accent={card.accent} />
        ))}
      </section>

      <section className="dashboard-tables">
        <DashboardList
          title="Top 10 Highest Score Leads"
          rows={metrics.topLeads || []}
          renderRow={(row) => (
            <>
              <strong>{formatDoctorName(row)}</strong>
              <span>{row.practice_name || '—'}</span>
              <b>{row.lead_score ?? 0}</b>
            </>
          )}
        />
        <DashboardList
          title="Upcoming Follow Ups"
          rows={metrics.upcomingFollowUps || []}
          renderRow={(row) => (
            <>
              <strong>{formatDoctorName(row)}</strong>
              <span>{row.contact_status || '—'}</span>
              <b>{formatDate(row.next_follow_up_date)}</b>
            </>
          )}
        />
        <DashboardList
          title="Overdue Follow Ups"
          rows={metrics.overdueFollowUpRows || []}
          renderRow={(row) => (
            <>
              <strong>{formatDoctorName(row)}</strong>
              <span>{row.follow_up_priority || '—'}</span>
              <b>{formatDate(row.next_follow_up_date)}</b>
            </>
          )}
        />
        <DashboardList
          title="Recent Contact Notes"
          rows={metrics.recentContactNotes || []}
          renderRow={(row) => (
            <>
              <strong>{row.contact_method || 'Note'}</strong>
              <span>{row.note}</span>
              <b>{formatDate(row.created_at)}</b>
            </>
          )}
        />
        <DashboardList
          title="Recent Import Batches"
          rows={metrics.recentImportBatches || []}
          renderRow={(row) => (
            <>
              <strong>{row.file_name || row.batch_id}</strong>
              <span>{row.import_source || '—'}</span>
              <b>{row.successful_rows || 0}/{row.total_rows || 0}</b>
            </>
          )}
        />
        <DashboardList
          title="Upcoming Tasks"
          rows={metrics.upcomingTaskRows || []}
          renderRow={(row) => (
            <>
              <strong>{row.title}</strong>
              <span>{row.priority} · {row.status}</span>
              <b>{formatDate(row.due_date)}</b>
            </>
          )}
        />
      </section>
    </div>
  )
}

function DashboardList({ title, rows, renderRow }) {
  return (
    <article className="panel dashboard-list">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{rows.length} records</p>
        </div>
      </div>
      {rows.length ? (
        <div className="dashboard-list-rows">
          {rows.map((row) => (
            <div key={`${title}-${row.id}`} className="dashboard-list-row">
              {renderRow(row)}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No records" description="Nothing to show for this section yet." />
      )}
    </article>
  )
}

export default DashboardPage
