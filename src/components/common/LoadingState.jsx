function LoadingState({ label = 'Loading data...' }) {
  return (
    <div className="state-card">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  )
}

export default LoadingState
