import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { tasksApi } from '../lib/api'
import type { TaskWithProject, TaskStatus } from '../lib/api'
import { Spinner, ErrorMsg, EmptyState } from '../components/ui'
import { CheckSquare, Search, ExternalLink, FolderOpen } from 'lucide-react'

const STATUS_GROUPS: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

const PRIORITY_TAG: Record<string, { bg: string; text: string }> = {
  high:   { bg: 'bg-red-900/40',   text: 'text-red-300' },
  medium: { bg: 'bg-amber-900/40', text: 'text-amber-300' },
  low:    { bg: 'bg-slate-800/60', text: 'text-slate-400' },
}

function dueDateStyle(date?: string): { className: string; label: string } | null {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date + 'T00:00:00')
  if (d < today) return { className: 'text-red-400', label: date }
  if (d.getTime() === today.getTime()) return { className: 'text-amber-400', label: 'Today' }
  return { className: 'text-[#6b7280]', label: date }
}

export default function MyTasksPage() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => tasksApi.my().then((r) => r.data.tasks),
  })

  const tasks = data ?? []
  const counts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = tasks.filter((t) => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.project_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-[#e5e7eb]">My Tasks</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">Tasks assigned to you across all projects</p>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {STATUS_GROUPS.map((s) => {
          const count = s.key === 'all' ? tasks.length : (counts[s.key] ?? 0)
          const active = filterStatus === s.key
          return (
            <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#111111] border border-[#1a1a1a] text-[#9ca3af] hover:border-[#2a2a2a] hover:text-[#e5e7eb]'
              }`}>
              {s.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                active ? 'bg-indigo-500 text-white' : 'bg-[#1a1a1a] text-[#6b7280]'
              }`}>{count}</span>
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded px-2.5 py-1.5 focus-within:border-indigo-500/50 transition-colors">
          <Search size={12} className="text-[#6b7280] flex-shrink-0" />
          <input type="text" placeholder="Search tasks..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-[#e5e7eb] placeholder:text-[#6b7280] focus:outline-none w-40" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={20} /></div>
      ) : error ? (
        <ErrorMsg message="Failed to load tasks" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CheckSquare size={36} />}
          title={search ? 'No tasks match your search' : 'No tasks assigned to you'}
          description={search ? 'Try a different search term.' : 'Tasks assigned to you will appear here.'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => navigate(`/projects/${task.project_id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, onOpen }: { task: TaskWithProject; onOpen: () => void }) {
  const pTag = PRIORITY_TAG[task.priority]
  const due = dueDateStyle(task.due_date as unknown as string)
  const isDone = task.status === 'done'
  const isOverdue = due?.className === 'text-red-400'

  return (
    <div className={`relative bg-[#111111] border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-800/50 transition-all group ${
      isDone ? 'border-emerald-800/40' : isOverdue ? 'border-red-800/40' : 'border-[#1a1a1a]'
    }`}>
      {/* Done/overdue indicator strip */}
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full ${
        isDone ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-transparent'
      }`} />

      {/* Title */}
      <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-[#6b7280]' : 'text-[#e5e7eb]'}`}>
        {task.title}
      </p>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-[#6b7280] leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {/* Priority tag */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pTag.bg} ${pTag.text} capitalize`}>
          {task.priority}
        </span>
        {isDone && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">Done</span>
        )}
        {isOverdue && !isDone && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">Overdue</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-1 min-w-0">
          <FolderOpen size={10} className="text-indigo-400 flex-shrink-0" />
          <span className="text-[10px] text-indigo-300/80 truncate font-medium">{task.project_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {due && <span className={`text-[10px] font-mono ${due.className}`}>{due.label}</span>}
          <button onClick={onOpen}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#6b7280] hover:text-indigo-400 rounded">
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
