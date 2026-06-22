import { CheckCircle2, FileUp, Upload, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import {
  createDentistRecordsBatch,
  createImportBatch,
  findDuplicateDentists,
  getRecentImportBatches,
  updateImportBatch,
} from '../services/dentistsService.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
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

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows])
  const invalidRows = rows.length - validRows.length

  useEffect(() => {
    async function loadBatches() {
      if (!isSupabaseConfigured) return
      const batchesResult = await getRecentImportBatches()
      if (!batchesResult.error) setRecentBatches(batchesResult.data)
    }

    void loadBatches()
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
      const batchesResult = await getRecentImportBatches()
      if (!batchesResult.error) setRecentBatches(batchesResult.data)
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
    const batchesResult = await getRecentImportBatches()
    if (!batchesResult.error) setRecentBatches(batchesResult.data)
    setSummary({ batchId, successCount, failureCount, skippedCount: invalidRows, duplicateCount, totalRows: rows.length })
    setImporting(false)
  }

  if (!isSupabaseConfigured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before importing CSV data."
      />
    )
  }

  return (
    <div className="import-page">
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

export default ImportPage
