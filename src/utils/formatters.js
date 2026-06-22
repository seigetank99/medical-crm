export function formatDoctorName(dentist) {
  return [dentist.first_name, dentist.last_name].filter(Boolean).join(' ') || 'Unnamed dentist'
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function normalizeWebsite(url) {
  if (!url) return ''
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
}

export function cleanDentistPayload(payload) {
  const next = { ...payload }

  ;['graduation_year', 'years_in_practice', 'number_of_locations', 'google_review_count'].forEach((field) => {
    if (next[field] === '') next[field] = null
    else if (next[field] != null) next[field] = Number(next[field])
  })

  if (next.google_rating === '') next.google_rating = null
  if (next.next_follow_up_date === '') next.next_follow_up_date = null

  Object.keys(next).forEach((key) => {
    if (next[key] === '') next[key] = null
  })

  return next
}
