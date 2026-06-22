import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, formatDoctorName } from '../../utils/formatters.js'

const columns = [
  { key: 'doctor_name', label: 'Doctor Name' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'practice_name', label: 'Practice Name' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'graduation_year', label: 'Graduation Year' },
  { key: 'owner_status', label: 'Owner Status' },
  { key: 'contact_status', label: 'Contact Status' },
  { key: 'next_follow_up_date', label: 'Next Follow Up' },
  { key: 'lead_score', label: 'Lead Score' },
  { key: 'created_at', label: 'Created Date' },
]

function DentistsTable({
  dentists,
  selectedIds,
  selectedDentistId,
  sort,
  page,
  totalPages,
  pageSize,
  totalCount,
  onPageSizeChange,
  onSelectRow,
  onSelectAll,
  onSort,
  onPageChange,
  onOpenDetail,
}) {
  const allSelected = dentists.length > 0 && dentists.every((dentist) => selectedIds.includes(dentist.id))

  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Lead workspace</h2>
          <p>
            Page {page} of {Math.max(totalPages, 1)}
          </p>
        </div>
        <div className="table-meta">{selectedIds.length} selected</div>
      </div>

      <div className="table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
              {columns.map((column) => (
                <th key={column.key}>
                  <button type="button" className="sort-button" onClick={() => onSort(column.key)}>
                    <span>{column.label}</span>
                    <SortIcon sort={sort} columnKey={column.key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dentists.map((dentist) => (
              <tr
                key={dentist.id}
                className={selectedDentistId === dentist.id ? 'active' : ''}
                onClick={() => onOpenDetail(dentist)}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(dentist.id)}
                    onChange={(event) => onSelectRow(dentist.id, event.target.checked)}
                    aria-label={`Select ${formatDoctorName(dentist)}`}
                  />
                </td>
                <td>{formatDoctorName(dentist)}</td>
                <td>{dentist.specialty || '—'}</td>
                <td>{dentist.practice_name || '—'}</td>
                <td>{dentist.city || '—'}</td>
                <td>{dentist.state || '—'}</td>
                <td>{dentist.graduation_year || '—'}</td>
                <td>{dentist.owner_status || '—'}</td>
                <td>{dentist.contact_status || '—'}</td>
                <td>{formatDate(dentist.next_follow_up_date)}</td>
                <td>{dentist.lead_score ?? 0}</td>
                <td>{formatDate(dentist.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>{totalCount.toLocaleString()} total results</span>
        <label className="page-size-control">
          <span>Rows</span>
          <select value={pageSize} onChange={(event) => onPageSizeChange(event.target.value)}>
            {[25, 50, 100, 200].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="pagination">
          <button type="button" className="icon-button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span>{page}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}

function SortIcon({ sort, columnKey }) {
  if (sort.column !== columnKey) return <ArrowUpDown size={14} />
  return sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
}

export default DentistsTable
