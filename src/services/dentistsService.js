import { supabase } from './supabaseClient.js'

const baseColumns = `
  id,
  first_name,
  last_name,
  credentials,
  specialty,
  npi_number,
  taxonomy_code,
  graduation_year,
  estimated_age_range,
  years_in_practice,
  practice_name,
  website,
  phone,
  email,
  address,
  city,
  state,
  zip_code,
  owner_status,
  number_of_locations,
  solo_practice,
  multi_location,
  google_rating,
  google_review_count,
  lead_score,
  source_confidence,
  contact_status,
  lead_source,
  notes,
  next_follow_up_date,
  last_contact_date,
  follow_up_priority,
  tags,
  import_source,
  import_batch_id,
  osm_id,
  google_place_id,
  practice_domain,
  public_email,
  owner_confidence,
  education_school,
  graduation_year_source,
  data_sources,
  data_enriched_at,
  enrichment_status,
  enrichment_error,
  created_at,
  updated_at
`

const todayIso = () => new Date().toISOString().slice(0, 10)

function weekEndIso() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

function applyFilters(query, filters, search) {
  if (search) {
    const term = search.trim()
    query = query.or(
      [
        `first_name.ilike.%${term}%`,
        `last_name.ilike.%${term}%`,
        `practice_name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `city.ilike.%${term}%`,
        `state.ilike.%${term}%`,
        `website.ilike.%${term}%`,
        `npi_number.ilike.%${term}%`,
      ].join(','),
    )
  }

  if (filters.state) query = query.eq('state', filters.state)
  if (filters.specialty) query = query.eq('specialty', filters.specialty)
  if (filters.contactStatus) query = query.eq('contact_status', filters.contactStatus)
  if (filters.ownerStatus) query = query.eq('owner_status', filters.ownerStatus)
  if (filters.ageRange) query = query.eq('estimated_age_range', filters.ageRange)
  if (filters.graduationYearFrom) query = query.gte('graduation_year', Number(filters.graduationYearFrom))
  if (filters.graduationYearTo) query = query.lte('graduation_year', Number(filters.graduationYearTo))
  if (filters.leadScoreMin) query = query.gte('lead_score', Number(filters.leadScoreMin))
  if (filters.leadScoreMax) query = query.lte('lead_score', Number(filters.leadScoreMax))
  if (filters.followUpPriority) query = query.eq('follow_up_priority', filters.followUpPriority)
  if (filters.importSource) query = query.ilike('import_source', `%${filters.importSource.trim()}%`)
  if (filters.importBatchId) query = query.eq('import_batch_id', filters.importBatchId.trim())
  if (filters.tags) query = query.ilike('tags', `%${filters.tags.trim()}%`)

  if (filters.followUpPreset === 'today') {
    query = query.eq('next_follow_up_date', todayIso())
  } else if (filters.followUpPreset === 'overdue') {
    query = query.lt('next_follow_up_date', todayIso())
  } else if (filters.followUpPreset === 'this-week') {
    query = query.gte('next_follow_up_date', todayIso()).lte('next_follow_up_date', weekEndIso())
  } else {
    if (filters.followUpFrom) query = query.gte('next_follow_up_date', filters.followUpFrom)
    if (filters.followUpTo) query = query.lte('next_follow_up_date', filters.followUpTo)
  }

  if (filters.retirementCandidates) {
    query = query.or('graduation_year.lt.1995,estimated_age_range.ilike.%60%,tags.ilike.%retirement_candidate%')
  }

  return query
}

function mapSortColumn(column) {
  if (column === 'doctor_name') return 'last_name'
  return column
}

export async function getDentists({ page, pageSize, search, filters, sort, exportAll = false }) {
  try {
    let query = supabase.from('dentists').select(baseColumns, { count: 'exact' })
    query = applyFilters(query, filters, search)
    query = query.order(mapSortColumn(sort.column), { ascending: sort.direction === 'asc', nullsFirst: false })

    if (!exportAll) {
      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)
    } else {
      query = query.range(0, 999)
    }

    const { data, error, count } = await query
    if (error) throw error

    if (!exportAll) return { data: data || [], count: count || 0, error: '' }

    let rows = data || []
    let offset = rows.length
    while (count && offset < count) {
      let nextQuery = supabase.from('dentists').select(baseColumns, { count: 'exact' })
      nextQuery = applyFilters(nextQuery, filters, search)
      nextQuery = nextQuery.order(mapSortColumn(sort.column), { ascending: sort.direction === 'asc', nullsFirst: false })
      nextQuery = nextQuery.range(offset, offset + 999)
      const { data: nextRows, error: nextError } = await nextQuery
      if (nextError) throw nextError
      rows = rows.concat(nextRows || [])
      offset = rows.length
    }

    return { data: rows, count: count || rows.length, error: '' }
  } catch (error) {
    return { data: [], count: 0, error: error.message || 'Failed to load dentists.' }
  }
}

export async function getDentistById(id) {
  try {
    const { data, error } = await supabase.from('dentists').select(baseColumns).eq('id', id).single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to load dentist.' }
  }
}

export async function updateDentistRecord(id, payload) {
  try {
    const { data, error } = await supabase
      .from('dentists')
      .update(payload)
      .eq('id', id)
      .select(baseColumns)
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to update dentist.' }
  }
}

export async function createDentistRecord(payload) {
  try {
    const { data, error } = await supabase.from('dentists').insert(payload).select(baseColumns).single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create dentist.' }
  }
}

export async function createDentistRecordsBatch(records) {
  try {
    const { data, error } = await supabase.from('dentists').insert(records).select('id')
    if (error) throw error
    return { data: data || [], error: '' }
  } catch (error) {
    return { data: [], error: error.message || 'Failed to import dentists.' }
  }
}

export async function deleteDentistRecord(id) {
  try {
    const { error } = await supabase.from('dentists').delete().eq('id', id)
    if (error) throw error
    return { error: '' }
  } catch (error) {
    return { error: error.message || 'Failed to delete dentist.' }
  }
}

export async function getContactNotes(dentistId) {
  try {
    const { data, error } = await supabase
      .from('contact_notes')
      .select('id, dentist_id, note, contact_method, contact_date, created_at')
      .eq('dentist_id', dentistId)
      .order('contact_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data: data || [], error: '' }
  } catch (error) {
    return { data: [], error: error.message || 'Failed to load contact notes.' }
  }
}

export async function createContactNote(dentistId, payload) {
  try {
    const { data, error } = await supabase
      .from('contact_notes')
      .insert({ dentist_id: dentistId, ...payload })
      .select('id, dentist_id, note, contact_method, contact_date, created_at')
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create contact note.' }
  }
}

export async function deleteContactNote(id) {
  try {
    const { error } = await supabase.from('contact_notes').delete().eq('id', id)
    if (error) throw error
    return { error: '' }
  } catch (error) {
    return { error: error.message || 'Failed to delete contact note.' }
  }
}

export async function getTasks(dentistId) {
  try {
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('id, dentist_id, title, description, due_date, priority, status, created_at, updated_at')
      .eq('dentist_id', dentistId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data: data || [], error: '' }
  } catch (error) {
    return { data: [], error: error.message || 'Failed to load tasks.' }
  }
}

export async function createTask(dentistId, payload) {
  try {
    const { data, error } = await supabase
      .from('crm_tasks')
      .insert({ dentist_id: dentistId, ...payload })
      .select('id, dentist_id, title, description, due_date, priority, status, created_at, updated_at')
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create task.' }
  }
}

export async function updateTask(id, payload) {
  try {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update(payload)
      .eq('id', id)
      .select('id, dentist_id, title, description, due_date, priority, status, created_at, updated_at')
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to update task.' }
  }
}

export async function deleteTask(id) {
  try {
    const { error } = await supabase.from('crm_tasks').delete().eq('id', id)
    if (error) throw error
    return { error: '' }
  } catch (error) {
    return { error: error.message || 'Failed to delete task.' }
  }
}

export async function createImportBatch(payload) {
  try {
    const { data, error } = await supabase.from('import_batches').insert(payload).select('*').single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create import batch.' }
  }
}

export async function updateImportBatch(batchId, payload) {
  try {
    const { data, error } = await supabase
      .from('import_batches')
      .update(payload)
      .eq('batch_id', batchId)
      .select('*')
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to update import batch.' }
  }
}

export async function getRecentImportBatches(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('id, batch_id, file_name, import_source, total_rows, successful_rows, failed_rows, duplicate_rows, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return { data: data || [], error: '' }
  } catch (error) {
    return { data: [], error: error.message || 'Failed to load import batches.' }
  }
}

export async function getPipelineStatus() {
  try {
    const today = todayIso()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoIso = weekAgo.toISOString()

    const [
      lastImport,
      importedToday,
      pendingJobs,
      failedJobs,
      enrichedToday,
      highScoreThisWeek,
      queueRows,
    ] = await Promise.all([
      supabase
        .from('import_batches')
        .select('id, batch_id, import_source, successful_rows, failed_rows, duplicate_rows, created_at')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('dentists')
        .select('id', { count: 'exact', head: true })
        .eq('import_source', 'NPI Registry')
        .gte('created_at', today),
      supabase.from('enrichment_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('enrichment_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('dentists').select('id', { count: 'exact', head: true }).gte('data_enriched_at', today),
      supabase.from('dentists').select('id', { count: 'exact', head: true }).gte('lead_score', 25).gte('created_at', weekAgoIso),
      supabase
        .from('enrichment_queue')
        .select('id, dentist_id, job_type, status, attempts, last_error, scheduled_for, updated_at')
        .order('scheduled_for', { ascending: true })
        .limit(25),
    ])

    const resultError = [lastImport, importedToday, pendingJobs, failedJobs, enrichedToday, highScoreThisWeek, queueRows].find(
      (result) => result.error,
    )?.error
    if (resultError) throw resultError

    return {
      data: {
        lastImport: lastImport.data?.[0] || null,
        importedToday: importedToday.count || 0,
        pendingJobs: pendingJobs.count || 0,
        failedJobs: failedJobs.count || 0,
        enrichedToday: enrichedToday.count || 0,
        highScoreThisWeek: highScoreThisWeek.count || 0,
        queueRows: queueRows.data || [],
      },
      error: '',
    }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to load pipeline status.' }
  }
}

export async function runNpiImport(options = {}) {
  return invokePipelineFunction('import-npi-dentists', options)
}

export async function processEnrichmentQueue(retryFailed = false) {
  return invokePipelineFunction('process-enrichment-queue', { retryFailed })
}

export async function enrichSelectedDentist(dentistId, includeGooglePlaces = false, includeWebsite = false) {
  const osmResult = await invokePipelineFunction('enrich-osm-dentists', { dentist_id: dentistId })
  if (osmResult.error) return osmResult

  const data = { osm: osmResult.data }

  if (includeGooglePlaces) {
    const googleResult = await invokePipelineFunction('enrich-google-places', { dentist_id: dentistId })
    if (googleResult.error) return googleResult
    data.google = googleResult.data
  }

  if (includeWebsite) {
    const websiteResult = await invokePipelineFunction('enrich-practice-website', { dentist_id: dentistId })
    if (websiteResult.error) return websiteResult
    data.website = websiteResult.data
  }

  return {
    data,
    error: '',
  }
}

async function invokePipelineFunction(functionName, body = {}) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body })
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || `Failed to invoke ${functionName}.` }
  }
}

export async function findDuplicateDentists({ npiNumbers, emails, phones, names, practices }) {
  try {
    const duplicateNpis = new Set()
    const duplicateEmails = new Set()
    const duplicatePhones = new Set()
    const duplicateNames = new Set()
    const duplicatePractices = new Set()

    if (npiNumbers.length) {
      const { data, error } = await supabase.from('dentists').select('npi_number').in('npi_number', npiNumbers)
      if (error) throw error
      data.forEach((row) => row.npi_number && duplicateNpis.add(String(row.npi_number).toLowerCase()))
    }

    if (emails.length) {
      const { data, error } = await supabase.from('dentists').select('email').in('email', emails)
      if (error) throw error
      data.forEach((row) => row.email && duplicateEmails.add(String(row.email).toLowerCase()))
    }

    if (phones.length) {
      const { data, error } = await supabase.from('dentists').select('phone').in('phone', phones)
      if (error) throw error
      data.forEach((row) => row.phone && duplicatePhones.add(String(row.phone).toLowerCase()))
    }

    if (names.length) {
      const cities = [...new Set(names.map((item) => item.city).filter(Boolean))]
      const { data, error } = await supabase
        .from('dentists')
        .select('first_name, last_name, city')
        .in('city', cities.length ? cities : ['__none__'])
      if (error) throw error
      data.forEach((row) => duplicateNames.add(`${row.first_name || ''}|${row.last_name || ''}|${row.city || ''}`.toLowerCase()))
    }

    if (practices.length) {
      const states = [...new Set(practices.map((item) => item.state).filter(Boolean))]
      const { data, error } = await supabase
        .from('dentists')
        .select('practice_name, city, state')
        .in('state', states.length ? states : ['__none__'])
      if (error) throw error
      data.forEach((row) => duplicatePractices.add(`${row.practice_name || ''}|${row.city || ''}|${row.state || ''}`.toLowerCase()))
    }

    return { data: { duplicateNpis, duplicateEmails, duplicatePhones, duplicateNames, duplicatePractices }, error: '' }
  } catch (error) {
    return {
      data: {
        duplicateNpis: new Set(),
        duplicateEmails: new Set(),
        duplicatePhones: new Set(),
        duplicateNames: new Set(),
        duplicatePractices: new Set(),
      },
      error: error.message || 'Failed to check duplicates.',
    }
  }
}

async function countByFilter(table, configure = (query) => query) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  query = configure(query)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export async function getDashboardMetrics() {
  try {
    const today = todayIso()
    const weekEnd = weekEndIso()

    const [
      totalLeads,
      newLeads,
      attemptedLeads,
      contactedLeads,
      activeProspects,
      proposalSent,
      clients,
      nurtureLeads,
      unqualifiedLeads,
      lostLeads,
      overdueFollowUps,
      followUpsDueToday,
      followUpsThisWeek,
      highScoreLeads,
      upcomingTasks,
      overdueTasks,
      openTasks,
      missingEmail,
      missingPhone,
      missingWebsite,
      missingFollowUp,
      noLastContact,
      ownerLeads,
      topLeads,
      upcomingFollowUps,
      overdueFollowUpRows,
      recentContactNotes,
      recentImportBatches,
      upcomingTaskRows,
    ] = await Promise.all([
      countByFilter('dentists'),
      countByFilter('dentists', (query) => query.eq('contact_status', 'New')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Attempted')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Contacted')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Active Prospect')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Proposal Sent')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Client')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Nurture')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Unqualified')),
      countByFilter('dentists', (query) => query.eq('contact_status', 'Lost')),
      countByFilter('dentists', (query) => query.not('next_follow_up_date', 'is', null).lt('next_follow_up_date', today)),
      countByFilter('dentists', (query) => query.eq('next_follow_up_date', today)),
      countByFilter('dentists', (query) => query.gte('next_follow_up_date', today).lte('next_follow_up_date', weekEnd)),
      countByFilter('dentists', (query) => query.gte('lead_score', 25)),
      countByFilter('crm_tasks', (query) => query.neq('status', 'Completed').gte('due_date', today).lte('due_date', weekEnd)),
      countByFilter('crm_tasks', (query) => query.neq('status', 'Completed').lt('due_date', today)),
      countByFilter('crm_tasks', (query) => query.neq('status', 'Completed')),
      countByFilter('dentists', (query) => query.is('email', null)),
      countByFilter('dentists', (query) => query.is('phone', null)),
      countByFilter('dentists', (query) => query.is('website', null)),
      countByFilter('dentists', (query) => query.is('next_follow_up_date', null)),
      countByFilter('dentists', (query) => query.is('last_contact_date', null)),
      countByFilter('dentists', (query) => query.in('owner_status', ['Owner', 'Partner'])),
      supabase.from('dentists').select(baseColumns).order('lead_score', { ascending: false }).limit(10),
      supabase.from('dentists').select(baseColumns).gte('next_follow_up_date', today).order('next_follow_up_date').limit(10),
      supabase.from('dentists').select(baseColumns).lt('next_follow_up_date', today).order('next_follow_up_date').limit(10),
      supabase
        .from('contact_notes')
        .select('id, dentist_id, note, contact_method, contact_date, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('import_batches')
        .select('id, batch_id, file_name, import_source, total_rows, successful_rows, failed_rows, duplicate_rows, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('crm_tasks')
        .select('id, dentist_id, title, description, due_date, priority, status, created_at')
        .neq('status', 'Completed')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
    ])

    const resultSets = [topLeads, upcomingFollowUps, overdueFollowUpRows, recentContactNotes, recentImportBatches, upcomingTaskRows]
    const resultError = resultSets.find((result) => result.error)?.error
    if (resultError) throw resultError

    return {
      data: {
        totalLeads,
        newLeads,
        attemptedLeads,
        contactedLeads,
        activeProspects,
        proposalSent,
        clients,
        nurtureLeads,
        unqualifiedLeads,
        lostLeads,
        overdueFollowUps,
        followUpsDueToday,
        followUpsThisWeek,
        highScoreLeads,
        upcomingTasks,
        overdueTasks,
        openTasks,
        missingEmail,
        missingPhone,
        missingWebsite,
        missingFollowUp,
        noLastContact,
        ownerLeads,
        topLeads: topLeads.data || [],
        upcomingFollowUps: upcomingFollowUps.data || [],
        overdueFollowUpRows: overdueFollowUpRows.data || [],
        recentContactNotes: recentContactNotes.data || [],
        recentImportBatches: recentImportBatches.data || [],
        upcomingTaskRows: upcomingTaskRows.data || [],
      },
      error: '',
    }
  } catch (error) {
    return { data: {}, error: error.message || 'Failed to load dashboard metrics.' }
  }
}
