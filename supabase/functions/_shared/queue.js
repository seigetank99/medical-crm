export async function enqueueJob(supabase, dentistId, jobType, scheduledFor = new Date().toISOString()) {
  const { data: existing, error: existingError } = await supabase
    .from('enrichment_queue')
    .select('id')
    .eq('dentist_id', dentistId)
    .eq('job_type', jobType)
    .in('status', ['pending', 'processing'])
    .limit(1)

  if (existingError) throw existingError
  if (existing?.length) return { enqueued: false, id: existing[0].id }

  const { data, error } = await supabase
    .from('enrichment_queue')
    .insert({
      dentist_id: dentistId,
      job_type: jobType,
      status: 'pending',
      scheduled_for: scheduledFor,
    })
    .select('id')
    .single()

  if (error) throw error
  return { enqueued: true, id: data.id }
}

export async function enqueuePostImportJobs(supabase, dentist) {
  const jobs = []
  jobs.push(await enqueueJob(supabase, dentist.id, 'lead_scoring'))

  if (!dentist.website || !dentist.practice_name) {
    jobs.push(await enqueueJob(supabase, dentist.id, 'osm_enrichment'))
  }

  const needsGoogle =
    Number(dentist.lead_score || 0) >= 20 &&
    (!dentist.website || dentist.google_rating == null || dentist.google_review_count == null)

  if (needsGoogle) {
    jobs.push(await enqueueJob(supabase, dentist.id, 'google_places_enrichment'))
  }

  if (dentist.website) {
    jobs.push(await enqueueJob(supabase, dentist.id, 'website_enrichment'))
  }

  return jobs
}
