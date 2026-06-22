function EmptyState({ title, description, action }) {
  return (
    <div className="state-card">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export default EmptyState
