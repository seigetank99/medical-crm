import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    }

    void loadSession()

    if (!supabase) return undefined

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      loading,
      error,
      async signIn(email, password) {
        setError('')
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(signInError.message)
          return { error: signInError.message }
        }
        return { error: '' }
      },
      async signOut() {
        setError('')
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) setError(signOutError.message)
      },
    }),
    [error, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
