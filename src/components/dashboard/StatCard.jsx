function StatCard({ label, value, accent, helper }) {
  return (
    <article className="stat-card">
      <div className="stat-accent" style={{ background: accent }} />
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  )
}

export default StatCard
