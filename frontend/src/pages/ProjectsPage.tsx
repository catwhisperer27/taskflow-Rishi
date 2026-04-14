import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { projectsApi } from '../lib/api'
import { Spinner, ErrorMsg, EmptyState, Modal, Input, Textarea } from '../components/ui'
import type { AxiosError } from 'axios'
import { Plus, FolderOpen, ChevronRight, Trash2, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data.projects),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  })

  const filtered = (data ?? []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size={20} /></div>
  if (error) return <div className="p-6"><ErrorMsg message="Failed to load projects" /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-[#e5e7eb]">Projects</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">{data?.length ?? 0} project{data?.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded px-2.5 py-1.5 focus-within:border-indigo-500/50 transition-colors">
            <Search size={12} className="text-[#6b7280]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..." className="bg-transparent text-xs text-[#e5e7eb] placeholder:text-[#6b7280] focus:outline-none w-28" />
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors">
            <Plus size={14} /> New project
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FolderOpen size={40} />} title="No projects yet"
          description="Create your first project to start tracking tasks."
          action={
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors">
              <Plus size={14} /> New project
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((project) => (
            <div key={project.id}
              className="group bg-[#111111] border border-[#1a1a1a] rounded-md px-4 py-3.5 hover:border-[#2a2a2a] hover:bg-[#141414] transition-all cursor-pointer flex items-center gap-3"
              onClick={() => navigate(`/projects/${project.id}`)}>
              <div className="w-7 h-7 rounded bg-indigo-900/50 border border-indigo-800/40 flex items-center justify-center flex-shrink-0">
                <FolderOpen size={13} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e5e7eb] truncate">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-[#6b7280] mt-0.5 truncate">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {project.owner_id === user?.id && (
                  <button onClick={(e) => { e.stopPropagation()
                    if (confirm('Delete this project and all its tasks?')) deleteMutation.mutate(project.id)
                  }} className="p-1.5 text-[#6b7280] hover:text-red-400 hover:bg-red-950/20 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
                <ChevronRight size={14} className="text-[#6b7280]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => projectsApi.create({ name: form.name, description: form.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      onClose()
    },
    onError: (err: AxiosError<{ error?: string }>) => setErrors({ _: err.response?.data?.error ?? 'Failed to create project' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return }
    mutation.mutate()
  }

  return (
    <Modal title="New Project" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errors._ && <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{errors._}</div>}
        <Input label="Project name" placeholder="e.g. Website Redesign" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} autoFocus />
        <Textarea label="Description" placeholder="What is this project about? (optional)"
          value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
        <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a1a]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-50">
            {mutation.isPending && <Spinner size={13} />} Create project
          </button>
        </div>
      </form>
    </Modal>
  )
}
