import { X } from 'lucide-react'
import { contactStatusOptions, ownerStatusOptions, specialtyOptions } from '../../utils/constants.js'

function DentistFormModal({ open, form, saving, onClose, onChange, onSubmit, mode }) {
  if (!open) return null

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{mode === 'create' ? 'New lead' : 'Edit lead'}</p>
            <h2>{mode === 'create' ? 'Add dentist' : 'Update dentist'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-grid">
          <InputField label="First name" value={form.first_name} onChange={(value) => onChange('first_name', value)} />
          <InputField label="Last name" value={form.last_name} onChange={(value) => onChange('last_name', value)} />
          <InputField label="Credentials" value={form.credentials} onChange={(value) => onChange('credentials', value)} />
          <SelectField label="Specialty" value={form.specialty} options={specialtyOptions} onChange={(value) => onChange('specialty', value)} />
          <InputField label="Practice name" value={form.practice_name} onChange={(value) => onChange('practice_name', value)} />
          <InputField label="Email" value={form.email} onChange={(value) => onChange('email', value)} />
          <InputField label="Phone" value={form.phone} onChange={(value) => onChange('phone', value)} />
          <InputField label="Website" value={form.website} onChange={(value) => onChange('website', value)} />
          <InputField label="Address" value={form.address} onChange={(value) => onChange('address', value)} />
          <InputField label="City" value={form.city} onChange={(value) => onChange('city', value)} />
          <InputField label="State" value={form.state} onChange={(value) => onChange('state', value)} />
          <InputField label="ZIP code" value={form.zip_code} onChange={(value) => onChange('zip_code', value)} />
          <InputField label="Graduation year" type="number" value={form.graduation_year} onChange={(value) => onChange('graduation_year', value)} />
          <SelectField label="Owner status" value={form.owner_status} options={ownerStatusOptions} onChange={(value) => onChange('owner_status', value)} />
          <SelectField label="Contact status" value={form.contact_status} options={contactStatusOptions} onChange={(value) => onChange('contact_status', value)} />
          <InputField label="Next follow up" type="date" value={form.next_follow_up_date} onChange={(value) => onChange('next_follow_up_date', value)} />
        </div>

        <label className="field-group">
          <span>Notes</span>
          <textarea rows="4" value={form.notes} onChange={(event) => onChange('notes', event.target.value)} />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : mode === 'create' ? 'Create lead' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
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

export default DentistFormModal
