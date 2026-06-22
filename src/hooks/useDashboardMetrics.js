import { useEffect, useState } from 'react'
import { getDashboardMetrics } from '../services/dentistsService.js'

export function useDashboardMetrics() {
  const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const [metrics, setMetrics] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadMetrics() {
      if (!configured) {
        setLoading(false)
        return
      }

      setLoading(true)
      const result = await getDashboardMetrics()
      if (result.error) {
        setError(result.error)
      } else {
        setMetrics(result.data)
      }
      setLoading(false)
    }

    loadMetrics()
  }, [configured])

  return { metrics, loading, error, configured }
}
