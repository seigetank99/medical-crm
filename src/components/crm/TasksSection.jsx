import { CheckCircle2, Trash2 } from 'lucide-react'
import { taskPriorityOptions, taskStatusOptions } from '../../utils/constants.js'
import { formatDate } from '../../utils/formatters.js'
import EmptyState from '../common/EmptyState.jsx'

function TasksSection({ tasks, taskDraft, onTaskDraftChange, onCreateTask, onCompleteTask, onDeleteTask, saving }) {
  return (
    <section className="detail-card">
      <div className="detail-card-header">
        <div>
          <h3>Tasks</h3>
          <p>{tasks.length} task{tasks.length === 1 ? '' : 's'} linked to this lead</p>
        </div>
      </div>

      <div className="task-composer">
        <input
          type="text"
          placeholder="Task title"
          value={taskDraft.title}
          onChange={(event) => onTaskDraftChange('title', event.target.value)}
        />
        <textarea
          rows="2"
          placeholder="Description"
          value={taskDraft.description}
          onChange={(event) => onTaskDraftChange('description', event.target.value)}
        />
        <div className="task-grid">
          <input
            type="date"
            value={taskDraft.due_date}
            onChange={(event) => onTaskDraftChange('due_date', event.target.value)}
          />
          <select value={taskDraft.priority} onChange={(event) => onTaskDraftChange('priority', event.target.value)}>
            {taskPriorityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={taskDraft.status} onChange={(event) => onTaskDraftChange('status', event.target.value)}>
            {taskStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary-button" onClick={onCreateTask} disabled={saving || !taskDraft.title.trim()}>
          Add task
        </button>
      </div>

      {tasks.length ? (
        <div className="task-list">
          {tasks.map((task) => (
            <article key={task.id} className={`task-item ${task.status === 'Completed' ? 'completed' : ''}`}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description || 'No description'}</p>
                <span>
                  {formatDate(task.due_date)} · {task.priority} · {task.status}
                </span>
              </div>
              <div className="task-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onCompleteTask(task)}
                  disabled={task.status === 'Completed'}
                  aria-label="Mark task completed"
                >
                  <CheckCircle2 size={16} />
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDeleteTask(task)} aria-label="Delete task">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No tasks yet" description="Add a follow-up task for this lead." />
      )}
    </section>
  )
}

export default TasksSection
