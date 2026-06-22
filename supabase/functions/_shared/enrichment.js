import { calculateLeadScore } from './scoring.js'

export async function enrichOsmDentist(supabase, dentistId) {
  const { data: dentist, error: fetchError } = await supabase.from('dentists').select('*').eq('id', dentistId).single()
  if (fetchError) throw fetchError

  const query = buildOverpassQuery(dentist)
  if (!query) throw new Error('Not enough practice, address, city, or state data for OSM matching.')

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'OmniHealth Medical CRM enrichment',
    },
    body: new URLSearchParams({ data: query }),
  })

  if (!response.ok) throw new Error(`Overpass request failed with ${response.status}.`)
  const payload = await response.json()
  const match = chooseOsmMatch(dentist, payload.elements || [])
  if (!match || match.confidence < 70) {
    await supabase
      .from('dentists')
      .update({
        enrichment_status: 'completed',
        enrichment_error: 'No high-confidence OSM match found.',
        data_enriched_at: new Date().toISOString(),
      })
      .eq('id', dentist.id)
    return { updated: false, confidence: match?.confidence || 0 }
  }

  const tags = match.element.tags || {}
  const update = {
    osm_id: `${match.element.type}/${match.element.id}`,
    source_confidence: Math.max(Number(dentist.source_confidence || 0), match.confidence),
    enrichment_status: 'completed',
    enrichment_error: null,
    data_enriched_at: new Date().toISOString(),
  }

  if (!dentist.website && tags.website) update.website = tags.website
  if ((!dentist.phone || match.confidence >= 85) && tags.phone) update.phone = tags.phone
  if ((!dentist.practice_name || match.confidence >= 85) && tags.name) update.practice_name = tags.name
  if ((!dentist.address || match.confidence >= 85) && tags['addr:housenumber'] && tags['addr:street']) {
    update.address = `${tags['addr:housenumber']} ${tags['addr:street']}`
  }
  if ((!dentist.city || match.confidence >= 85) && tags['addr:city']) update.city = tags['addr:city']
  if ((!dentist.zip_code || match.confidence >= 85) && tags['addr:postcode']) update.zip_code = tags['addr:postcode']

  const { error } = await supabase.from('dentists').update(update).eq('id', dentist.id)
  if (error) throw error

  return { updated: true, confidence: match.confidence }
}

export async function enrichGoogleDentist(supabase, dentistId) {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured.')

  const { data: dentist, error: fetchError } = await supabase.from('dentists').select('*').eq('id', dentistId).single()
  if (fetchError) throw fetchError
  if (Number(dentist.lead_score || 0) < 20) throw new Error('Google Places enrichment is limited to lead_score >= 20.')

  const textQuery = buildGoogleQuery(dentist)
  if (!textQuery) throw new Error('Not enough practice, doctor, city, or state data for Google matching.')

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery, maxResultCount: 5 }),
  })

  if (!response.ok) throw new Error(`Google Places request failed with ${response.status}.`)
  const payload = await response.json()
  const match = chooseGoogleMatch(dentist, payload.places || [])
  if (!match || match.confidence < 70) {
    await supabase
      .from('dentists')
      .update({
        enrichment_status: 'completed',
        enrichment_error: 'No high-confidence Google Places match found.',
        data_enriched_at: new Date().toISOString(),
      })
      .eq('id', dentist.id)
    return { updated: false, confidence: match?.confidence || 0 }
  }

  const place = match.place
  const update = {
    google_place_id: place.id,
    google_rating: place.rating ?? dentist.google_rating,
    google_review_count: place.userRatingCount ?? dentist.google_review_count,
    source_confidence: Math.max(Number(dentist.source_confidence || 0), match.confidence),
    enrichment_status: 'completed',
    enrichment_error: null,
    data_enriched_at: new Date().toISOString(),
  }

  if (!dentist.website && place.websiteUri) update.website = place.websiteUri
  if ((!dentist.phone || match.confidence >= 85) && place.nationalPhoneNumber) update.phone = place.nationalPhoneNumber
  if ((!dentist.address || match.confidence >= 85) && place.formattedAddress) update.address = place.formattedAddress

  update.lead_score = calculateLeadScore({ ...dentist, ...update })

  const { error } = await supabase.from('dentists').update(update).eq('id', dentist.id)
  if (error) throw error

  return { updated: true, confidence: match.confidence }
}

