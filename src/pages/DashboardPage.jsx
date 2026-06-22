import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics.js'
import { supabaseConfigError } from '../services/supabaseClient.js'
import { formatDate, formatDoctorName } from '../utils/formatters.js'

const statConfig = [
  { key: 'totalLeads', label: 'Total Leads', accent: '#0f766e', helper: 'All CRM records' },
  { key: 'highScoreLeads', label: 'High Score Leads', accent: '#2563eb', helper: 'Lead score 25+' },
  { key: 'overdueFollowUps', label: 'Overdue Follow-Ups', accent: '#dc2626', helper: 'Needs attention' },
  { key: 'openTasks', label: 'Open Tasks', accent: '#9333ea', helper: 'Not completed' },
]

const pipelineConfig = [
  ['New', 'newLeads', '#64748b'],
  ['Contacted', 'contactedLeads', '#2563eb'],
  ['Active Prospect', 'activeProspects', '#ca8a04'],
  ['Proposal Sent', 'proposalSent', '#9333ea'],
  ['Client', 'clients', '#0f766e'],
]

const qualityConfig = [
  ['Missing email', 'missingEmail'],
  ['Missing phone', 'missingPhone'],
  ['No follow-up date', 'missingFollowUp'],
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

      <section className="dashboard-critical-grid">
        <article className="panel dashboard-insight-panel priority-panel">
          <div className="panel-heading">
            <div>
              <h2>Priority Work</h2>
              <p>What needs attention first</p>
            </div>
          </div>
          <div className="dashboard-focus-grid">
            <FocusMetric label="Overdue Follow-Ups" value={metrics.overdueFollowUps || 0} tone="danger" />
            <FocusMetric label="Due Today" value={metrics.followUpsDueToday || 0} />
            <FocusMetric label="Due This Week" value={metrics.followUpsThisWeek || 0} />
            <FocusMetric label="Overdue Tasks" value={metrics.overdueTasks || 0} tone="danger" />
          </div>
        </article>

        <article className="panel dashboard-insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Pipeline Snapshot</h2>
              <p>{pipelineTotal.toLocaleString()} active pipeline records</p>
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

      <section className="dashboard-bottom-grid">
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
