import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createContactNote,
  createDentistRecord,
  deleteDentistRecord,
  getContactNotes,
  getDentistById,
  getDentists,
  updateDentistRecord,
} from '../services/dentistsService.js'
import { blankDentistForm, createDefaultNoteDraft, defaultFilters } from '../utils/constants.js'
import { cleanDentistPayload } from '../utils/formatters.js'

const pageSize = 25

export function useDentists() {
  const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const [dentists, setDentists] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(defaultFilters)
  const [sort, setSortState] = useState({ column: 'updated_at', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedDentistId, setSelectedDentistId] = useState(null)
  const [selectedDentist, setSelectedDentist] = useState(null)
  const [editableDentist, setEditableDentist] = useState(blankDentistForm)
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noteDraft, setNoteDraft] = useState(createDefaultNoteDraft)

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount])

  const loadDentists = useCallback(
    async ({ exportAll = false } = {}) => {
      if (!configured) return null
      setLoading(!exportAll)
      setError('')

      const result = await getDentists({
        page,
        pageSize,
        search,
        filters,
        sort,
        exportAll,
      })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return null
      }

      if (!exportAll) {
        setDentists(result.data)
        setTotalCount(result.count)
        setLoading(false)
      }

      return result.data
    },
    [configured, page, search, filters, sort],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDentists()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDentists])

  useEffect(() => {
    async function loadSelectedDentist() {
      if (!selectedDentistId) {
        setSelectedDentist(null)
        setNotes([])
        setEditableDentist({ ...blankDentistForm })
        return
      }

      const dentistResult = await getDentistById(selectedDentistId)
      if (dentistResult.error) {
        setSelectedDentist(null)
        return
      }

      setSelectedDentist(dentistResult.data)
      setEditableDentist(dentistResult.data)
      setNotesLoading(true)
      const result = await getContactNotes(selectedDentistId)
      if (result.error) {
        setNotes([])
      } else {
        setNotes(result.data)
      }
      setNotesLoading(false)
    }

    void loadSelectedDentist()
  }, [selectedDentistId])

  const updateFilter = useCallback((field, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setPage(1)
    setSearch('')
    setFilters({ ...defaultFilters })
  }, [])

  const setSort = useCallback((column) => {
    setSortState((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const toggleRowSelection = useCallback((id, checked) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)))
  }, [])

  const toggleSelectAll = useCallback(
    (checked) => {
      if (!checked) {
        setSelectedIds([])
        return
      }
      setSelectedIds(dentists.map((dentist) => dentist.id))
    },
    [dentists],
  )

  const updateEditableDentist = useCallback((field, value) => {
    setEditableDentist((current) => ({ ...current, [field]: value }))
  }, [])

  const saveDentist = useCallback(async () => {
    if (!selectedDentistId) return
    setSaving(true)
    const payload = cleanDentistPayload(editableDentist)
    const result = await updateDentistRecord(selectedDentistId, payload)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSelectedDentist(result.data)
    setEditableDentist(result.data)
    await loadDentists()
  }, [editableDentist, loadDentists, selectedDentistId])

  const createDentist = useCallback(async (form) => {
    setSaving(true)
    const result = await createDentistRecord(cleanDentistPayload(form))
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return null
    }
    await loadDentists()
    return result.data
  }, [loadDentists])

  const deleteDentist = useCallback(async () => {
    if (!selectedDentistId) return
    setDeleting(true)
    const result = await deleteDentistRecord(selectedDentistId)
    setDeleting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSelectedDentistId(null)
    setSelectedDentist(null)
    setEditableDentist({ ...blankDentistForm })
    setSelectedIds((current) => current.filter((id) => id !== selectedDentistId))
    await loadDentists()
  }, [loadDentists, selectedDentistId])

  const addNote = useCallback(async () => {
    if (!selectedDentistId || !noteDraft.note.trim()) return
    const result = await createContactNote(selectedDentistId, noteDraft)
    if (result.error) {
      setError(result.error)
      return
    }
    setNoteDraft(createDefaultNoteDraft())
    const notesResult = await getContactNotes(selectedDentistId)
    if (!notesResult.error) setNotes(notesResult.data)
    if (editableDentist.contact_status !== 'Contacted') {
      updateEditableDentist('contact_status', 'Contacted')
    }
  }, [editableDentist.contact_status, noteDraft, selectedDentistId, updateEditableDentist])

  const updateDentistFromForm = useCallback(async (id, form) => {
    setSaving(true)
    const result = await updateDentistRecord(id, cleanDentistPayload(form))
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return null
    }
    setSelectedDentist(result.data)
    setEditableDentist(result.data)
    await loadDentists()
    return result.data
  }, [loadDentists])

  const applySavedView = useCallback((view) => {
    setPage(1)
    setSearch('')
    setFilters({ ...defaultFilters, ...(view?.filters || {}) })
  }, [])

  const refresh = useCallback(async (options) => loadDentists(options), [loadDentists])

  const setSelectedDentistFromId = useCallback(async (id) => {
    setSelectedDentistId(id)
  }, [])

  return {
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
    setSelectedDentist: (dentist) => setSelectedDentistId(dentist?.id || null),
    setSelectedDentistFromId,
    setSearch: (value) => {
      setPage(1)
      setSearch(value)
    },
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
    applySavedView,
  }
}
