import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Database,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../services/supabaseClient.js'
import { downloadCsv } from '../utils/csv.js'

const tableDefinitions = [
  {
    key: 'dentists',
    label: 'dentists',
    description: 'Lead and practice records',
    columns: [
      'id',
      'first_name',
      'last_name',
      'credentials',
      'specialty',
      'npi_number',
      'taxonomy_code',
      'graduation_year',
      'estimated_age_range',
      'years_in_practice',
      'practice_name',
      'website',
      'phone',
      'email',
      'address',
      'city',
      'state',
      'zip_code',
      'owner_status',
      'number_of_locations',
      'solo_practice',
      'multi_location',
      'google_rating',
      'google_review_count',
      'lead_score',
      'source_confidence',
      'contact_status',
      'lead_source',
      'notes',
      'next_follow_up_date',
      'last_contact_date',
      'follow_up_priority',
      'tags',
      'import_source',
      'import_batch_id',
      'osm_id',
      'google_place_id',
      'practice_domain',
      'public_email',
      'owner_confidence',
      'education_school',
      'graduation_year_source',
      'data_sources',
      'data_enriched_at',
      'enrichment_status',
      'enrichment_error',
      'created_at',
      'updated_at',
    ],
    overviewColumns: [
      'id',
      'first_name',
      'last_name',
      'practice_name',
      'specialty',
      'graduation_year',
      'city',
      'state',
      'contact_status',
      'lead_score',
      'enrichment_status',
      'next_follow_up_date',
      'email',
      'phone',
      'public_email',
      'practice_domain',
      'owner_confidence',
      'education_school',
      'graduation_year_source',
      'created_at',
    ],
    searchableColumns: ['first_name', 'last_name', 'practice_name', 'email', 'phone', 'city', 'state', 'specialty', 'npi_number', 'tags'],
    defaultSort: 'id',
  },
  {
    key: 'contact_notes',
    label: 'contact_notes',
    description: 'Timeline notes linked to dentists',
    columns: ['id', 'dentist_id', 'note', 'contact_method', 'contact_date', 'created_at'],
    overviewColumns: ['id', 'dentist_id', 'contact_method', 'contact_date', 'note', 'created_at'],
    searchableColumns: ['note', 'contact_method'],
    defaultSort: 'created_at',
  },
  {
    key: 'crm_tasks',
    label: 'crm_tasks',
    description: 'Follow-up tasks linked to dentists',
    columns: ['id', 'dentist_id', 'title', 'description', 'due_date', 'priority', 'status', 'created_at', 'updated_at'],
    overviewColumns: ['id', 'dentist_id', 'title', 'due_date', 'priority', 'status', 'created_at'],
    searchableColumns: ['title', 'description', 'priority', 'status'],
    defaultSort: 'due_date',
  },
  {
    key: 'import_batches',
    label: 'import_batches',
    description: 'CSV import audit records',
    columns: [
      'id',
      'batch_id',
      'file_name',
      'import_source',
      'total_rows',
      'successful_rows',
      'failed_rows',
      'duplicate_rows',
      'notes',
      'created_at',
    ],
    overviewColumns: ['id', 'batch_id', 'file_name', 'import_source', 'total_rows', 'successful_rows', 'failed_rows', 'duplicate_rows', 'created_at'],
    searchableColumns: ['batch_id', 'file_name', 'import_source', 'notes'],
    defaultSort: 'created_at',
  },
  {
    key: 'enrichment_queue',
    label: 'enrichment_queue',
    description: 'Queued enrichment and scoring jobs',
    columns: ['id', 'dentist_id', 'job_type', 'status', 'attempts', 'last_error', 'scheduled_for', 'created_at', 'updated_at'],
    overviewColumns: ['id', 'dentist_id', 'job_type', 'status', 'attempts', 'scheduled_for', 'last_error'],
    searchableColumns: ['job_type', 'status', 'last_error'],
    defaultSort: 'scheduled_for',
  },
]

const pageSizeOptions = [25, 50, 100, 200]
const viewModes = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'full', label: 'Full', icon: Columns3 },
]

