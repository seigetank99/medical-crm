import LoadingState from '../common/LoadingState.jsx'
import EmptyState from '../common/EmptyState.jsx'
import { formatDate } from '../../utils/formatters.js'

function NotesTimeline({ notes, loading, onDeleteNote }) {
  if (loading) return <LoadingState label="Loading contact history..." />

  if (!notes.length) {
    return (
      <EmptyState
        title="No contact notes yet"
        description="Log each call, email, or meeting so the right-side profile becomes the source of truth for follow-up."
      />
    )
  }

  return (
    <div className="notes-timeline">
      {notes.map((item) => (
        <article key={item.id} className="timeline-item">
          <div className="timeline-meta">
            <strong>{item.contact_method || 'General note'}</strong>
            <span>{formatDate(item.contact_date || item.created_at)}</span>
          </div>
          <p>{item.note}</p>
          {onDeleteNote ? (
            <button type="button" className="text-button danger" onClick={() => onDeleteNote(item)}>
              Delete note
            </button>
          ) : null}
        </article>
      ))}
    </div>
  )
}

export default NotesTimeline
