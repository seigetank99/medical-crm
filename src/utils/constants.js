export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/leads', label: 'Leads', icon: 'leads' },
  { path: '/import', label: 'Import CSV', icon: 'import' },
]

export const specialtyOptions = [
  'General Dentists',
  'Orthodontists',
  'Oral Surgeons',
  'Pediatric Dentists',
  'Periodontists',
  'Endodontists',
]

export const stateOptions = ['NY', 'NJ', 'CT']

export const contactStatusOptions = [
  'New',
  'Attempted',
  'Contacted',
  'Active Prospect',
  'Proposal Sent',
  'Client',
  'Nurture',
  'Unqualified',
]

export const ownerStatusOptions = ['Owner', 'Associate', 'Partner', 'Unknown']

export const ageRangeOptions = ['30-39', '40-49', '50-59', '60-69', '70+']

export const contactMethodOptions = ['Phone', 'Email', 'LinkedIn', 'Text', 'In Person']

export const savedViews = [
  {
    id: 'ny-owners',
    label: 'NY Owners',
    description: 'Owner-led practices in New York',
    filters: { state: 'NY', ownerStatus: 'Owner' },
  },
  {
    id: 'active-prospects',
    label: 'Active Prospects',
    description: 'Mid-funnel opportunities',
    filters: { contactStatus: 'Active Prospect' },
  },
  {
    id: 'follow-ups',
    label: 'Follow Ups',
    description: 'Upcoming touches in the next 14 days',
    filters: { contactStatus: 'Contacted' },
  },
]

export const defaultFilters = {
  state: '',
  specialty: '',
  contactStatus: '',
  ownerStatus: '',
  ageRange: '',
  graduationYearFrom: '',
  graduationYearTo: '',
  followUpFrom: '',
  followUpTo: '',
  tags: '',
}

export const blankDentistForm = {
  first_name: '',
  last_name: '',
  credentials: '',
  specialty: '',
  npi_number: '',
  graduation_year: '',
  estimated_age_range: '',
  years_in_practice: '',
  practice_name: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  owner_status: '',
  number_of_locations: '',
  solo_practice: false,
  multi_location: false,
  google_rating: '',
  google_review_count: '',
  contact_status: 'New',
  lead_source: '',
  notes: '',
  next_follow_up_date: '',
  tags: '',
  import_source: '',
  import_batch_id: '',
}

export const defaultNoteDraft = {
  note: '',
  contact_method: 'Phone',
  contact_date: new Date().toISOString().slice(0, 10),
}

export function createDefaultNoteDraft() {
  return {
    note: '',
    contact_method: 'Phone',
    contact_date: new Date().toISOString().slice(0, 10),
  }
}
