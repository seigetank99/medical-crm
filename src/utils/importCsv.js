import Papa from 'papaparse'
import { blankDentistForm } from './constants.js'
import { calculateLeadScore, cleanDentistPayload, normalizeContactStatus, normalizeSpecialty, normalizeState } from './formatters.js'

const headerAliases = {
  first_name: ['first_name', 'first name', 'firstname'],
  last_name: ['last_name', 'last name', 'lastname'],
  credentials: ['credentials', 'degree'],
  specialty: ['specialty', 'speciality'],
  npi_number: ['npi_number', 'npi number', 'npi'],
  graduation_year: ['graduation_year', 'graduation year', 'grad year'],
  practice_name: ['practice_name', 'practice name', 'practice', 'business name'],
  website: ['website', 'url'],
  phone: ['phone', 'phone number', 'telephone'],
  email: ['email', 'email address'],
  address: ['address', 'street address'],
  city: ['city'],
  state: ['state'],
  zip_code: ['zip_code', 'zip code', 'zip', 'zipcode', 'postal code'],
  estimated_age_range: ['estimated_age_range', 'estimated age range', 'age range'],
  google_rating: ['google_rating', 'google rating', 'rating'],
  google_review_count: ['google_review_count', 'google review count', 'review count', 'reviews'],
  owner_status: ['owner_status', 'owner status'],
  contact_status: ['contact_status', 'contact status'],
  lead_source: ['lead_source', 'lead source'],
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

    if (mapped.state) mapped.state = normalizeState(mapped.state)
    if (mapped.specialty) mapped.specialty = normalizeSpecialty(mapped.specialty)
    if (mapped.contact_status) mapped.contact_status = normalizeContactStatus(mapped.contact_status)

    const data = cleanDentistPayload(mapped)
    data.lead_score = calculateLeadScore(data)

    return {
      rowNumber: row.rowNumber,
      data,
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
  const seenPhones = new Set()
  const seenNames = new Set()
  const seenPractices = new Set()

  return rows.map((row) => {
    const errors = [...row.errors]
    const npi = row.data.npi_number ? String(row.data.npi_number).toLowerCase() : ''
    const email = row.data.email ? String(row.data.email).toLowerCase() : ''
    const phone = row.data.phone ? String(row.data.phone).toLowerCase() : ''
    const nameKey = `${row.data.first_name || ''}|${row.data.last_name || ''}|${row.data.city || ''}`.toLowerCase()
    const practiceKey = `${row.data.practice_name || ''}|${row.data.city || ''}|${row.data.state || ''}`.toLowerCase()

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

    if (phone) {
      if (seenPhones.has(phone)) errors.push('Duplicate phone in file')
      if (remoteDuplicates.duplicatePhones.has(phone)) errors.push('Duplicate phone in CRM')
      seenPhones.add(phone)
    }

    if (row.data.first_name && row.data.last_name && row.data.city) {
      if (seenNames.has(nameKey)) errors.push('Duplicate name/city in file')
      if (remoteDuplicates.duplicateNames.has(nameKey)) errors.push('Duplicate name/city in CRM')
      seenNames.add(nameKey)
    }

    if (row.data.practice_name && row.data.city && row.data.state) {
      if (seenPractices.has(practiceKey)) errors.push('Duplicate practice/city/state in file')
      if (remoteDuplicates.duplicatePractices.has(practiceKey)) errors.push('Duplicate practice/city/state in CRM')
      seenPractices.add(practiceKey)
    }

    return { ...row, errors }
  })
}

export function getDuplicateLookupValues(rows) {
  const npiNumbers = []
  const emails = []
  const phones = []
  const names = []
  const practices = []

  rows.forEach((row) => {
    if (row.data.npi_number) npiNumbers.push(String(row.data.npi_number))
    if (row.data.email) emails.push(String(row.data.email).toLowerCase())
    if (row.data.phone) phones.push(String(row.data.phone).toLowerCase())
    if (row.data.first_name && row.data.last_name && row.data.city) {
      names.push({ first_name: row.data.first_name, last_name: row.data.last_name, city: row.data.city })
    }
    if (row.data.practice_name && row.data.city && row.data.state) {
      practices.push({ practice_name: row.data.practice_name, city: row.data.city, state: row.data.state })
    }
  })

  return {
    npiNumbers: [...new Set(npiNumbers)],
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    names,
    practices,
  }
}

export function createImportBatchId() {
  return `import_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function chunkRows(rows, size) {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}