export async function enrichWebsiteDentist(supabase, dentistId) {
  const { data: dentist, error: fetchError } = await supabase.from('dentists').select('*').eq('id', dentistId).single()
  if (fetchError) throw fetchError
  if (!dentist.website) throw new Error('Dentist does not have a website.')

  const baseUrl = normalizeWebsiteUrl(dentist.website)
  const domain = new URL(baseUrl).hostname.replace(/^www\./, '')
  const pages = await fetchWebsitePages(baseUrl)
  const combinedText = pages.map((page) => page.text).join('\n').slice(0, 60000)
  const extracted = extractWebsiteSignals(combinedText, domain)
  const ownerConfidence = calculateOwnerConfidence(combinedText, dentist)
  const update = {
    practice_domain: domain,
    owner_confidence: Math.max(Number(dentist.owner_confidence || 0), ownerConfidence),
    data_sources: {
      ...(dentist.data_sources || {}),
      website: {
        domain,
        pages: pages.map((page) => page.url),
        enriched_at: new Date().toISOString(),
        signals: extracted.signals,
      },
    },
    enrichment_status: 'completed',
    enrichment_error: null,
    data_enriched_at: new Date().toISOString(),
  }

  if (!dentist.public_email && extracted.email) update.public_email = extracted.email
  if (!dentist.email && extracted.email) update.email = extracted.email
  if (!dentist.education_school && extracted.educationSchool) update.education_school = extracted.educationSchool
  if (!dentist.graduation_year && extracted.graduationYear) {
    update.graduation_year = extracted.graduationYear
    update.graduation_year_source = 'practice_website'
  }
  if (!dentist.multi_location && extracted.multiLocation) update.multi_location = true

  update.lead_score = calculateLeadScore({ ...dentist, ...update })

  const { error } = await supabase.from('dentists').update(update).eq('id', dentist.id)
  if (error) throw error

  return {
    updated: true,
    domain,
    pages: pages.length,
    email: Boolean(extracted.email),
    owner_confidence: update.owner_confidence,
  }
}

function buildOverpassQuery(dentist) {
  const city = dentist.city || ''
  const state = dentist.state || ''
  const name = escapeOverpass(dentist.practice_name || `${dentist.first_name || ''} ${dentist.last_name || ''}`.trim())
  if (!city || !state || !name) return ''

  return `
    [out:json][timeout:25];
    area["name"="${escapeOverpass(city)}"]["boundary"="administrative"]->.searchArea;
    (
      nwr["amenity"="dentist"]["name"~"${name}",i](area.searchArea);
      nwr["healthcare"="dentist"]["name"~"${name}",i](area.searchArea);
    );
    out center tags 20;
  `
}

