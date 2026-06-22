import Papa from 'papaparse'
import { blankDentistForm } from './constants.js'
import { cleanDentistPayload } from './formatters.js'

const headerAliases = {
  first_name: ['first_name', 'first name', 'firstname'],
  last_name: ['last_name', 'last name', 'lastname'],
  credentials: ['credentials', 'degree'],
  specialty: ['specialty', 'speciality'],
  npi_number: ['npi_number', 'npi number', 'npi'],
  practice_name: ['practice_name', 'practice name', 'practice', 'business name'],
  website: ['website', 'url'],
  phone: ['phone', 'phone number', 'telephone'],
  email: ['email', 'email address'],
  address: ['address', 'street address'],
  city: ['city'],
  state: ['state'],
  zip_code: ['zip_code', 'zip code', 'zip', 'postal code'],
  graduation_year: ['graduation_year', 'graduation year', 'grad year'],
  estimated_age_range: ['estimated_age_range', 'estimated age range', 'age range'],
  owner_status: ['owner_status', 'owner status'],
  contact_status: ['contact_status', 'contact status'],
  notes: ['notes', 'note'],
  next_follow_up_date: ['next_follow_up_date', 'next follow up', 'follow up date'],
  tags: ['tags'],
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replaceAll('-', ' ').replaceAll('_', ' ')
}

export function parseCsv(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => String(value || '').trim(),
  })

  if (parsed.errors.length) {
    const firstError = parsed.errors[0]
    throw new Error(`CSV parse error on row ${firstError.row || 1}: ${firstError.message}`)
  }

  return {
    headers: parsed.meta.fields || [],
    rows: parsed.data.map((raw, index) => ({ rowNumber: index + 2, raw })),
  }
}

export function mapCsvRows(rows) {
  const aliasLookup = new Map()
  Object.entries(headerAliases).forEach(([field, aliases]) => {
    aliases.forEach((alias) => aliasLookup.set(normalizeHeader(alias), field))
  })

  return rows.map((row) => {
    const mapped = { ...blankDentistForm }
    Object.entries(row.raw).forEach(([header, value]) => {
      const field = aliasLookup.get(normalizeHeader(header))
      if (field) mapped[field] = value
    })

    return {
      rowNumber: row.rowNumber,
      data: cleanDentistPayload(mapped),
      errors: validateDentistImportRow(mapped),
    }
  })
}

export function validateDentistImportRow(row) {
  const errors = []
  const hasName = Boolean(row.first_name || row.last_name)

  if (!hasName) errors.push('Missing doctor name')
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Invalid email')
  if (row.graduation_year && !/^\d{4}$/.test(String(row.graduation_year))) errors.push('Invalid graduation year')
  if (row.state && String(row.state).length > 2) errors.push('Use two-letter state')

  return errors
}

export function annotateDuplicates(rows, remoteDuplicates) {
  const seenNpis = new Set()
  const seenEmails = new Set()

  return rows.map((row) => {
    const errors = [...row.errors]
    const npi = row.data.npi_number ? String(row.data.npi_number).toLowerCase() : ''
    const email = row.data.email ? String(row.data.email).toLowerCase() : ''

    if (npi) {
      if (seenNpis.has(npi)) errors.push('Duplicate NPI in file')
      if (remoteDuplicates.duplicateNpis.has(npi)) errors.push('Duplicate NPI in CRM')
      seenNpis.add(npi)
    }

    if (email) {
      if (seenEmails.has(email)) errors.push('Duplicate email in file')
      if (remoteDuplicates.duplicateEmails.has(email)) errors.push('Duplicate email in CRM')
      seenEmails.add(email)
    }

    return { ...row, errors }
  })
}

export function getDuplicateLookupValues(rows) {
  const npiNumbers = []
  const emails = []

  rows.forEach((row) => {
    if (row.data.npi_number) npiNumbers.push(String(row.data.npi_number))
    if (row.data.email) emails.push(String(row.data.email).toLowerCase())
  })

  return {
    npiNumbers: [...new Set(npiNumbers)],
    emails: [...new Set(emails)],
  }
}

export function chunkRows(rows, size) {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}
