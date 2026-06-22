import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics.js'
import { supabaseConfigError } from '../services/supabaseClient.js'
import { formatDate, formatDoctorName } from '../utils/formatters.js'

const statConfig = [
  { key: 'totalLeads', label: 'Total Leads', accent: '#0f766e', helper: 'All visible CRM records' },
  { key: 'ownerLeads', label: 'Owners / Partners', accent: '#2563eb', helper: 'Likely decision makers' },
  { key: 'highScoreLeads', label: 'High Score Leads', accent: '#0f766e', helper: 'Lead score 25+' },
  { key: 'overdueFollowUps', label: 'Overdue Follow Ups', accent: '#dc2626', helper: 'Past due touches' },
  { key: 'openTasks', label: 'Open Tasks', accent: '#9333ea', helper: 'Not completed' },
  { key: 'clients', label: 'Clients', accent: '#2563eb', helper: 'Closed relationships' },
]

const pipelineConfig = [
  ['New', 'newLeads', '#64748b'],
  ['Attempted', 'attemptedLeads', '#0891b2'],
  ['Contacted', 'contactedLeads', '#2563eb'],
  ['Active Prospect', 'activeProspects', '#ca8a04'],
  ['Proposal Sent', 'proposalSent', '#9333ea'],
  ['Client', 'clients', '#0f766e'],
  ['Nurture', 'nurtureLeads', '#7c3aed'],
  ['Unqualified', 'unqualifiedLeads', '#ea580c'],
  ['Lost', 'lostLeads', '#dc2626'],
]

const qualityConfig = [
  ['Missing email', 'missingEmail'],
  ['Missing phone', 'missingPhone'],
  ['Missing website', 'missingWebsite'],
  ['No follow-up date', 'missingFollowUp'],
  ['No last contact', 'noLastContact'],
]

function DashboardPage() {
  const { metrics, loading, error, configured } = useDashboardMetrics()

  if (!configured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description={supabaseConfigError}
      />
    )
  }

  if (loading) return <LoadingState label="Loading dashboard metrics..." />

  if (error) return <EmptyState title="Dashboard unavailable" description={error} />

  const pipelineTotal = pipelineConfig.reduce((sum, [, key]) => sum + (metrics[key] || 0), 0)

  return (
    <div className="dashboard-page">
      <section className="stats-grid">
        {statConfig.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={(metrics[card.key] || 0).toLocaleString()}
            accent={card.accent}
            helper={card.helper}
          />
        ))}
      </section>

      <section className="dashboard-insight-grid">
        <article className="panel dashboard-insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Pipeline Mix</h2>
              <p>{pipelineTotal.toLocaleString()} leads with status</p>
            </div>
          </div>
          <div className="pipeline-bars">
            {pipelineConfig.map(([label, key, accent]) => (
              <MetricBar
                key={key}
                label={label}
                value={metrics[key] || 0}
                total={Math.max(pipelineTotal, 1)}
                accent={accent}
              />
            ))}
          </div>
        </article>

        <article className="panel dashboard-insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Follow-Up Load</h2>
              <p>Work due now and this week</p>
            </div>
          </div>
          <div className="dashboard-focus-grid">
            <FocusMetric label="Overdue" value={metrics.overdueFollowUps || 0} tone="danger" />
            <FocusMetric label="Due Today" value={metrics.followUpsDueToday || 0} />
            <FocusMetric label="Due This Week" value={metrics.followUpsThisWeek || 0} />
            <FocusMetric label="Overdue Tasks" value={metrics.overdueTasks || 0} tone="danger" />
          </div>
        </article>

        <article className="panel dashboard-insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Data Quality</h2>
              <p>Fields blocking outreach and follow-up</p>
            </div>
          </div>
          <div className="quality-list">
            {qualityConfig.map(([label, key]) => (
              <MetricBar
                key={key}
                label={label}
                value={metrics[key] || 0}
                total={Math.max(metrics.totalLeads || 0, 1)}
                accent="#dc2626"
              />
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-tables compact">
        <DashboardList
          title="Highest Score Leads"
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
          title="Upcoming Follow-Ups"
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
          title="Overdue Follow-Ups"
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

function FocusMetric({ label, value, tone }) {
  return (
    <div className={`focus-metric ${tone === 'danger' ? 'danger' : ''}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  )
}

function MetricBar({ label, value, total, accent }) {
  const percentage = total ? Math.round((value / total) * 100) : 0

  return (
    <div className="metric-bar-row">
      <div className="metric-bar-label">
        <span>{label}</span>
        <b>{value.toLocaleString()}</b>
      </div>
      <div className="metric-bar-track">
        <div className="metric-bar-fill" style={{ width: `${percentage}%`, background: accent }} />
      </div>
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
