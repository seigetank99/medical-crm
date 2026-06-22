import { CheckCircle2, FileUp, Play, RefreshCw, RotateCcw, Sparkles, Upload, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import {
  createDentistRecordsBatch,
  createImportBatch,
  enrichSelectedDentist,
  findDuplicateDentists,
  getPipelineStatus,
  getRecentImportBatches,
  processEnrichmentQueue,
  runNpiImport,
  updateImportBatch,
} from '../services/dentistsService.js'
import { isSupabaseConfigured, supabaseConfigError } from '../services/supabaseClient.js'
import {
  annotateDuplicates,
  chunkRows,
  createImportBatchId,
  getDuplicateLookupValues,
  mapCsvRows,
  parseCsv,
} from '../utils/importCsv.js'

const importBatchSize = 500

function ImportPage() {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [summary, setSummary] = useState(null)
  const [importSource, setImportSource] = useState('CSV Upload')
  const [recentBatches, setRecentBatches] = useState([])
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)
  const [pipelineMessage, setPipelineMessage] = useState('')
  const [pipelineMessageError, setPipelineMessageError] = useState(false)
  const [pipelineRunning, setPipelineRunning] = useState('')
  const [selectedDentistId, setSelectedDentistId] = useState('')
  const [includeGooglePlaces, setIncludeGooglePlaces] = useState(false)

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows])
  const invalidRows = rows.length - validRows.length

  async function loadImportData() {
    if (!isSupabaseConfigured) return
    setPipelineLoading(true)
    const [batchesResult, pipelineResult] = await Promise.all([getRecentImportBatches(), getPipelineStatus()])
    if (!batchesResult.error) setRecentBatches(batchesResult.data)
    if (!pipelineResult.error) {
      setPipelineStatus(pipelineResult.data)
    } else {
      setPipelineMessage(pipelineResult.error)
      setPipelineMessageError(true)
    }
    setPipelineLoading(false)
  }

  useEffect(() => {
    let mounted = true

    async function loadInitialImportData() {
      if (!isSupabaseConfigured) return
      setPipelineLoading(true)
      const [batchesResult, pipelineResult] = await Promise.all([getRecentImportBatches(), getPipelineStatus()])
      if (!mounted) return

      if (!batchesResult.error) setRecentBatches(batchesResult.data)
      if (!pipelineResult.error) {
        setPipelineStatus(pipelineResult.data)
      } else {
        setPipelineMessage(pipelineResult.error)
        setPipelineMessageError(true)
      }
      setPipelineLoading(false)
    }

    void loadInitialImportData()

    return () => {
      mounted = false
    }
  }, [])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setRows([])
    setSummary(null)
    setMessage('')
    setLoading(true)

    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      const mappedRows = mapCsvRows(parsed.rows)
      const lookupValues = getDuplicateLookupValues(mappedRows)
      const duplicateResult = await findDuplicateDentists(lookupValues)

      if (duplicateResult.error) {
        setMessage(duplicateResult.error)
      }

      setRows(annotateDuplicates(mappedRows, duplicateResult.data))
      await loadImportData()
    } catch (error) {
      setMessage(error.message || 'Unable to parse CSV.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!validRows.length) return

    setImporting(true)
    setMessage('')
    const batchId = createImportBatchId()
    let successCount = 0
    let failureCount = 0
    const duplicateCount = rows.filter((row) => row.errors.some((error) => error.toLowerCase().includes('duplicate'))).length

    await createImportBatch({
      batch_id: batchId,
      file_name: fileName,
      import_source: importSource,
      total_rows: rows.length,
      successful_rows: 0,
      failed_rows: 0,
      duplicate_rows: duplicateCount,
    })

    for (const chunk of chunkRows(validRows, importBatchSize)) {
      const result = await createDentistRecordsBatch(
        chunk.map((row) => ({
          ...row.data,
          import_batch_id: batchId,
          import_source: importSource,
        })),
      )
      if (result.error) {
        failureCount += chunk.length
        setMessage(result.error)
      } else {
        successCount += result.data.length
      }
    }

    await updateImportBatch(batchId, {
      successful_rows: successCount,
      failed_rows: failureCount + invalidRows,
      duplicate_rows: duplicateCount,
    })
    await loadImportData()
    setSummary({ batchId, successCount, failureCount, skippedCount: invalidRows, duplicateCount, totalRows: rows.length })
    setImporting(false)
  }

  const handlePipelineAction = async (label, action) => {
    setPipelineRunning(label)
    setPipelineMessage('')
    setPipelineMessageError(false)
    const result = await action()
    if (result.error) {
      setPipelineMessage(result.error)
      setPipelineMessageError(true)
    } else {
      setPipelineMessage(`${label} complete: ${summarizePipelineResult(result.data)}`)
      setPipelineMessageError(false)
    }
    await loadImportData()
    setPipelineRunning('')
  }

  if (!isSupabaseConfigured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description={supabaseConfigError}
      />
    )
  }

  return (
    <div className="import-page">
      <section className="panel import-panel">
        <div className="panel-heading">
          <div>
            <h2>Automatic Pipeline Status</h2>
            <p>NPI import, enrichment queue, and high-value lead automation.</p>
          </div>
          <button type="button" className="ghost-button" onClick={loadImportData} disabled={pipelineLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {pipelineLoading ? (
          <LoadingState label="Loading pipeline status..." />
        ) : (
          <div className="pipeline-status-grid">
            <PipelineMetric label="Last import" value={formatDateTime(pipelineStatus?.lastImport?.created_at)} />
            <PipelineMetric label="Imported today" value={pipelineStatus?.importedToday || 0} />
            <PipelineMetric label="Pending jobs" value={pipelineStatus?.pendingJobs || 0} />
            <PipelineMetric label="Failed jobs" value={pipelineStatus?.failedJobs || 0} />
            <PipelineMetric label="Enriched today" value={pipelineStatus?.enrichedToday || 0} />
            <PipelineMetric label="High-score this week" value={pipelineStatus?.highScoreThisWeek || 0} />
          </div>
        )}

        {pipelineMessage ? <div className={`notice ${pipelineMessageError ? 'error' : ''}`}>{pipelineMessage}</div> : null}
      </section>

      <section className="pipeline-actions-grid">
        <article className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Run NPI Import Now</h2>
              <p>Imports dental providers from the official NPI Registry for NY, NJ, and CT.</p>
            </div>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => handlePipelineAction('NPI import', runNpiImport)}
            disabled={Boolean(pipelineRunning)}
          >
            <Play size={16} />
            {pipelineRunning === 'NPI import' ? 'Running...' : 'Run NPI Import Now'}
          </button>
        </article>

        <article className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Process Queue Now</h2>
              <p>Runs pending enrichment and lead scoring jobs due now.</p>
            </div>
          </div>
          <div className="toolbar-group">
            <button
              type="button"
              className="primary-button"
              onClick={() => handlePipelineAction('Queue processing', () => processEnrichmentQueue(false))}
              disabled={Boolean(pipelineRunning)}
            >
              <RefreshCw size={16} />
              {pipelineRunning === 'Queue processing' ? 'Processing...' : 'Process Enrichment Queue Now'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handlePipelineAction('Retry failed jobs', () => processEnrichmentQueue(true))}
              disabled={Boolean(pipelineRunning)}
            >
              <RotateCcw size={16} />
              Retry Failed Jobs
            </button>
          </div>
        </article>

        <article className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Enrich Selected Lead</h2>
              <p>Run enrichment for one dentist ID.</p>
            </div>
          </div>
          <label className="field-group">
            <span>Dentist ID</span>
            <input value={selectedDentistId} onChange={(event) => setSelectedDentistId(event.target.value)} placeholder="Example: 123" />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={includeGooglePlaces} onChange={(event) => setIncludeGooglePlaces(event.target.checked)} />
            <span>Include Google Places enrichment</span>
          </label>
          {includeGooglePlaces ? (
            <div className="notice">Google Places API calls may cost money. The API key stays server-side in Supabase secrets.</div>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() => handlePipelineAction('Selected dentist enrichment', () => enrichSelectedDentist(Number(selectedDentistId), includeGooglePlaces))}
            disabled={Boolean(pipelineRunning) || !selectedDentistId}
          >
            <Sparkles size={16} />
            {pipelineRunning === 'Selected dentist enrichment' ? 'Enriching...' : 'Enrich Selected Dentist'}
          </button>
        </article>
      </section>

      <section className="panel import-panel">
        <div className="panel-heading">
          <div>
            <h2>Bulk CSV import</h2>
            <p>Upload, validate, preview, and insert dentists into Supabase in batches.</p>
          </div>
        </div>

        <label className="upload-zone">
          <FileUp size={24} />
          <span>{fileName || 'Choose CSV file'}</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>

        <label className="field-group">
          <span>Import source</span>
          <input value={importSource} onChange={(event) => setImportSource(event.target.value)} />
        </label>

        {message ? <div className="notice error">{message}</div> : null}

        {summary ? (
          <div className="import-summary">
            <SummaryItem icon={<CheckCircle2 size={18} />} label="Imported" value={summary.successCount} />
            <SummaryItem icon={<XCircle size={18} />} label="Failed" value={summary.failureCount} />
            <SummaryItem icon={<XCircle size={18} />} label="Skipped" value={summary.skippedCount} />
            <SummaryItem icon={<XCircle size={18} />} label="Duplicates" value={summary.duplicateCount} />
          </div>
        ) : null}
      </section>

      {loading ? (
        <LoadingState label="Parsing and checking duplicates..." />
      ) : rows.length ? (
        <section className="panel import-preview">
          <div className="panel-heading">
            <div>
              <h2>Preview</h2>
              <p>
                {validRows.length.toLocaleString()} valid, {invalidRows.toLocaleString()} need review
              </p>
            </div>
            <button type="button" className="primary-button" onClick={handleImport} disabled={!validRows.length || importing}>
              <Upload size={16} />
              {importing ? 'Importing...' : 'Confirm import'}
            </button>
          </div>

          <div className="table-wrap">
            <table className="crm-table import-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Practice</th>
                  <th>Email</th>
                  <th>NPI</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length ? 'invalid-row' : ''}>
                    <td>{row.rowNumber}</td>
                    <td>{[row.data.first_name, row.data.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td>{row.data.specialty || '—'}</td>
                    <td>{row.data.practice_name || '—'}</td>
                    <td>{row.data.email || '—'}</td>
                    <td>{row.data.npi_number || '—'}</td>
                    <td>{row.errors.length ? row.errors.join(', ') : 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 100 ? <p className="preview-note">Showing first 100 rows for review.</p> : null}
        </section>
      ) : (
        <EmptyState
          title="No CSV selected"
          description="Import leads with headers such as first_name, last_name, specialty, practice_name, phone, email, website, address, city, state, zip_code, graduation_year, owner_status, contact_status, notes, npi_number, and tags."
        />
      )}

      <section className="panel import-preview">
        <div className="panel-heading">
          <div>
            <h2>Recent import batches</h2>
            <p>Latest batch records stored in Supabase.</p>
          </div>
        </div>
        {recentBatches.length ? (
          <div className="table-wrap">
            <table className="crm-table import-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>File</th>
                  <th>Source</th>
                  <th>Total</th>
                  <th>Successful</th>
                  <th>Failed</th>
                  <th>Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batch_id}</td>
                    <td>{batch.file_name || '—'}</td>
                    <td>{batch.import_source || '—'}</td>
                    <td>{batch.total_rows || 0}</td>
                    <td>{batch.successful_rows || 0}</td>
                    <td>{batch.failed_rows || 0}</td>
                    <td>{batch.duplicate_rows || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No import batches yet" description="Completed imports will appear here." />
        )}
      </section>

      <section className="panel import-preview">
        <div className="panel-heading">
          <div>
            <h2>Queue Status</h2>
            <p>Most recent enrichment and scoring jobs.</p>
          </div>
        </div>
        {pipelineStatus?.queueRows?.length ? (
          <div className="table-wrap">
            <table className="crm-table import-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Dentist ID</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Scheduled</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {pipelineStatus.queueRows.map((job) => (
                  <tr key={job.id}>
                    <td>{job.job_type}</td>
                    <td>{job.dentist_id}</td>
                    <td>{job.status}</td>
                    <td>{job.attempts || 0}</td>
                    <td>{formatDateTime(job.scheduled_for)}</td>
                    <td>{job.last_error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No queue jobs" description="Queued enrichment and scoring jobs will appear here." />
        )}
      </section>
    </div>
  )
}

function PipelineMetric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
    </div>
  )
}

function SummaryItem({ icon, label, value }) {
  return (
    <div>
      {icon}
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function summarizePipelineResult(data) {
  if (!data || typeof data !== 'object') return 'done'
  return Object.entries(data)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    .slice(0, 6)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ')
}

export default ImportPage
