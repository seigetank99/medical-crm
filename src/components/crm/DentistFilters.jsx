import { Search, X } from 'lucide-react'
import {
  ageRangeOptions,
  contactStatusOptions,
  ownerStatusOptions,
  specialtyOptions,
  stateOptions,
} from '../../utils/constants.js'

function DentistFilters({
  filters,
  search,
  onSearchChange,
  onFilterChange,
  onReset,
  totalCount,
}) {
  return (
    <section className="panel filters-panel">
      <div className="panel-heading">
        <div>
          <h2>Lead filters</h2>
          <p>{totalCount.toLocaleString()} dentists in view</p>
        </div>
        <button type="button" className="ghost-button" onClick={onReset}>
          <X size={16} />
          Reset
        </button>
      </div>

      <label className="search-field">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search doctor, practice, city, email, phone..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="filter-grid">
        <SelectField
          label="State"
          value={filters.state}
          options={stateOptions}
          onChange={(value) => onFilterChange('state', value)}
        />
        <SelectField
          label="Specialty"
          value={filters.specialty}
          options={specialtyOptions}
          onChange={(value) => onFilterChange('specialty', value)}
        />
        <SelectField
          label="Contact status"
          value={filters.contactStatus}
          options={contactStatusOptions}
          onChange={(value) => onFilterChange('contactStatus', value)}
        />
        <SelectField
          label="Owner status"
          value={filters.ownerStatus}
          options={ownerStatusOptions}
          onChange={(value) => onFilterChange('ownerStatus', value)}
        />
        <SelectField
          label="Age range"
          value={filters.ageRange}
          options={ageRangeOptions}
          onChange={(value) => onFilterChange('ageRange', value)}
        />
        <div className="field-group">
          <span>Graduation year</span>
          <div className="range-fields">
            <input
              type="number"
              placeholder="From"
              value={filters.graduationYearFrom}
              onChange={(event) => onFilterChange('graduationYearFrom', event.target.value)}
            />
            <input
              type="number"
              placeholder="To"
              value={filters.graduationYearTo}
              onChange={(event) => onFilterChange('graduationYearTo', event.target.value)}
            />
          </div>
        </div>
        <div className="field-group">
          <span>Next follow up</span>
          <div className="range-fields">
            <input
              type="date"
              value={filters.followUpFrom}
              onChange={(event) => onFilterChange('followUpFrom', event.target.value)}
            />
            <input
              type="date"
              value={filters.followUpTo}
              onChange={(event) => onFilterChange('followUpTo', event.target.value)}
            />
          </div>
        </div>
        <label className="field-group">
          <span>Tags</span>
          <input
            type="search"
            placeholder="Tag contains..."
            value={filters.tags}
            onChange={(event) => onFilterChange('tags', event.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="field-group">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export default DentistFilters
