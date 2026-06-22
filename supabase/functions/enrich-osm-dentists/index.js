import { corsHeaders, createServiceClient, errorResponse, jsonResponse, readJson, requireAuthorizedRequest } from '../_shared/http.js'
import { enrichOsmDentist } from '../_shared/enrichment.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const supabase = createServiceClient()
  const auth = await requireAuthorizedRequest(req, supabase)
  if (auth.error) return errorResponse(auth.error, auth.status)

  const body = await readJson(req)
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 50)
  const dentistIds = body.dentist_id ? [body.dentist_id] : await selectDentistsForOsm(supabase, limit)
  const summary = { processed: 0, updated: 0, failed: 0, errors: [] }

  for (const dentistId of dentistIds) {
    try {
      await supabase.from('dentists').update({ enrichment_status: 'processing', enrichment_error: null }).eq('id', dentistId)
      const result = await enrichOsmDentist(supabase, dentistId)
      summary.processed += 1
      if (result.updated) summary.updated += 1
    } catch (error) {
      summary.failed += 1
      summary.errors.push(`${dentistId}: ${error.message}`)
      await supabase
        .from('dentists')
        .update({ enrichment_status: 'failed', enrichment_error: error.message, data_enriched_at: new Date().toISOString() })
        .eq('id', dentistId)
    }
  }

  return jsonResponse(summary)
})

async function selectDentistsForOsm(supabase, limit) {
  const { data, error } = await supabase
    .from('dentists')
    .select('id')
    .or('website.is.null,practice_name.is.null')
    .order('lead_score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((row) => row.id)
}
