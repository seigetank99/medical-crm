export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/leads', label: 'Leads', icon: 'leads' },
  { path: '/database', label: 'Database', icon: 'database' },
  { path: '/import', label: 'Import CSV', icon: 'import' },
]

export const specialtyOptions = [
  'General Dentist',
  'Orthodontist',
  'Oral Surgeon',
  'Pediatric Dentist',
  'Periodontist',
  'Endodontist',
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
  'Lost',
]

export const ownerStatusOptions = ['Owner', 'Associate', 'Partner', 'Unknown']

export const ageRangeOptions = ['30-39', '40-49', '50-59', '60-69', '70+']

export const contactMethodOptions = ['Phone', 'Email', 'LinkedIn', 'Text', 'In Person']

export const followUpPriorityOptions = ['Low', 'Medium', 'High', 'Urgent']

export const taskPriorityOptions = ['Low', 'Medium', 'High', 'Urgent']

export const taskStatusOptions = ['Open', 'In Progress', 'Completed', 'Canceled']

export const pageSizeOptions = [25, 50, 100, 200]

export const savedViews = [
  {
    id: 'all-leads',
    label: 'All Leads',
    description: 'Every CRM lead',
    filters: {},
  },
  {
    id: 'new-leads',
    label: 'New Leads',
    description: 'Fresh records not yet worked',
    filters: { contactStatus: 'New' },
  },
  {
    id: 'follow-up-today',
    label: 'Follow Up Today',
    description: 'Follow-ups due today',
    filters: { followUpPreset: 'today' },
  },
  {
    id: 'overdue-follow-ups',
    label: 'Overdue Follow Ups',
    description: 'Past-due follow-ups',
    filters: { followUpPreset: 'overdue' },
  },
  {
    id: 'high-score-leads',
    label: 'High Score Leads',
    description: 'Lead score 25+',
    filters: { leadScoreMin: '25' },
  },
  {
    id: 'ny-dentists',
    label: 'NY Dentists',
    description: 'New York territory',
    filters: { state: 'NY' },
  },
  {
    id: 'nj-dentists',
    label: 'NJ Dentists',
    description: 'New Jersey territory',
    filters: { state: 'NJ' },
  },
  {
    id: 'ct-dentists',
    label: 'CT Dentists',
    description: 'Connecticut territory',
    filters: { state: 'CT' },
  },
  {
    id: 'orthodontists',
    label: 'Orthodontists',
    description: 'Orthodontic practices',
    filters: { specialty: 'Orthodontist' },
  },
  {
    id: 'oral-surgeons',
    label: 'Oral Surgeons',
    description: 'Oral surgery practices',
    filters: { specialty: 'Oral Surgeon' },
  },
  {
    id: 'retirement-candidates',
    label: 'Retirement Candidates',
    description: 'Older or tagged owners',
    filters: { retirementCandidates: true },
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Closed client relationships',
    filters: { contactStatus: 'Client' },
  },
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
  followUpPreset: '',
  followUpPriority: '',
  leadScoreMin: '',
  leadScoreMax: '',
  tags: '',
  importSource: '',
  importBatchId: '',
  retirementCandidates: false,
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
  lead_score: 0,
  contact_status: 'New',
  lead_source: '',
  notes: '',
  next_follow_up_date: '',
  last_contact_date: '',
  follow_up_priority: 'Medium',
  tags: '',
  import_source: '',
  import_batch_id: '',
}

export const blankTaskForm = {
  title: '',
  description: '',
  due_date: '',
  priority: 'Medium',
  status: 'Open',
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
