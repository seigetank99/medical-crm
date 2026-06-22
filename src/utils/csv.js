import Papa from 'papaparse'
import { formatDoctorName } from './formatters.js'

const csvColumns = [
  ['Doctor Name', (row) => formatDoctorName(row)],
  ['First Name', (row) => row.first_name],
  ['Last Name', (row) => row.last_name],
  ['Specialty', (row) => row.specialty],
  ['NPI Number', (row) => row.npi_number],
  ['Practice Name', (row) => row.practice_name],
  ['City', (row) => row.city],
  ['State', (row) => row.state],
  ['ZIP Code', (row) => row.zip_code],
  ['Graduation Year', (row) => row.graduation_year],
  ['Estimated Age Range', (row) => row.estimated_age_range],
  ['Owner Status', (row) => row.owner_status],
  ['Contact Status', (row) => row.contact_status],
  ['Lead Score', (row) => row.lead_score],
  ['Next Follow Up', (row) => row.next_follow_up_date],
  ['Last Contact Date', (row) => row.last_contact_date],
  ['Follow Up Priority', (row) => row.follow_up_priority],
  ['Email', (row) => row.email],
  ['Phone', (row) => row.phone],
  ['Website', (row) => row.website],
  ['Tags', (row) => row.tags],
  ['Import Source', (row) => row.import_source],
  ['Import Batch ID', (row) => row.import_batch_id],
  ['Created At', (row) => row.created_at],
]

export function buildCsv(rows) {
  return Papa.unparse(rows.map((row) => Object.fromEntries(csvColumns.map(([label, getter]) => [label, getter(row) ?? '']))))
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
