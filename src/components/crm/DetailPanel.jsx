import { ExternalLink, Mail, MapPin, Phone, Save, Trash2 } from 'lucide-react'
import {
  contactMethodOptions,
  contactStatusOptions,
  followUpPriorityOptions,
  ownerStatusOptions,
  specialtyOptions,
} from '../../utils/constants.js'
import { formatDate, formatDateTime, formatDoctorName, normalizeWebsite } from '../../utils/formatters.js'
import EmptyState from '../common/EmptyState.jsx'
import NotesTimeline from './NotesTimeline.jsx'
import TasksSection from './TasksSection.jsx'

function DetailPanel({
  dentist,
  editableDentist,
  notes,
  notesLoading,
  saving,
  deleting,
  noteDraft,
  tasks,
  taskDraft,
  onFieldChange,
  onSave,
  onDelete,
  onNoteDraftChange,
  onCreateNote,
  onDeleteNote,
  onTaskDraftChange,
  onCreateTask,
  onCompleteTask,
  onDeleteTask,
}) {
  if (!dentist) {
    return (
      <aside className="detail-panel">
        <EmptyState
          title="Select a lead"
          description="Choose a dentist from the table to view profile details, update status, and log outreach."
        />
      </aside>
    )
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Dentist profile</p>
          <h2>{formatDoctorName(dentist)}</h2>
          <span className="status-pill">{editableDentist.contact_status || 'No status'}</span>
          <span className="score-pill">Score {editableDentist.lead_score ?? 0}</span>
        </div>
        <div className="detail-actions">
          <button type="button" className="icon-button" onClick={onSave} disabled={saving}>
            <Save size={16} />
          </button>
          <button type="button" className="icon-button danger" onClick={onDelete} disabled={deleting}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <section className="detail-card">
        <div className="contact-stack">
          <div className="inline-icon">
            <Mail size={16} />
            <span>{editableDentist.email || 'No email recorded'}</span>
          </div>
          <div className="inline-icon">
            <Phone size={16} />
            <span>{editableDentist.phone || 'No phone recorded'}</span>
          </div>
          <div className="inline-icon align-start">
            <MapPin size={16} />
            <span>
              {[editableDentist.address, editableDentist.city, editableDentist.state, editableDentist.zip_code]
                .filter(Boolean)
                .join(', ') || 'No address recorded'}
            </span>
          </div>
          {editableDentist.website ? (
            <a
              className="inline-icon website-link"
              href={normalizeWebsite(editableDentist.website)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              <span>{editableDentist.website}</span>
            </a>
          ) : null}
        </div>
      </section>

      <section className="detail-card">
        <h3>Practice details</h3>
        <div className="detail-form">
          <InputField label="First name" value={editableDentist.first_name} onChange={(value) => onFieldChange('first_name', value)} />
          <InputField label="Last name" value={editableDentist.last_name} onChange={(value) => onFieldChange('last_name', value)} />
          <InputField label="Credentials" value={editableDentist.credentials} onChange={(value) => onFieldChange('credentials', value)} />
          <SelectField label="Specialty" value={editableDentist.specialty} options={specialtyOptions} onChange={(value) => onFieldChange('specialty', value)} />
          <InputField label="Practice name" value={editableDentist.practice_name} onChange={(value) => onFieldChange('practice_name', value)} />
          <InputField label="Graduation year" type="number" value={editableDentist.graduation_year} onChange={(value) => onFieldChange('graduation_year', value)} />
          <SelectField label="Owner status" value={editableDentist.owner_status} options={ownerStatusOptions} onChange={(value) => onFieldChange('owner_status', value)} />
          <SelectField label="Contact status" value={editableDentist.contact_status} options={contactStatusOptions} onChange={(value) => onFieldChange('contact_status', value)} />
          <InputField label="Next follow up" type="date" value={editableDentist.next_follow_up_date || ''} onChange={(value) => onFieldChange('next_follow_up_date', value)} />
          <InputField label="Last contact" type="date" value={editableDentist.last_contact_date || ''} onChange={(value) => onFieldChange('last_contact_date', value)} />
          <SelectField label="Follow-up priority" value={editableDentist.follow_up_priority} options={followUpPriorityOptions} onChange={(value) => onFieldChange('follow_up_priority', value)} />
          <InputField label="Lead source" value={editableDentist.lead_source} onChange={(value) => onFieldChange('lead_source', value)} />
          <InputField label="NPI number" value={editableDentist.npi_number} onChange={(value) => onFieldChange('npi_number', value)} />
          <InputField label="Google rating" value={editableDentist.google_rating} onChange={(value) => onFieldChange('google_rating', value)} />
          <InputField label="Review count" value={editableDentist.google_review_count} onChange={(value) => onFieldChange('google_review_count', value)} />
          <InputField label="Website" value={editableDentist.website} onChange={(value) => onFieldChange('website', value)} />
          <InputField label="Phone" value={editableDentist.phone} onChange={(value) => onFieldChange('phone', value)} />
          <InputField label="Email" value={editableDentist.email} onChange={(value) => onFieldChange('email', value)} />
          <InputField label="Notes tags" value={editableDentist.tags} onChange={(value) => onFieldChange('tags', value)} />
          <InputField label="Lead score" type="number" value={editableDentist.lead_score} onChange={(value) => onFieldChange('lead_score', value)} />
        </div>

        <label className="field-group">
          <span>Notes</span>
          <textarea
            rows="4"
            value={editableDentist.notes || ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
          />
        </label>
      </section>

      <section className="detail-card">
        <div className="detail-card-header">
          <div>
            <h3>Contact history</h3>
            <p>Last updated {formatDateTime(dentist.updated_at)}</p>
          </div>
        </div>

        <div className="note-composer">
          <select
            value={noteDraft.contact_method}
            onChange={(event) => onNoteDraftChange('contact_method', event.target.value)}
          >
            {contactMethodOptions.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={noteDraft.contact_date}
            onChange={(event) => onNoteDraftChange('contact_date', event.target.value)}
          />
          <textarea
            rows="3"
            placeholder="Capture the conversation, decision-maker context, and next step."
            value={noteDraft.note}
            onChange={(event) => onNoteDraftChange('note', event.target.value)}
          />
          <button type="button" className="primary-button" onClick={onCreateNote}>
            Add note
          </button>
        </div>

        <NotesTimeline notes={notes} loading={notesLoading} onDeleteNote={onDeleteNote} />
      </section>

      <TasksSection
        tasks={tasks}
        taskDraft={taskDraft}
        onTaskDraftChange={onTaskDraftChange}
        onCreateTask={onCreateTask}
        onCompleteTask={onCompleteTask}
        onDeleteTask={onDeleteTask}
        saving={saving}
      />

      <section className="detail-card quick-facts">
        <div>
          <span>Years in practice</span>
          <strong>{editableDentist.years_in_practice || '—'}</strong>
        </div>
        <div>
          <span>Locations</span>
          <strong>{editableDentist.number_of_locations || '—'}</strong>
        </div>
        <div>
          <span>Solo practice</span>
          <strong>{editableDentist.solo_practice ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span>Next follow up</span>
          <strong>{formatDate(editableDentist.next_follow_up_date)}</strong>
        </div>
        <div>
          <span>Follow-up priority</span>
          <strong>{editableDentist.follow_up_priority || '—'}</strong>
        </div>
        <div>
          <span>Lead score</span>
          <strong>{editableDentist.lead_score ?? 0}</strong>
        </div>
      </section>
    </aside>
  )
}

function InputField({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field-group">
      <span>{label}</span>
      <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="field-group">
      <span>{label}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export default DetailPanel
