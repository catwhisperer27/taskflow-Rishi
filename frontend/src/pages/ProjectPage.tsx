import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { projectsApi, tasksApi, commentsApi, colleaguesApi } from '../lib/api'
import type { Task, TaskStatus, ProjectMember, ProjectWithTasks, Comment } from '../lib/api'
import { Spinner, ErrorMsg, SkeletonList, Modal, Input } from '../components/ui'
import { TaskForm } from '../components/TaskForm'
import { Plus, ChevronLeft, Trash2, UserPlus, X, Search, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { AxiosError } from 'axios'
import { FolderOpen } from 'lucide-react'

const STATUS_COLS: { key: TaskStatus; label: string; dot: string }[] = [
  { key: 'todo',        label: 'Todo',        dot: 'bg-[#6b7280]' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-indigo-500' },
  { key: 'done',        label: 'Done',        dot: 'bg-emerald-500' },
]

const PRIORITY_TAG: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: 'bg-red-900/40',   text: 'text-red-300',   border: 'border-red-800/40' },
  medium: { bg: 'bg-amber-900/40', text: 'text-amber-300', border: 'border-amber-800/40' },
  low:    { bg: 'bg-slate-800/60', text: 'text-slate-400', border: 'border-slate-700/40' },
}

function Avatar({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div className={`rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue},55%,40%)` }}
      title={name}>
      {initials}
    </div>
  )
}

function AvatarStack({ members, max = 4 }: { members: ProjectMember[]; max?: number }) {
  const visible = members.slice(0, max)
  const rest = members.length - max
  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: max - i }}>
          <Avatar name={m.name} size={26} className="border-2 border-[#1a1a1a]" />
        </div>
      ))}
      {rest > 0 && (
        <div className="w-[26px] h-[26px] rounded-full bg-[#2a2a2a] border-2 border-[#1a1a1a] flex items-center justify-center text-[10px] text-[#9ca3af] font-semibold"
          style={{ marginLeft: -8 }}>+{rest}</div>
      )}
    </div>
  )
}

function dueDateStyle(date?: string) {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date + 'T00:00:00')
  if (d < today) return { className: 'text-red-400', label: date, overdue: true }
  if (d.getTime() === today.getTime()) return { className: 'text-amber-400', label: 'Today', overdue: false }
  return { className: 'text-[#6b7280]', label: date, overdue: false }
}