function DatabasePage() {
  const [tableKey, setTableKey] = useState(tableDefinitions[0].key)
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [tableCounts, setTableCounts] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('overview')
  const [hiddenColumns, setHiddenColumns] = useState({})
  const [columnFilters, setColumnFilters] = useState({})
  const [sort, setSort] = useState({ column: tableDefinitions[0].defaultSort, direction: 'asc' })
  const [loading, setLoading] = useState(false)
  const [countsLoading, setCountsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')

  const table = useMemo(() => tableDefinitions.find((item) => item.key === tableKey) || tableDefinitions[0], [tableKey])
  const baseColumns = viewMode === 'full' ? table.columns : table.overviewColumns
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumns[table.key] || []), [hiddenColumns, table.key])
  const visibleColumns = baseColumns.filter((column) => !hiddenColumnSet.has(column))
  const activeColumnFilters = useMemo(() => columnFilters[table.key] || {}, [columnFilters, table.key])
  const activeColumnFilterCount = Object.values(activeColumnFilters).filter((value) => String(value || '').trim()).length
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1)
  const activeTableCount = tableCounts[table.key] ?? totalCount
  const filtered = search.trim().length > 0 || activeColumnFilterCount > 0

  useEffect(() => {
    const timeout = window.setTimeout(() => setPage(1), 220)
    return () => window.clearTimeout(timeout)
  }, [search, columnFilters])

  useEffect(() => {
    let mounted = true

    async function loadCounts() {
      if (!isSupabaseConfigured) return

      setCountsLoading(true)
      const result = await fetchTableCounts()
      if (!mounted) return

      if (result.error) {
        setError(result.error)
      } else {
        setTableCounts(result.data)
      }
      setCountsLoading(false)
    }

    void loadCounts()

    return () => {
      mounted = false
    }
  }, [reloadKey])

  useEffect(() => {
    let mounted = true

    async function loadRows() {
      if (!isSupabaseConfigured) return

      setLoading(true)
      setError('')
      const result = await fetchTableRows({ table, page, pageSize, search, sort, columnFilters: activeColumnFilters })
      if (!mounted) return

      if (result.error) {
        setRows([])
        setTotalCount(0)
        setError(result.error)
      } else {
        setRows(result.data)
        setTotalCount(result.count)
      }
      setLoading(false)
    }

    void loadRows()

    return () => {
      mounted = false
    }
  }, [activeColumnFilters, page, pageSize, search, sort, table, reloadKey])

  const handleTableChange = (nextTableKey) => {
    const nextTable = tableDefinitions.find((item) => item.key === nextTableKey) || tableDefinitions[0]
    setTableKey(nextTableKey)
    setSearch('')
    setPage(1)
    setSort({ column: nextTable.defaultSort, direction: 'asc' })
  }

  const handleViewModeChange = (nextMode) => {
    setViewMode(nextMode)
    if (nextMode === 'overview' && !table.overviewColumns.includes(sort.column)) {
      setSort({ column: table.defaultSort, direction: 'asc' })
    }
  }

  const handleSort = (column) => {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleColumnVisibilityChange = (column, checked) => {
    setHiddenColumns((current) => {
      const nextHidden = new Set(current[table.key] || [])
      if (checked) {
        nextHidden.delete(column)
      } else {
        nextHidden.add(column)
      }
      return { ...current, [table.key]: [...nextHidden] }
    })
  }

  const handleColumnFilterChange = (column, value) => {
    setColumnFilters((current) => ({
      ...current,
      [table.key]: {
        ...(current[table.key] || {}),
        [column]: value,
      },
    }))
  }

  const clearColumnFilters = () => {
    setColumnFilters((current) => ({ ...current, [table.key]: {} }))
  }

  const showAllColumns = () => {
    setViewMode('full')
    setHiddenColumns((current) => ({ ...current, [table.key]: [] }))
  }

  const showOverviewColumns = () => {
    setViewMode('overview')
    setHiddenColumns((current) => ({ ...current, [table.key]: [] }))
    if (!table.overviewColumns.includes(sort.column)) {
      setSort({ column: table.defaultSort, direction: 'asc' })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    const result = await fetchAllTableRows({ table, search, sort, columnFilters: activeColumnFilters })
    setExporting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    downloadCsv(Papa.unparse(result.data), `${table.key}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (!isSupabaseConfigured) {
    return <EmptyState title="Supabase connection required" description={supabaseConfigError} />
  }

  return (
    <div className="database-page">
      <section className="database-summary-grid">
        <SummaryCard label="Active table" value={formatTableName(table.label)} detail={table.description} />
        <SummaryCard label="Total rows" value={formatNumber(activeTableCount)} detail={countsLoading ? 'Refreshing counts...' : 'Visible through current RLS'} />
        <SummaryCard label="Current view" value={viewMode === 'full' ? 'Full schema' : 'Overview'} detail={`${visibleColumns.length} of ${baseColumns.length} columns shown`} />
        <SummaryCard label="Result set" value={formatNumber(totalCount)} detail={filtered ? `${activeColumnFilterCount} column filters active` : 'No filters active'} />
      </section>

      <section className="panel database-controls">
        <div className="panel-heading">
          <div>
            <h2>Database tables</h2>
            <p>{formatNumber(activeTableCount)} total rows in {table.label}</p>
          </div>
          <div className="toolbar-group">
            <button type="button" className="ghost-button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={16} />
              Refresh
            </button>
            <button type="button" className="primary-button" onClick={handleExport} disabled={exporting || loading}>
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="database-toolbar">
          <label className="field-group">
            <span>Table</span>
            <select value={tableKey} onChange={(event) => handleTableChange(event.target.value)}>
              {tableDefinitions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Search</span>
            <div className="search-field database-search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${formatTableName(table.label)}`} />
            </div>
          </label>
          <div className="field-group">
            <span>Columns</span>
            <div className="segmented-control">
              {viewModes.map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    key={mode.key}
                    type="button"
                    className={viewMode === mode.key ? 'active' : ''}
                    onClick={() => handleViewModeChange(mode.key)}
                  >
                    <Icon size={15} />
                    {mode.label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="field-group">
            <span>Rows</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="database-table-tabs">
          {tableDefinitions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`database-table-tab ${item.key === table.key ? 'active' : ''}`}
              onClick={() => handleTableChange(item.key)}
            >
              <Database size={16} />
              <span>{item.label}</span>
              <b>{formatNumber(tableCounts[item.key] ?? 0)}</b>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <div className="database-tools-grid">
          <details className="database-tools-panel">
            <summary>
              <span>
                <EyeOff size={16} />
                Column visibility
              </span>
              <b>{visibleColumns.length}/{baseColumns.length}</b>
            </summary>
            <div className="database-tools-actions">
              <button type="button" className="text-button" onClick={showOverviewColumns}>
                Overview columns
              </button>
              <button type="button" className="text-button" onClick={showAllColumns}>
                All columns
              </button>
            </div>
            <div className="database-column-grid">
              {baseColumns.map((column) => (
                <label key={column} className="database-check-field">
                  <input
                    type="checkbox"
                    checked={!hiddenColumnSet.has(column)}
                    disabled={!hiddenColumnSet.has(column) && visibleColumns.length <= 1}
                    onChange={(event) => handleColumnVisibilityChange(column, event.target.checked)}
                  />
                  <span>{column}</span>
                </label>
              ))}
            </div>
          </details>

          <details className="database-tools-panel">
            <summary>
              <span>
                <SlidersHorizontal size={16} />
                Column filters
              </span>
              <b>{activeColumnFilterCount}</b>
            </summary>
            <div className="database-tools-actions">
              <button type="button" className="text-button" onClick={clearColumnFilters} disabled={!activeColumnFilterCount}>
                <X size={14} />
                Clear filters
              </button>
            </div>
            <div className="database-filter-grid">
              {table.columns.map((column) => (
                <ColumnFilterControl
                  key={column}
                  column={column}
                  value={activeColumnFilters[column] || ''}
                  onChange={(value) => handleColumnFilterChange(column, value)}
                />
              ))}
            </div>
          </details>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="panel table-panel database-table-panel">
        <div className="panel-heading">
          <div>
            <h2>{formatTableName(table.label)}</h2>
            <p>
              Page {page} of {totalPages} · sorted by {sort.column} {sort.direction}
            </p>
          </div>
          <div className="table-meta">{visibleColumns.length || 0} columns shown</div>
        </div>

        {loading ? (
          <LoadingState label={`Loading ${table.label}...`} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="crm-table database-table">
                <thead>
                  <tr>
                    {(visibleColumns.length ? visibleColumns : [baseColumns[0]]).map((column) => (
                      <th key={column}>
                        <button type="button" className="sort-button" onClick={() => handleSort(column)}>
                          <span>{column}</span>
                          <SortIcon sort={sort} columnKey={column} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id ?? `${table.key}-${page}-${index}`}>
                      {(visibleColumns.length ? visibleColumns : [baseColumns[0]]).map((column) => (
                        <td key={column} title={formatCellValue(row[column])}>
                          {formatCellValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!rows.length ? (
              <EmptyState title="No rows visible" description="This table has no matching rows for the current filters." />
            ) : null}

            <div className="table-footer">
              <span>{totalCount.toLocaleString()} total rows</span>
              <div className="pagination">
                <button type="button" className="icon-button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  <ChevronLeft size={16} />
                </button>
                <span>{page}</span>
                <button type="button" className="icon-button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, detail }) {
  return (
    <article className="database-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function ColumnFilterControl({ column, value, onChange }) {
  const type = getColumnType(column)

  if (type === 'boolean') {
    return (
      <label className="field-group database-filter-field">
        <span>{column}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Any</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </label>
    )
  }

  return (
    <label className="field-group database-filter-field">
      <span>{column}</span>
      <input
        type={type === 'number' ? 'number' : type === 'date' || type === 'datetime' ? 'date' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={type === 'text' ? 'contains...' : 'exact...'}
      />
    </label>
  )
}

async function fetchTableCounts() {
  try {
    const results = await Promise.all(
      tableDefinitions.map(async (table) => {
        const { count, error } = await supabase.from(table.key).select('id', { count: 'exact', head: true })
        if (error) throw error
        return [table.key, count || 0]
      }),
    )

    return { data: Object.fromEntries(results), error: '' }
  } catch (error) {
    return { data: {}, error: error.message || 'Failed to load table counts.' }
  }
}

async function fetchTableRows({ table, page, pageSize, search, sort, columnFilters }) {
  try {
    let query = supabase.from(table.key).select(table.columns.join(','), { count: 'exact' })
    query = applySearch(query, table, search)
    query = applyColumnFilters(query, table, columnFilters)
    query = query.order(sort.column, { ascending: sort.direction === 'asc', nullsFirst: false })
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], count: count || 0, error: '' }
  } catch (error) {
    return { data: [], count: 0, error: error.message || `Failed to load ${table.label}.` }
  }
}

async function fetchAllTableRows({ table, search, sort, columnFilters }) {
  try {
    let rows = []
    let offset = 0
    let count = 0

    do {
      let query = supabase.from(table.key).select(table.columns.join(','), { count: 'exact' })
      query = applySearch(query, table, search)
      query = applyColumnFilters(query, table, columnFilters)
      query = query.order(sort.column, { ascending: sort.direction === 'asc', nullsFirst: false })
      query = query.range(offset, offset + 999)

      const { data, error, count: nextCount } = await query
      if (error) throw error
      rows = rows.concat(data || [])
      count = nextCount || rows.length
      offset = rows.length
    } while (offset < count)

    return { data: rows, error: '' }
  } catch (error) {
    return { data: [], error: error.message || `Failed to export ${table.label}.` }
  }
}

function applySearch(query, table, search) {
  const term = sanitizeSearchTerm(search)
  if (!term || !table.searchableColumns.length) return query

  return query.or(table.searchableColumns.map((column) => `${column}.ilike.%${term}%`).join(','))
}

function applyColumnFilters(query, table, filters) {
  for (const column of table.columns) {
    const rawValue = String(filters?.[column] || '').trim()
    if (!rawValue) continue

    const type = getColumnType(column)
    if (type === 'text') {
      query = query.ilike(column, `%${sanitizeSearchTerm(rawValue)}%`)
    } else if (type === 'boolean') {
      query = query.eq(column, rawValue === 'true')
    } else if (type === 'number') {
      const numericValue = Number(rawValue)
      if (!Number.isFinite(numericValue)) throw new Error(`${column} must be a number.`)
      query = query.eq(column, numericValue)
    } else if (type === 'date') {
      if (!isDateInput(rawValue)) throw new Error(`${column} must be a date in YYYY-MM-DD format.`)
      query = query.eq(column, rawValue)
    } else if (type === 'datetime') {
      if (!isDateInput(rawValue)) throw new Error(`${column} must be a date in YYYY-MM-DD format.`)
      query = query.gte(column, rawValue).lt(column, nextDateIso(rawValue))
    }
  }

  return query
}

function sanitizeSearchTerm(value) {
  return value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ')
}

function getColumnType(column) {
  if (['solo_practice', 'multi_location'].includes(column)) return 'boolean'
  if (['id', 'dentist_id'].includes(column)) return 'number'
  if (
    [
      'graduation_year',
      'years_in_practice',
      'number_of_locations',
      'source_confidence',
      'owner_confidence',
      'google_rating',
      'google_review_count',
      'lead_score',
      'source_confidence',
      'total_rows',
      'successful_rows',
      'failed_rows',
      'duplicate_rows',
      'attempts',
    ].includes(column)
  ) {
    return 'number'
  }
  if (column.endsWith('_at') || column === 'scheduled_for') return 'datetime'
  if (column.endsWith('_date') || column === 'due_date') return 'date'
  return 'text'
}

function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function nextDateIso(value) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function formatTableName(value) {
  return value.replace(/_/g, ' ')
}

function SortIcon({ sort, columnKey }) {
  if (sort.column !== columnKey) return <ArrowUpDown size={14} />
  return sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
}

export default DatabasePage
