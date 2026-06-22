export function calculateLeadScore(dentist) {
  let score = 0
  const ownerStatus = dentist.owner_status
  const specialty = dentist.specialty
  const graduationYear = Number(dentist.graduation_year)
  const reviewCount = Number(dentist.google_review_count)
  const rating = Number(dentist.google_rating)

  if (ownerStatus === 'Owner' || ownerStatus === 'Partner') score += 15
  if (dentist.multi_location === true) score += 10
  if (specialty === 'Orthodontist' || specialty === 'Oral Surgeon') score += 10
  if (graduationYear && graduationYear < 1995) score += 8
  if (reviewCount >= 100) score += 5
  if (rating >= 4.5) score += 3
  if (ownerStatus === 'Associate') score -= 10

  return Math.max(score, 0)
}

export async function scoreDentist(supabase, dentistId) {
  const { data: dentist, error: fetchError } = await supabase.from('dentists').select('*').eq('id', dentistId).single()
  if (fetchError) throw fetchError

  const leadScore = calculateLeadScore(dentist)
  const { data, error } = await supabase
    .from('dentists')
    .update({ lead_score: leadScore })
    .eq('id', dentistId)
    .select('id, lead_score')
    .single()
  if (error) throw error

  return data
}