function KanbanCard({ task, members, projectName, onEdit, onDelete, onStatusChange }: {
  task: Task; members: ProjectMember[]; projectName: string
  onEdit: () => void; onDelete: () => void; onStatusChange: (s: TaskStatus) => void
}) {
  const assignee = members.find(m => m.user_id === task.assignee_id)
  const due = dueDateStyle(task.due_date as unknown as string)
  const pTag = PRIORITY_TAG[task.priority]
  const isDone = task.status === 'done'
  const isOverdue = due?.overdue && !isDone

  return (
    <div onClick={onEdit}
      className={`bg-[#181818] border rounded-xl p-3.5 hover:border-indigo-800/50 transition-all cursor-pointer group relative ${
        isDone ? 'border-emerald-800/50' : isOverdue ? 'border-red-800/50' : 'border-[#222]'
      }`}>
      {/* Status stripe */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
        isDone ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-transparent'
      }`} />

      <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this task?')) onDelete() }}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-[#6b7280] hover:text-red-400 transition-all rounded">
        <Trash2 size={11} />
      </button>

      <p className={`text-sm font-medium leading-snug pr-5 mb-2 ${isDone ? 'line-through text-[#6b7280]' : 'text-[#e5e7eb]'}`}>
        {task.title}
      </p>

      {task.description && (
        <p className="text-xs text-[#6b7280] leading-relaxed mb-2.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${pTag.bg} ${pTag.text} ${pTag.border} capitalize`}>
          {task.priority}
        </span>
        {isDone && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-800/40">Done</span>}
        {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-800/40">Overdue</span>}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1 min-w-0">
          <FolderOpen size={9} className="text-indigo-400 flex-shrink-0" />
          <span className="text-[10px] text-indigo-300/80 truncate font-medium">{projectName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {due && <span className={`text-[10px] font-mono ${due.className}`}>{due.label}</span>}
          {assignee && <Avatar name={assignee.name} size={20} />}
        </div>
      </div>

      <div className="flex gap-1 pt-2.5 border-t border-[#222]" onClick={e => e.stopPropagation()}>
        {STATUS_COLS.map(col => (
          <button key={col.key} onClick={() => onStatusChange(col.key)}
            className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-all ${
              task.status === col.key
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-700/50'
                : 'text-[#4b5563] hover:text-[#9ca3af] border border-transparent hover:border-[#2a2a2a]'
            }`}>
            {col.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CommentsColumn({ projectId, members, currentUserId }: {
  projectId: string; members: ProjectMember[]; currentUserId: string
}) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['comments', projectId],
    queryFn: () => commentsApi.list(projectId).then(r => r.data.comments),
    refetchInterval: 5000,
  })

  const comments = data ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const send = useMutation({
    mutationFn: () => commentsApi.create(projectId, body.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', projectId] })
      setBody('')
    },
    onError: () => toast.error('Failed to send message'),
  })

  const del = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(projectId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId] }),
  })

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && body.trim()) {
      e.preventDefault()
      send.mutate()
    }
  }

  // Parse @mentions in body
  const renderBody = (text: string) => {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-indigo-400 font-medium">{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <div className="w-72 flex flex-col bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-[#e5e7eb]">Chat</span>
        <span className="ml-auto text-[10px] text-[#6b7280] bg-[#1a1a1a] px-1.5 py-0.5 rounded font-mono">
          {comments.length}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner size={16} /></div>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-[#333] text-center py-6">No messages yet.<br/>Start the conversation!</p>
        ) : (
          comments.map((c: Comment) => {
            const isMe = c.user_id === currentUserId
            return (
              <div key={c.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar name={c.user_name} size={24} className="flex-shrink-0 mt-0.5" />
                <div className={`flex flex-col gap-0.5 max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#6b7280]">{c.user_name}</span>
                    <span className="text-[9px] text-[#333]">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`relative text-xs px-3 py-2 rounded-xl leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600/80 text-white rounded-tr-sm'
                      : 'bg-[#1a1a1a] text-[#e5e7eb] rounded-tl-sm'
                  }`}>
                    {renderBody(c.body)}
                    {isMe && (
                      <button onClick={() => del.mutate(c.id)}
                        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-[#2a2a2a] rounded-full flex items-center justify-center text-[#6b7280] hover:text-red-400 transition-all">
                        <X size={8} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1a1a1a]">
        <div className="text-[10px] text-[#4b5563] mb-1.5">
          Tag someone with @{members.map(m => m.name.split(' ')[0]).join(', @')}
        </div>
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message... (Enter to send)"
            rows={2}
            className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-[#e5e7eb] placeholder:text-[#4b5563] focus:outline-none focus:border-indigo-500/50 resize-none"
          />
          <button
            onClick={() => body.trim() && send.mutate()}
            disabled={!body.trim() || send.isPending}
            className="self-end p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors">
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ColleagueAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const hue = name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center font-semibold text-white text-[9px] flex-shrink-0"
      style={{ background: `hsl(${hue},55%,40%)` }}>{initials}</div>
  )
}

function AddMemberModal({ projectId, currentMemberIds, onClose }: {
  projectId: string; currentMemberIds: string[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')

  // Fetch all colleagues (people already sharing other projects)
  const { data: colleaguesData } = useQuery({
    queryKey: ['colleagues'],
    queryFn: () => colleaguesApi.list().then(r => r.data.colleagues),
  })

  // Filter out people already in this project
  const suggestions = (colleaguesData ?? []).filter(c => !currentMemberIds.includes(c.id))
  const filtered = identifier.trim()
    ? suggestions.filter(c =>
        c.name.toLowerCase().includes(identifier.toLowerCase()) ||
        c.username.toLowerCase().includes(identifier.toLowerCase()) ||
        c.email.toLowerCase().includes(identifier.toLowerCase())
      )
    : suggestions

  const mutation = useMutation({
    mutationFn: (id: string) => projectsApi.addMember(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['colleagues'] })
      toast.success('Member added')
      onClose()
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'User not found')
    },
  })

  const addByIdentifier = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, identifier.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['colleagues'] })
      toast.success('Member added')
      onClose()
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setError(err.response?.data?.error ?? 'User not found')
    },
  })

  return (
    <Modal title="Add Member" onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-4">
        {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>}

        <Input label="Email or @username" placeholder="jane@example.com or @jane"
          value={identifier}
          onChange={(e) => { setIdentifier(e.target.value); setError('') }}
          autoFocus />

        {/* Colleague recommendations */}
        {filtered.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-[#6b7280] font-semibold uppercase tracking-wider">
              {identifier ? 'Matching colleagues' : 'Suggested colleagues'}
            </p>
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.id}
                  onClick={() => mutation.mutate(c.email)}
                  disabled={mutation.isPending}
                  className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] hover:border-indigo-700/40 rounded-lg transition-all text-left group">
                  <ColleagueAvatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#e5e7eb] truncate">{c.name}</p>
                    <p className="text-[10px] text-[#6b7280] truncate">@{c.username} · {c.email}</p>
                  </div>
                  <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Add →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.length === 0 && !identifier && (
          <p className="text-xs text-[#4b5563] text-center py-2">No colleagues yet — enter an email or username below</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a1a]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors">Cancel</button>
          <button onClick={() => addByIdentifier.mutate()} disabled={addByIdentifier.isPending || !identifier.trim()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-50">
            {addByIdentifier.isPending && <Spinner size={13} />} Add by email/username
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Task deleted')
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      tasksApi.update(taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: ['project', id] })
      const prev = qc.getQueryData(['project', id])
      qc.setQueryData(['project', id], (old: ProjectWithTasks) => ({
        ...old,
        tasks: old.tasks.map((t: Task) => t.id === taskId ? { ...t, status } : t),
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(['project', id], ctx?.prev)
      toast.error('Failed to update status')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['colleagues'] })
      toast.success('Member removed')
    },
  })

  if (isLoading) return <div className="p-6"><SkeletonList rows={6} /></div>
  if (error || !project) return <div className="p-6"><ErrorMsg message="Project not found" /></div>

  const allTasks = project.tasks ?? []
  const members = project.members ?? []
  const isOwner = project.owner_id === user?.id

  const filtered = allTasks.filter((t) => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const tasksByStatus = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = filtered.filter(t => t.status === col.key)
    return acc
  }, {} as Record<TaskStatus, Task[]>)

  const statusCounts = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = allTasks.filter(t => t.status === col.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0d0d0d] px-5 py-4">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#e5e7eb] mb-3 transition-colors">
          <ChevronLeft size={13} /> Projects
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[#e5e7eb] truncate">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-[#6b7280] mt-0.5 truncate">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <AvatarStack members={members} max={4} />
            {isOwner && (
              <button onClick={() => setShowAddMember(true)}
                className="w-[26px] h-[26px] rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#6b7280] hover:text-indigo-400 hover:border-indigo-700/50 transition-all"
                title="Add member">
                <UserPlus size={12} />
              </button>
            )}
            <button onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              <Plus size={13} /> Add task
            </button>
          </div>
        </div>

        {/* Members chips */}
        {isOwner && members.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {members.map(m => (
              <div key={m.user_id}
                className="group flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-2.5 py-1 text-xs text-[#9ca3af]">
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: `hsl(${m.name.charCodeAt(0) * 13 % 360},55%,40%)` }} />
                <span>{m.name}</span>
                <span className="text-[#4b5563]">· {m.role}</span>
                {m.role !== 'owner' && (
                  <button onClick={() => removeMember.mutate(m.user_id)}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-[#6b7280] hover:text-red-400 transition-all">
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status tabs + search */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center">
            {[{ key: 'all', label: 'All Task', count: allTasks.length },
              ...STATUS_COLS.map(c => ({ key: c.key, label: c.label, count: statusCounts[c.key] }))
            ].map((tab) => (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === tab.key ? 'text-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#9ca3af]'
                }`}>
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1 rounded font-mono ${
                    filterStatus === tab.key ? 'text-indigo-300' : 'text-[#4b5563]'
                  }`}>{tab.count}</span>
                )}
                {filterStatus === tab.key && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500/50 transition-colors">
            <Search size={11} className="text-[#6b7280]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-xs text-[#e5e7eb] placeholder:text-[#6b7280] focus:outline-none w-32" />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 p-4 min-w-max">
          {STATUS_COLS.map((col) => {
            const colTasks = tasksByStatus[col.key] ?? []
            return (
              <div key={col.key} className="w-72 flex flex-col bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                  <span className="text-xs font-semibold text-[#e5e7eb]">{col.label}</span>
                  <span className="ml-auto text-[10px] text-[#6b7280] bg-[#1a1a1a] px-1.5 py-0.5 rounded font-mono">
                    {colTasks.length}
                  </span>
                  <button onClick={() => setShowTaskForm(true)}
                    className="text-[#4b5563] hover:text-indigo-400 transition-colors">
                    <Plus size={13} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                  {colTasks.length === 0 ? (
                    <p className="text-[11px] text-[#333] text-center py-8">No tasks here</p>
                  ) : (
                    colTasks.map((task) => (
                      <KanbanCard key={task.id} task={task} members={members}
                        projectName={project.name}
                        onEdit={() => setEditingTask(task)}
                        onDelete={() => deleteTask.mutate(task.id)}
                        onStatusChange={(status) => updateStatus.mutate({ taskId: task.id, status })}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}

          {/* Comments / Chat column */}
          <CommentsColumn
            projectId={id!}
            members={members}
            currentUserId={user?.id ?? ''}
          />
        </div>
      </div>

      {showTaskForm && <TaskForm projectId={id!} members={members} onClose={() => setShowTaskForm(false)} />}
      {editingTask && <TaskForm projectId={id!} task={editingTask} members={members} onClose={() => setEditingTask(undefined)} />}
      {showAddMember && <AddMemberModal projectId={id!} currentMemberIds={members.map(m => m.user_id)} onClose={() => setShowAddMember(false)} />}
    </div>
  )
}
