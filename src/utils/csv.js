import { formatDoctorName } from './formatters.js'

const csvColumns = [
  ['Doctor Name', (row) => formatDoctorName(row)],
  ['Specialty', (row) => row.specialty],
  ['Practice Name', (row) => row.practice_name],
  ['City', (row) => row.city],
  ['State', (row) => row.state],
  ['Graduation Year', (row) => row.graduation_year],
  ['Owner Status', (row) => row.owner_status],
  ['Contact Status', (row) => row.contact_status],
  ['Next Follow Up', (row) => row.next_follow_up_date],
  ['Email', (row) => row.email],
  ['Phone', (row) => row.phone],
]

function escapeCell(value) {
  const content = value == null ? '' : String(value)
  return `"${content.replaceAll('"', '""')}"`
}

export function buildCsv(rows) {
  const header = csvColumns.map(([label]) => escapeCell(label)).join(',')
  const body = rows.map((row) => csvColumns.map(([, getter]) => escapeCell(getter(row))).join(',')).join('\n')
  return `${header}\n${body}`
}

export function downloadCsv(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
