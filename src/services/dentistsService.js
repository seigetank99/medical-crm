import { supabase } from './supabaseClient.js'

const baseColumns = `
  id,
  first_name,
  last_name,
  credentials,
  specialty,
  npi_number,
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
  contact_status,
  lead_source,
  notes,
  next_follow_up_date,
  tags,
  import_source,
  import_batch_id,
  created_at,
  updated_at
`

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
  if (filters.followUpFrom) query = query.gte('next_follow_up_date', filters.followUpFrom)
  if (filters.followUpTo) query = query.lte('next_follow_up_date', filters.followUpTo)
  if (filters.tags) query = query.ilike('tags', `%${filters.tags.trim()}%`)

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
      const to = from + pageSize - 1
      query = query.range(from, to)
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
      .update({ ...payload, updated_at: new Date().toISOString() })
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
    const { data, error } = await supabase
      .from('dentists')
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select(baseColumns)
      .single()
    if (error) throw error
    return { data, error: '' }
  } catch (error) {
    return { data: null, error: error.message || 'Failed to create dentist.' }
  }
}

export async function createDentistRecordsBatch(records) {
  try {
    const timestamp = new Date().toISOString()
    const payload = records.map((record) => ({ ...record, updated_at: timestamp }))
    const { data, error } = await supabase.from('dentists').insert(payload).select('id')
    if (error) throw error
    return { data: data || [], error: '' }
  } catch (error) {
    return { data: [], error: error.message || 'Failed to import dentists.' }
  }
}

export async function findDuplicateDentists({ npiNumbers, emails }) {
  try {
    const duplicateNpis = new Set()
    const duplicateEmails = new Set()

    if (npiNumbers.length) {
      const { data, error } = await supabase.from('dentists').select('npi_number').in('npi_number', npiNumbers)
      if (error) throw error
      data.forEach((row) => {
        if (row.npi_number) duplicateNpis.add(String(row.npi_number).toLowerCase())
      })
    }

    if (emails.length) {
      const { data, error } = await supabase.from('dentists').select('email').in('email', emails)
      if (error) throw error
      data.forEach((row) => {
        if (row.email) duplicateEmails.add(String(row.email).toLowerCase())
      })
    }

    return { data: { duplicateNpis, duplicateEmails }, error: '' }
  } catch (error) {
    return {
      data: { duplicateNpis: new Set(), duplicateEmails: new Set() },
      error: error.message || 'Failed to check duplicates.',
    }
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

async function countByFilter(builder) {
  const { count, error } = await builder.select('id', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

export async function getDashboardMetrics() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const followUpLimit = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [
      totalDentists,
      totalOrthodontists,
      totalOralSurgeons,
      totalPediatricDentists,
      totalPeriodontists,
      totalEndodontists,
      contactedLeads,
      activeProspects,
      clients,
      upcomingFollowUps,
    ] = await Promise.all([
      countByFilter(supabase.from('dentists')),
      countByFilter(supabase.from('dentists').eq('specialty', 'Orthodontists')),
      countByFilter(supabase.from('dentists').eq('specialty', 'Oral Surgeons')),
      countByFilter(supabase.from('dentists').eq('specialty', 'Pediatric Dentists')),
      countByFilter(supabase.from('dentists').eq('specialty', 'Periodontists')),
      countByFilter(supabase.from('dentists').eq('specialty', 'Endodontists')),
      countByFilter(supabase.from('dentists').not('contact_status', 'is', null).neq('contact_status', 'New')),
      countByFilter(supabase.from('dentists').eq('contact_status', 'Active Prospect')),
      countByFilter(supabase.from('dentists').eq('contact_status', 'Client')),
      countByFilter(
        supabase
          .from('dentists')
          .not('next_follow_up_date', 'is', null)
          .gte('next_follow_up_date', today)
          .lte('next_follow_up_date', followUpLimit),
      ),
    ])

    return {
      data: {
        totalDentists,
        totalOrthodontists,
        totalOralSurgeons,
        totalPediatricDentists,
        totalPeriodontists,
        totalEndodontists,
        contactedLeads,
        activeProspects,
        clients,
        upcomingFollowUps,
      },
      error: '',
    }
  } catch (error) {
    return { data: {}, error: error.message || 'Failed to load dashboard metrics.' }
  }
}
