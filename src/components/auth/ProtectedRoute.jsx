import { Navigate, useLocation } from 'react-router-dom'
import LoadingState from '../common/LoadingState.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function ProtectedRoute({ children }) {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking session..." />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}

export default ProtectedRoute
