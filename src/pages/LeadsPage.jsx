import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import DetailPanel from '../components/crm/DetailPanel.jsx'
import DentistFilters from '../components/crm/DentistFilters.jsx'
import DentistFormModal from '../components/crm/DentistFormModal.jsx'
import DentistsTable from '../components/crm/DentistsTable.jsx'
import { useDentists } from '../hooks/useDentists.js'
import { savedViews } from '../utils/constants.js'
import { buildCsv, downloadCsv } from '../utils/csv.js'
import { blankDentistForm } from '../utils/constants.js'

function LeadsPage() {
  const location = useLocation()
  const {
    configured,
    dentists,
    totalCount,
    totalPages,
    loading,
    error,
    filters,
    search,
    sort,
    page,
    pageSize,
    selectedIds,
    selectedDentist,
    editableDentist,
    notes,
    notesLoading,
    saving,
    deleting,
    noteDraft,
    setNoteDraft,
    setSelectedDentist,
    setSearch,
    setPage,
    updateFilter,
    resetFilters,
    setSort,
    toggleRowSelection,
    toggleSelectAll,
    updateEditableDentist,
    saveDentist,
    createDentist,
    updateDentistFromForm,
    deleteDentist,
    addNote,
    refresh,
    setSelectedDentistFromId,
    applySavedView,
  } = useDentists()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [formState, setFormState] = useState(blankDentistForm)

  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const viewId = query.get('view')
    const view = savedViews.find((item) => item.id === viewId)
    applySavedView(view || null)
  }, [applySavedView, location.search])

  const bulkSummary = useMemo(() => {
    if (!selectedIds.length) return 'No rows selected'
    return `${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'} selected`
  }, [selectedIds])

  const handleSubmit = async () => {
    const dentist =
      modalMode === 'create'
        ? await createDentist(formState)
        : await updateDentistFromForm(selectedDentist?.id, formState)
    if (!dentist) return
    setModalOpen(false)
    setFormState({ ...blankDentistForm })
    setSelectedDentistFromId(dentist.id)
  }

  const handleExport = async () => {
    const rows = await refresh({ exportAll: true })
    if (!rows) return
    const csv = buildCsv(rows)
    downloadCsv(csv, `omnihealth-leads-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const handleDelete = async () => {
    if (!selectedDentist) return
    const name = [selectedDentist.first_name, selectedDentist.last_name].filter(Boolean).join(' ') || 'this dentist'
    const confirmed = window.confirm(
      `Delete ${name}? Related contact notes will be removed by the database cascade.`,
    )
    if (!confirmed) return
    await deleteDentist()
  }

  if (!configured) {
    return (
      <EmptyState
        title="Supabase connection required"
        description="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload the app."
      />
    )
  }

  return (
    <>
      <DentistFormModal
        open={modalOpen}
        form={formState}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onChange={(field, value) => setFormState((current) => ({ ...current, [field]: value }))}
        onSubmit={handleSubmit}
        mode={modalMode}
      />

      <div className="workspace-grid">
        <div className="workspace-main">
          <DentistFilters
            filters={filters}
            search={search}
            onSearchChange={setSearch}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            totalCount={totalCount}
          />

          <section className="toolbar">
            <div className="toolbar-group">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setModalMode('create')
                  setFormState({ ...blankDentistForm })
                  setModalOpen(true)
                }}
              >
                <Plus size={16} />
                Add dentist
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  if (!selectedDentist) return
                  setModalMode('edit')
                  setFormState(selectedDentist)
                  setModalOpen(true)
                }}
                disabled={!selectedDentist}
              >
                <Pencil size={16} />
                Edit selected
              </button>
              <button
                type="button"
                className="ghost-button danger"
                onClick={handleDelete}
                disabled={!selectedDentist}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>

            <div className="toolbar-group">
              <span className="selection-label">{bulkSummary}</span>
              <button type="button" className="ghost-button" onClick={handleExport}>
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </section>

          {loading ? (
            <LoadingState label="Loading dentists..." />
          ) : error ? (
            <EmptyState title="Unable to load dentists" description={error} />
          ) : (
            <DentistsTable
              dentists={dentists}
              selectedIds={selectedIds}
              selectedDentistId={selectedDentist?.id}
              sort={sort}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onSelectRow={toggleRowSelection}
              onSelectAll={toggleSelectAll}
              onSort={setSort}
              onPageChange={setPage}
              onOpenDetail={setSelectedDentist}
            />
          )}
        </div>

        <DetailPanel
          dentist={selectedDentist}
          editableDentist={editableDentist}
          notes={notes}
          notesLoading={notesLoading}
          saving={saving}
          deleting={deleting}
          noteDraft={noteDraft}
          onFieldChange={updateEditableDentist}
          onSave={saveDentist}
          onDelete={handleDelete}
          onNoteDraftChange={(field, value) => setNoteDraft((current) => ({ ...current, [field]: value }))}
          onCreateNote={addNote}
        />
      </div>
    </>
  )
}

export default LeadsPage