function chooseOsmMatch(dentist, elements) {
  return elements
    .map((element) => ({ element, confidence: scoreTags(dentist, element.tags || {}) }))
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function chooseGoogleMatch(dentist, places) {
  return places
    .map((place) => ({
      place,
      confidence: scoreTags(dentist, {
        name: place.displayName?.text,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        address: place.formattedAddress,
      }),
    }))
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function scoreTags(dentist, tags) {
  let score = 0
  const targetName = normalize(`${dentist.practice_name || ''} ${dentist.first_name || ''} ${dentist.last_name || ''}`)
  const candidateName = normalize(tags.name || '')
  const targetPhone = digits(dentist.phone)
  const candidatePhone = digits(tags.phone || tags['contact:phone'] || '')
  const targetAddress = normalize(`${dentist.address || ''} ${dentist.city || ''} ${dentist.state || ''}`)
  const candidateAddress = normalize(
    tags.address ||
      `${tags['addr:housenumber'] || ''} ${tags['addr:street'] || ''} ${tags['addr:city'] || ''} ${tags['addr:state'] || ''}`,
  )

  if (candidateName && targetName && (targetName.includes(candidateName) || candidateName.includes(targetName))) score += 45
  if (targetPhone && candidatePhone && targetPhone === candidatePhone) score += 35
  if (candidateAddress && targetAddress && (targetAddress.includes(candidateAddress) || candidateAddress.includes(targetAddress))) score += 25
  if (tags.website) score += 5

  return Math.min(score, 100)
}

function buildGoogleQuery(dentist) {
  return [dentist.practice_name, [dentist.first_name, dentist.last_name].filter(Boolean).join(' '), dentist.city, dentist.state]
    .filter(Boolean)
    .join(' ')
}

async function fetchWebsitePages(baseUrl) {
  const root = await fetchWebsitePage(baseUrl)
  const rootUrl = new URL(baseUrl)
  const links = extractInternalLinks(root.html, rootUrl)
    .filter((url) => /about|team|doctor|dentist|contact|location|practice|meet/i.test(url))
    .slice(0, 4)
  const pages = [root]

  for (const url of links) {
    try {
      pages.push(await fetchWebsitePage(url))
    } catch {
      // Ignore individual page failures; the root page still provides signal.
    }
  }

  return pages
}

async function fetchWebsitePage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OmniHealth Medical CRM website enrichment',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`Website fetch failed with ${response.status}.`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) throw new Error('Website did not return HTML.')
  const html = await response.text()
  return { url: response.url || url, html, text: htmlToText(html) }
}

function extractWebsiteSignals(text, domain) {
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])]
    .map((email) => email.toLowerCase())
    .filter((email) => !/example|domain|sentry|wixpress|wordpress|schema/.test(email))
  const domainEmail = emails.find((email) => email.endsWith(`@${domain}`))
  const educationMatch = text.match(
    /(NYU|Columbia|Tufts|Harvard|Boston University|University of Pennsylvania|Penn|Stony Brook|Rutgers|UCLA|USC|Howard|Temple|University at Buffalo|Buffalo|Nova Southeastern|Case Western|University of Maryland)[^.]{0,80}/i,
  )
  const graduationMatch = text.match(/\b(class of|graduated in|graduated from|received (?:his|her|their)?[^.]{0,40} in)\s+(19\d{2}|20\d{2})\b/i)
  const multiLocation = /locations|additional location|second location|multiple locations|our offices/i.test(text)
  const signals = {
    email_count: emails.length,
    education_found: Boolean(educationMatch),
    graduation_year_found: Boolean(graduationMatch),
    multi_location_found: multiLocation,
  }

  return {
    email: domainEmail || emails[0] || null,
    educationSchool: educationMatch?.[0]?.trim() || null,
    graduationYear: graduationMatch ? Number(graduationMatch[2]) : null,
    multiLocation,
    signals,
  }
}

function calculateOwnerConfidence(text, dentist) {
  const normalizedText = normalize(text)
  const doctorName = normalize(`${dentist.first_name || ''} ${dentist.last_name || ''}`)
  const ownerTerms = ['owner', 'founder', 'founded', 'principal dentist', 'practice owner', 'clinical director']
  let score = 0

  if (doctorName && normalizedText.includes(doctorName)) score += 30
  for (const term of ownerTerms) {
    if (normalizedText.includes(term)) score += 15
  }
  if (/dr\.?\s+[a-z]+/i.test(text)) score += 10

  return Math.min(score, 100)
}

function extractInternalLinks(html, rootUrl) {
  const links = []
  const hrefPattern = /href=["']([^"']+)["']/gi
  let match
  while ((match = hrefPattern.exec(html))) {
    try {
      const url = new URL(match[1], rootUrl)
      if (url.hostname.replace(/^www\./, '') === rootUrl.hostname.replace(/^www\./, '')) {
        url.hash = ''
        links.push(url.toString())
      }
    } catch {
      // Ignore invalid href values.
    }
  }
  return [...new Set(links)]
}

function normalizeWebsiteUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('Missing website URL.')
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeOverpass(value) {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}
