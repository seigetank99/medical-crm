export const supportedStates = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

export const taxonomyQueries = [
  { specialty: 'General Dentist', query: 'General Practice', codes: ['1223G0001X', '122300000X'] },
  { specialty: 'Dental Public Health', query: 'Dental Public Health', codes: ['1223D0001X'] },
  { specialty: 'Dental Anesthesiology', query: 'Dental Anesthesiology', codes: ['1223D0004X'] },
  { specialty: 'Orthodontist', query: 'Orthodontics and Dentofacial Orthopedics', codes: ['1223X0400X'] },
  { specialty: 'Oral Surgeon', query: 'Oral and Maxillofacial Surgery', codes: ['1223S0112X'] },
  { specialty: 'Oral and Maxillofacial Pathology', query: 'Oral and Maxillofacial Pathology', codes: ['1223P0106X'] },
  { specialty: 'Oral and Maxillofacial Radiology', query: 'Oral and Maxillofacial Radiology', codes: ['1223X0008X'] },
  { specialty: 'Pediatric Dentist', query: 'Pediatric Dentistry', codes: ['1223P0221X'] },
  { specialty: 'Periodontist', query: 'Periodontics', codes: ['1223P0300X'] },
  { specialty: 'Prosthodontist', query: 'Prosthodontics', codes: ['1223P0700X'] },
  { specialty: 'Endodontist', query: 'Endodontics', codes: ['1223E0200X'] },
]

const taxonomyByCode = new Map(taxonomyQueries.flatMap((item) => item.codes.map((code) => [code, item])))
const nppesTaxonomySlotCount = 15

export function normalizeNpiProvider(provider, fallbackSpecialty) {
  const basic = provider.basic || {}
  const taxonomy = chooseTaxonomy(provider.taxonomies || [], fallbackSpecialty)
  const address = choosePracticeAddress(provider.addresses || [])
  const firstName = cleanText(basic.first_name || basic.authorized_official_first_name)
  const lastName = cleanText(basic.last_name || basic.authorized_official_last_name)

  return {
    npi_number: provider.number ? String(provider.number) : null,
    taxonomy_code: taxonomy?.code || null,
    first_name: firstName,
    last_name: lastName,
    credentials: cleanText(basic.credential || basic.authorized_official_credential),
    specialty: taxonomy?.specialty || fallbackSpecialty,
    practice_name: cleanText(basic.organization_name || basic.name || address?.organization_name || buildProviderName(firstName, lastName)),
    phone: normalizePhone(address?.telephone_number || basic.authorized_official_telephone_number),
    address: cleanText([address?.address_1, address?.address_2].filter(Boolean).join(' ')),
    city: cleanText(address?.city),
    state: cleanText(address?.state),
    zip_code: cleanText(String(address?.postal_code || '').slice(0, 5)),
    lead_source: 'NPI Registry',
    source_confidence: 90,
    contact_status: 'New',
  }
}

export function isSupportedDentalProvider(provider) {
  return (provider.taxonomies || []).some((taxonomy) => taxonomyByCode.has(taxonomy.code))
}

export function normalizeNppesCsvRow(row, fallbackSpecialty = 'General Dentist') {
  if (cleanText(row['NPI Deactivation Date'])) return null

  const taxonomy = chooseCsvTaxonomy(row, fallbackSpecialty)
  if (!taxonomy?.code || !taxonomyByCode.has(taxonomy.code)) return null

  const firstName = cleanText(row['Provider First Name'])
  const lastName = cleanText(row['Provider Last Name (Legal Name)'])
  const organizationName = cleanText(row['Provider Organization Name (Legal Business Name)'])
  const addressLine1 = cleanText(row['Provider First Line Business Practice Location Address'])
  const addressLine2 = cleanText(row['Provider Second Line Business Practice Location Address'])
  const phone = cleanText(row['Provider Business Practice Location Address Telephone Number'])
  const authorizedPhone = cleanText(row['Authorized Official Telephone Number'])
  const entityType = cleanText(row['Entity Type Code'])
  const lastUpdated = cleanText(row['Last Update Date'])
  const enumerationDate = cleanText(row['Provider Enumeration Date'])

  return {
    npi_number: cleanText(row.NPI),
    taxonomy_code: taxonomy.code,
    first_name: firstName,
    last_name: lastName,
    credentials: cleanText(row['Provider Credential Text']),
    specialty: taxonomy.specialty,
    practice_name: organizationName || buildProviderName(firstName, lastName),
    phone: normalizePhone(phone || authorizedPhone),
    address: cleanText([addressLine1, addressLine2].filter(Boolean).join(' ')),
    city: cleanText(row['Provider Business Practice Location Address City Name']),
    state: cleanText(row['Provider Business Practice Location Address State Name'])?.toUpperCase() || null,
    zip_code: cleanText(String(row['Provider Business Practice Location Address Postal Code'] || '').slice(0, 5)),
    lead_source: 'NPI Registry',
    source_confidence: 90,
    contact_status: 'New',
    data_sources: {
      nppes: {
        entity_type: entityType,
        enumeration_date: enumerationDate,
        last_updated: lastUpdated,
      },
    },
  }
}

function chooseTaxonomy(taxonomies, fallbackSpecialty) {
  const primary = taxonomies.find((item) => item.primary === true) || taxonomies[0]
  const mapped = taxonomies.map((item) => taxonomyByCode.get(item.code)).find(Boolean)
  const fallback = taxonomyQueries.find((item) => item.specialty === fallbackSpecialty)

  return {
    code: primary?.code || fallback?.codes?.[0] || null,
    specialty: mapped?.specialty || fallbackSpecialty,
  }
}

function chooseCsvTaxonomy(row, fallbackSpecialty) {
  const fallback = taxonomyQueries.find((item) => item.specialty === fallbackSpecialty)
  const taxonomies = []

  for (let index = 1; index <= nppesTaxonomySlotCount; index += 1) {
    const code = cleanText(row[`Healthcare Provider Taxonomy Code_${index}`])
    if (!code) continue
    const mapped = taxonomyByCode.get(code)
    taxonomies.push({
      code,
      specialty: mapped?.specialty || fallback?.specialty || fallbackSpecialty,
      primary: cleanText(row[`Healthcare Provider Primary Taxonomy Switch_${index}`]) === 'Y',
      mapped,
    })
  }

  const primaryMapped = taxonomies.find((item) => item.primary && item.mapped)
  const firstMapped = taxonomies.find((item) => item.mapped)
  const selected = primaryMapped || firstMapped

  if (!selected) return null

  return {
    code: selected.code,
    specialty: selected.mapped?.specialty || selected.specialty,
  }
}

function choosePracticeAddress(addresses) {
  return (
    addresses.find((address) => address.address_purpose === 'LOCATION') ||
    addresses.find((address) => address.address_type === 'DOM') ||
    addresses[0] ||
    {}
  )
}

function cleanText(value) {
  const next = String(value || '').trim()
  return next || null
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return digits
}

function buildProviderName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(' ') || null
}
