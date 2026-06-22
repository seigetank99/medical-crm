export const supportedStates = ['NY', 'NJ', 'CT']

export const taxonomyQueries = [
  { specialty: 'General Dentist', query: 'General Practice', codes: ['1223G0001X', '122300000X'] },
  { specialty: 'Orthodontist', query: 'Orthodontics and Dentofacial Orthopedics', codes: ['1223X0400X'] },
  { specialty: 'Oral Surgeon', query: 'Oral and Maxillofacial Surgery', codes: ['1223S0112X'] },
  { specialty: 'Pediatric Dentist', query: 'Pediatric Dentistry', codes: ['1223P0221X'] },
  { specialty: 'Periodontist', query: 'Periodontics', codes: ['1223P0300X'] },
  { specialty: 'Endodontist', query: 'Endodontics', codes: ['1223E0200X'] },
]

const taxonomyByCode = new Map(taxonomyQueries.flatMap((item) => item.codes.map((code) => [code, item])))

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

function chooseTaxonomy(taxonomies, fallbackSpecialty) {
  const primary = taxonomies.find((item) => item.primary === true) || taxonomies[0]
  const mapped = taxonomies.map((item) => taxonomyByCode.get(item.code)).find(Boolean)
  const fallback = taxonomyQueries.find((item) => item.specialty === fallbackSpecialty)

  return {
    code: primary?.code || fallback?.codes?.[0] || null,
    specialty: mapped?.specialty || fallbackSpecialty,
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
