import { corsHeaders, createServiceClient, errorResponse, jsonResponse, readJson, requireAuthorizedRequest } from '../_shared/http.js'
import { isSupportedDentalProvider, normalizeNpiProvider, supportedStates, taxonomyQueries } from '../_shared/npi.js'
import { enqueuePostImportJobs } from '../_shared/queue.js'
import { calculateLeadScore } from '../_shared/scoring.js'

const npiEndpoint = 'https://npiregistry.cms.hhs.gov/api/'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const supabase = createServiceClient()
  const auth = await requireAuthorizedRequest(req, supabase)
  if (auth.error) return errorResponse(auth.error, auth.status)

  const body = await readJson(req)
  const states = filterAllowed(body.states, supportedStates, supportedStates)
  const specialties = filterAllowed(
    body.specialties,
    taxonomyQueries.map((item) => item.specialty),
    taxonomyQueries.map((item) => item.specialty),
  )
  const limit = Math.min(Math.max(Number(body.limit || 200), 1), 200)
  const maxPages = Math.min(Math.max(Number(body.maxPages || 1), 1), 10)
  const startPage = Math.min(Math.max(Number(body.startPage || 0), 0), 100000)
  const endPage = startPage + maxPages
  const batchId = `npi_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

  const summary = {
    batch_id: batchId,
    start_page: startPage,
    end_page: endPage - 1,
    next_start_page: endPage,
    has_more: false,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    queued: 0,
    errors: [],
  }

  const { error: batchError } = await supabase.from('import_batches').insert({
    batch_id: batchId,
    file_name: null,
    import_source: 'NPI Registry',
    total_rows: 0,
    successful_rows: 0,
    failed_rows: 0,
    duplicate_rows: 0,
    notes: `NPI import started for ${states.join(', ')} pages ${startPage}-${endPage - 1}.`,
  })
  if (batchError) return errorResponse(batchError.message, 500)

  for (const state of states) {
    for (let page = startPage; page < endPage; page += 1) {
      const skip = page * limit
      const url = new URL(npiEndpoint)
      url.searchParams.set('version', '2.1')
      url.searchParams.set('state', state)
      url.searchParams.set('taxonomy_description', 'Dentist')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('skip', String(skip))

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`NPI Registry returned ${response.status}.`)
        const payload = await response.json()
        const providers = payload.results || []
        summary.fetched += providers.length

        for (const provider of providers) {
          await importProvider(supabase, provider, specialties, batchId, summary)
        }

        if (providers.length === limit) summary.has_more = true
        if (providers.length < limit) break
      } catch (error) {
        summary.failed += 1
        summary.errors.push(`${state} Dentist: ${error.message}`)
      }
    }
  }

  await supabase
    .from('import_batches')
    .update({
      total_rows: summary.fetched,
      successful_rows: summary.inserted + summary.updated,
      failed_rows: summary.failed,
      duplicate_rows: summary.skipped,
      notes: `NPI import completed for pages ${startPage}-${endPage - 1}. Inserted ${summary.inserted}, updated ${summary.updated}, skipped ${summary.skipped}.`,
    })
    .eq('batch_id', batchId)

  if (summary.fetched === 0) {
    summary.next_start_page = startPage
    summary.has_more = false
  }

  return jsonResponse(summary)
})

async function importProvider(supabase, provider, specialties, batchId, summary) {
  if (!isSupportedDentalProvider(provider)) {
    summary.skipped += 1
    return
  }

  const payload = normalizeNpiProvider(provider, 'General Dentist')
  if (!payload.npi_number) {
    summary.skipped += 1
    return
  }

  if (!specialties.includes(payload.specialty)) {
    summary.skipped += 1
    return
  }

  payload.import_source = 'NPI Registry'
  payload.import_batch_id = batchId
  payload.lead_score = calculateLeadScore(payload)

  const { data: existing, error: existingError } = await supabase
    .from('dentists')
    .select('*')
    .eq('npi_number', payload.npi_number)
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError

  let dentist
  if (existing) {
    const updatePayload = compactPayload(payload)
    const { data, error } = await supabase.from('dentists').update(updatePayload).eq('id', existing.id).select('*').single()
    if (error) throw error
    dentist = data
    summary.updated += 1
  } else {
    const { data, error } = await supabase.from('dentists').insert(compactPayload(payload)).select('*').single()
    if (error) throw error
    dentist = data
    summary.inserted += 1
  }

  const jobs = await enqueuePostImportJobs(supabase, dentist)
  summary.queued += jobs.filter((job) => job.enqueued).length
}

function compactPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function filterAllowed(values, allowed, fallback) {
  if (!Array.isArray(values) || !values.length) return fallback
  const selected = values.filter((value) => allowed.includes(value))
  return selected.length ? selected : fallback
}
