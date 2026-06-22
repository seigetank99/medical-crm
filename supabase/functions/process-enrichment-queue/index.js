import { corsHeaders, createServiceClient, errorResponse, jsonResponse, readJson, requireAuthorizedRequest } from '../_shared/http.js'
import { enrichGoogleDentist, enrichOsmDentist, enrichWebsiteDentist } from '../_shared/enrichment.js'
import { enqueueJob } from '../_shared/queue.js'
import { scoreDentist } from '../_shared/scoring.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const supabase = createServiceClient()
  const auth = await requireAuthorizedRequest(req, supabase)
  if (auth.error) return errorResponse(auth.error, auth.status)

  const body = await readJson(req)
  const limit = Math.min(Math.max(Number(body.limit || 25), 1), 100)
  if (body.retryFailed) await retryFailedJobs(supabase)

  const { data: jobs, error } = await supabase
    .from('enrichment_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)
  if (error) return errorResponse(error.message, 500)

  const summary = { processed: 0, completed: 0, failed: 0, retried: 0, errors: [] }

  for (const job of jobs || []) {
    summary.processed += 1
    const attempts = Number(job.attempts || 0) + 1
    await supabase.from('enrichment_queue').update({ status: 'processing', attempts, last_error: null }).eq('id', job.id)

    try {
      await runJob(supabase, job)
      await supabase.from('enrichment_queue').update({ status: 'completed', last_error: null }).eq('id', job.id)
      summary.completed += 1
    } catch (error) {
      const retry = attempts < 3
      await supabase
        .from('enrichment_queue')
        .update({
          status: retry ? 'pending' : 'failed',
          last_error: error.message,
          scheduled_for: retry ? new Date(Date.now() + attempts * 60 * 60 * 1000).toISOString() : job.scheduled_for,
        })
        .eq('id', job.id)
      summary.failed += retry ? 0 : 1
      summary.retried += retry ? 1 : 0
      summary.errors.push(`${job.id}: ${error.message}`)
    }
  }

  return jsonResponse(summary)
})

async function runJob(supabase, job) {
  if (job.job_type === 'lead_scoring') return scoreDentist(supabase, job.dentist_id)
  if (job.job_type === 'website_enrichment') return enrichWebsiteDentist(supabase, job.dentist_id)
  if (job.job_type === 'osm_enrichment') {
    const result = await enrichOsmDentist(supabase, job.dentist_id)
    await enqueueWebsiteIfPossible(supabase, job.dentist_id)
    return result
  }
  if (job.job_type === 'google_places_enrichment') {
    const result = await enrichGoogleDentist(supabase, job.dentist_id)
    await enqueueWebsiteIfPossible(supabase, job.dentist_id)
    return result
  }
  throw new Error(`Unsupported job_type: ${job.job_type}`)
}

async function enqueueWebsiteIfPossible(supabase, dentistId) {
  const { data, error } = await supabase.from('dentists').select('id, website').eq('id', dentistId).single()
  if (error) throw error
  if (data?.website) await enqueueJob(supabase, dentistId, 'website_enrichment')
}

async function retryFailedJobs(supabase) {
  const { error } = await supabase
    .from('enrichment_queue')
    .update({ status: 'pending', scheduled_for: new Date().toISOString(), last_error: null })
    .eq('status', 'failed')
    .lt('attempts', 3)
  if (error) throw error
}
