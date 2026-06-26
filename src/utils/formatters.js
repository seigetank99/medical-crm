import { contactStatusOptions, specialtyOptions } from './constants.js'

const specialtyAliases = {
  'general dentists': 'General Dentist',
  'general dentist': 'General Dentist',
  'dental public health': 'Dental Public Health',
  'dental anesthesiology': 'Dental Anesthesiology',
  'dentist anesthesiologist': 'Dental Anesthesiology',
  'dentist anesthesiologists': 'Dental Anesthesiology',
  orthodontists: 'Orthodontist',
  orthodontist: 'Orthodontist',
  'oral surgeons': 'Oral Surgeon',
  'oral surgeon': 'Oral Surgeon',
  'oral and maxillofacial pathology': 'Oral and Maxillofacial Pathology',
  'oral & maxillofacial pathology': 'Oral and Maxillofacial Pathology',
  'oral and maxillofacial radiology': 'Oral and Maxillofacial Radiology',
  'oral & maxillofacial radiology': 'Oral and Maxillofacial Radiology',
  'pediatric dentists': 'Pediatric Dentist',
  'pediatric dentist': 'Pediatric Dentist',
  periodontists: 'Periodontist',
  periodontist: 'Periodontist',
  prosthodontics: 'Prosthodontist',
  prosthodontists: 'Prosthodontist',
  prosthodontist: 'Prosthodontist',
  endodontists: 'Endodontist',
  endodontist: 'Endodontist',
}

const statusAliases = {
  'not contacted': 'New',
  new: 'New',
  attempted: 'Attempted',
  connected: 'Contacted',
  contacted: 'Contacted',
  'meeting scheduled': 'Active Prospect',
  'active prospect': 'Active Prospect',
  'proposal sent': 'Proposal Sent',
  client: 'Client',
  nurture: 'Nurture',
  unqualified: 'Unqualified',
  lost: 'Lost',
}

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

export function normalizeSpecialty(value) {
  if (!value) return null
  const normalized = specialtyAliases[String(value).trim().toLowerCase()]
  return normalized || (specialtyOptions.includes(value) ? value : String(value).trim())
}

export function normalizeContactStatus(value) {
  if (!value) return 'New'
  const normalized = statusAliases[String(value).trim().toLowerCase()]
  return normalized || (contactStatusOptions.includes(value) ? value : 'New')
}

export function normalizeState(value) {
  return value ? String(value).trim().toUpperCase() : null
}

export function calculateLeadScore(dentist) {
  let score = 0
  const ownerStatus = dentist.owner_status
  const specialty = normalizeSpecialty(dentist.specialty)
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

export function cleanDentistPayload(payload) {
  const next = { ...payload }

  ;['graduation_year', 'years_in_practice', 'number_of_locations', 'google_review_count'].forEach((field) => {
    if (next[field] === '') next[field] = null
    else if (next[field] != null) next[field] = Number(next[field])
  })

  if (next.google_rating === '') next.google_rating = null
  if (next.next_follow_up_date === '') next.next_follow_up_date = null
  if (next.last_contact_date === '') next.last_contact_date = null
  if (next.state) next.state = normalizeState(next.state)
  if (next.specialty) next.specialty = normalizeSpecialty(next.specialty)
  if (next.contact_status) next.contact_status = normalizeContactStatus(next.contact_status)
  if (!next.contact_status) next.contact_status = 'New'
  if (!next.follow_up_priority) next.follow_up_priority = 'Medium'

  Object.keys(next).forEach((key) => {
    if (typeof next[key] === 'string') next[key] = next[key].trim()
    if (next[key] === '') next[key] = null
  })

  next.lead_score = calculateLeadScore(next)

  return next
}
