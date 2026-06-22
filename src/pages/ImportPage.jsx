import { CheckCircle2, FileUp, Globe2, Play, RefreshCw, RotateCcw, Sparkles, Upload, XCircle } from 'lucide-react'
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
const apiConnectionsKey = 'omnihealth-api-connections'
const npiFullPullKey = 'omnihealth-npi-full-pull'
const defaultConnectionForm = {
  name: '',
  url: '',
  authMode: 'none',
  serverSecretName: '',
  notes: '',
}

const npiImportDepthOptions = [
  { value: 1, label: 'Starter', detail: 'Fastest pull' },
  { value: 3, label: 'Expanded', detail: 'More records' },
  { value: 5, label: 'Deep', detail: 'Recommended' },
  { value: 10, label: 'Maximum', detail: 'Largest pull' },
]

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
  const [includeWebsiteEnrichment, setIncludeWebsiteEnrichment] = useState(true)
  const [npiMaxPages, setNpiMaxPages] = useState(5)
  const [npiFullPull, setNpiFullPull] = useState(() => loadNpiFullPull())
  const [npiTestLoading, setNpiTestLoading] = useState(false)
  const [npiTestResult, setNpiTestResult] = useState(null)
  const [connectionForm, setConnectionForm] = useState(defaultConnectionForm)
  const [apiConnections, setApiConnections] = useState(() => loadApiConnections())
  const [connectionTestMessage, setConnectionTestMessage] = useState('')

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
    return result
  }

  const handleNpiTest = async () => {
    setNpiTestLoading(true)
    setNpiTestResult(null)

    try {
      const url = new URL('https://npiregistry.cms.hhs.gov/api/')
      url.searchParams.set('version', '2.1')
      url.searchParams.set('state', 'NY')
      url.searchParams.set('taxonomy_description', 'Dentist')
      url.searchParams.set('limit', '3')
      url.searchParams.set('skip', '0')

      const response = await fetch(url)
      if (!response.ok) throw new Error(`NPI Registry returned ${response.status}.`)
      const payload = await response.json()
      const first = payload.results?.[0]
      setNpiTestResult({
        count: payload.result_count || payload.results?.length || 0,
        sample: first
          ? {
              npi: first.number,
              name: first.basic?.organization_name || [first.basic?.first_name, first.basic?.last_name].filter(Boolean).join(' '),
              taxonomy: first.taxonomies?.[0]?.desc,
              city: first.addresses?.find((address) => address.address_purpose === 'LOCATION')?.city,
              state: first.addresses?.find((address) => address.address_purpose === 'LOCATION')?.state,
            }
          : null,
      })
    } catch (error) {
      setNpiTestResult({ error: error.message || 'Unable to reach NPI Registry.' })
    } finally {
      setNpiTestLoading(false)
    }
  }

  const handleSaveConnection = () => {
    setConnectionTestMessage('')
    const name = connectionForm.name.trim()
    const url = connectionForm.url.trim()
    if (!name || !url) {
      setConnectionTestMessage('Connection name and URL are required.')
      return
    }

    try {
      const parsed = new URL(url)
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an HTTP or HTTPS URL.')
    } catch (error) {
      setConnectionTestMessage(error.message || 'Enter a valid URL.')
      return
    }

    const nextConnections = [
      ...apiConnections.filter((connection) => connection.name !== name),
      { ...connectionForm, name, url, updated_at: new Date().toISOString() },
    ]
    setApiConnections(nextConnections)
    localStorage.setItem(apiConnectionsKey, JSON.stringify(nextConnections))
    setConnectionForm(defaultConnectionForm)
    setConnectionTestMessage('Connection saved. Store real API keys as Supabase Function secrets, not in the frontend.')
  }

  const handleTestConnection = async (connection) => {
    setConnectionTestMessage('')

    if (connection.authMode !== 'none') {
      setConnectionTestMessage(`"${connection.name}" needs server-side auth. Add its key as a Supabase secret, then create an Edge Function adapter.`)
      return
    }

    try {
      const response = await fetch(connection.url, { method: 'GET' })
      setConnectionTestMessage(`${connection.name}: ${response.status} ${response.statusText || 'OK'}`)
    } catch (error) {
      setConnectionTestMessage(`${connection.name}: ${error.message || 'Request failed. The API may block browser CORS.'}`)
    }
  }

  const handleRemoveConnection = (name) => {
    const nextConnections = apiConnections.filter((connection) => connection.name !== name)
    setApiConnections(nextConnections)
    localStorage.setItem(apiConnectionsKey, JSON.stringify(nextConnections))
  }

  const saveNpiFullPull = (nextPull) => {
    setNpiFullPull(nextPull)
    localStorage.setItem(npiFullPullKey, JSON.stringify(nextPull))
  }

  const handleFullNpiImport = () =>
    handlePipelineAction('Full NPI pull', async () => {
      const result = await runNpiImport({
        startPage: npiFullPull.startPage,
        maxPages: npiFullPull.pagesPerRun,
        limit: 200,
      })

      if (!result.error && Number.isFinite(Number(result.data?.next_start_page))) {
        saveNpiFullPull({
          ...npiFullPull,
          startPage: Number(result.data.next_start_page),
          lastRun: {
            startPage: Number(result.data.start_page || npiFullPull.startPage),
            endPage: Number(result.data.end_page ?? npiFullPull.startPage + npiFullPull.pagesPerRun - 1),
            fetched: Number(result.data.fetched || 0),
            inserted: Number(result.data.inserted || 0),
            updated: Number(result.data.updated || 0),
            skipped: Number(result.data.skipped || 0),
            hasMore: Boolean(result.data.has_more),
            completedAt: new Date().toISOString(),
          },
        })
      }

      return result
    })

  const resetFullNpiPull = () => {
    saveNpiFullPull({ ...npiFullPull, startPage: 0, lastRun: null })
    setPipelineMessage('Full NPI pull cursor reset to page 0.')
    setPipelineMessageError(false)
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

      <section className="panel import-panel">
        <div className="panel-heading">
          <div>
            <h2>API Connections</h2>
            <p>Test public endpoints and track server-side integrations without storing secrets in the browser.</p>
          </div>
        </div>

        <div className="api-connections-grid">
          <article className="api-connection-card">
            <div>
              <h3>NPI Registry</h3>
              <p>Public official API. Use this test to confirm the browser can reach NPI; use Run NPI Import Now to write records through Supabase.</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleNpiTest} disabled={npiTestLoading}>
              <Globe2 size={16} />
              {npiTestLoading ? 'Testing...' : 'Test NPI API'}
            </button>
            {npiTestResult ? (
              <pre className={`api-test-result ${npiTestResult.error ? 'error' : ''}`}>{JSON.stringify(npiTestResult, null, 2)}</pre>
            ) : null}
          </article>

          <article className="api-connection-card">
            <div>
              <h3>Add API Connection</h3>
              <p>Save endpoint metadata here. Private API keys must be configured as Supabase secrets and called from Edge Functions.</p>
            </div>
            <div className="api-connection-form">
              <label className="field-group">
                <span>Name</span>
                <input
                  value={connectionForm.name}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Example: State license API"
                />
              </label>
              <label className="field-group">
                <span>Base URL</span>
                <input
                  value={connectionForm.url}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://api.example.gov/search"
                />
              </label>
              <label className="field-group">
                <span>Auth</span>
                <select
                  value={connectionForm.authMode}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, authMode: event.target.value }))}
                >
                  <option value="none">No auth / public</option>
                  <option value="server-secret">Server-side secret required</option>
                </select>
              </label>
              <label className="field-group">
                <span>Supabase secret name</span>
                <input
                  value={connectionForm.serverSecretName}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, serverSecretName: event.target.value }))}
                  placeholder="Example: STATE_LICENSE_API_KEY"
                />
              </label>
              <label className="field-group api-notes-field">
                <span>Notes</span>
                <textarea
                  value={connectionForm.notes}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="What fields this API can enrich"
                />
              </label>
            </div>
            <button type="button" className="primary-button" onClick={handleSaveConnection}>
              Save Connection
            </button>
          </article>
        </div>

        {connectionTestMessage ? <div className="notice">{connectionTestMessage}</div> : null}

        {apiConnections.length ? (
          <div className="api-connection-list">
            {apiConnections.map((connection) => (
              <div key={connection.name} className="api-connection-row">
                <div>
                  <strong>{connection.name}</strong>
                  <span>{connection.url}</span>
                  {connection.serverSecretName ? <small>Secret: {connection.serverSecretName}</small> : null}
                </div>
                <div className="toolbar-group">
                  <button type="button" className="ghost-button" onClick={() => handleTestConnection(connection)}>
                    Test
                  </button>
                  <button type="button" className="ghost-button danger" onClick={() => handleRemoveConnection(connection.name)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="pipeline-actions-grid">
        <article className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Run NPI Import Now</h2>
              <p>Imports dental providers from the official NPI Registry for NY, NJ, and CT.</p>
            </div>
          </div>
          <label className="field-group">
            <span>Import depth</span>
            <select value={npiMaxPages} onChange={(event) => setNpiMaxPages(Number(event.target.value))}>
              {npiImportDepthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.detail}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={() => handlePipelineAction('NPI import', () => runNpiImport({ maxPages: npiMaxPages, limit: 200 }))}
            disabled={Boolean(pipelineRunning)}
          >
            <Play size={16} />
            {pipelineRunning === 'NPI import' ? 'Running...' : 'Run NPI Import Now'}
          </button>
          <div className="npi-cursor-panel">
            <div>
              <strong>Full dataset cursor</strong>
              <span>
                Next pages {npiFullPull.startPage.toLocaleString()}-
                {(npiFullPull.startPage + npiFullPull.pagesPerRun - 1).toLocaleString()}
              </span>
            </div>
            <div className="npi-cursor-stats">
              <PipelineMetric label="Next page" value={npiFullPull.startPage} />
              <PipelineMetric label="Pages/run" value={npiFullPull.pagesPerRun} />
              <PipelineMetric
                label="Last pages"
                value={
                  npiFullPull.lastRun
                    ? `${npiFullPull.lastRun.startPage.toLocaleString()}-${npiFullPull.lastRun.endPage.toLocaleString()}`
                    : '—'
                }
              />
              <PipelineMetric
                label="Last rows"
                value={
                  npiFullPull.lastRun
                    ? `${npiFullPull.lastRun.inserted.toLocaleString()} new / ${npiFullPull.lastRun.updated.toLocaleString()} updated`
                    : '—'
                }
              />
            </div>
            {npiFullPull.lastRun ? (
              <div className="npi-cursor-detail">
                Last pull finished {formatDateTime(npiFullPull.lastRun.completedAt)}. Fetched{' '}
                {npiFullPull.lastRun.fetched.toLocaleString()}, skipped {npiFullPull.lastRun.skipped.toLocaleString()}, more pages:{' '}
                {npiFullPull.lastRun.hasMore ? 'yes' : 'no'}.
              </div>
            ) : null}
            <label className="field-group">
              <span>Pages per run</span>
              <select
                value={npiFullPull.pagesPerRun}
                onChange={(event) => saveNpiFullPull({ ...npiFullPull, pagesPerRun: Number(event.target.value) })}
              >
                {[1, 3, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="toolbar-group">
              <button type="button" className="ghost-button" onClick={handleFullNpiImport} disabled={Boolean(pipelineRunning)}>
                <Play size={16} />
                {pipelineRunning === 'Full NPI pull' ? 'Pulling...' : 'Pull Next Batch'}
              </button>
              <button type="button" className="ghost-button" onClick={resetFullNpiPull} disabled={Boolean(pipelineRunning)}>
                Reset
              </button>
            </div>
          </div>
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
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeWebsiteEnrichment}
              onChange={(event) => setIncludeWebsiteEnrichment(event.target.checked)}
            />
            <span>Extract public data from practice website</span>
          </label>
          {includeGooglePlaces ? (
            <div className="notice">Google Places API calls may cost money. The API key stays server-side in Supabase secrets.</div>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              handlePipelineAction('Selected dentist enrichment', () =>
                enrichSelectedDentist(Number(selectedDentistId), includeGooglePlaces, includeWebsiteEnrichment),
              )
            }
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
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
    .slice(0, 8)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ')
}

function loadApiConnections() {
  try {
    return JSON.parse(localStorage.getItem(apiConnectionsKey) || '[]')
  } catch {
    return []
  }
}

function loadNpiFullPull() {
  try {
    const stored = JSON.parse(localStorage.getItem(npiFullPullKey) || '{}')
    return {
      startPage: Math.max(Number(stored.startPage || 0), 0),
      pagesPerRun: Math.min(Math.max(Number(stored.pagesPerRun || 5), 1), 10),
      lastRun: stored.lastRun || null,
    }
  } catch {
    return { startPage: 0, pagesPerRun: 5, lastRun: null }
  }
}

export default ImportPage
