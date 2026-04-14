import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tasksApi } from '../lib/api'
import type { Task, TaskStatus, TaskPriority, ProjectMember } from '../lib/api'
import { Modal, Input, Select, Textarea, ErrorMsg, Spinner } from './ui'
import type { AxiosError } from 'axios'

interface TaskFormProps {
  projectId: string
  task?: Task
  members: ProjectMember[]
  onClose: () => void
}

interface ApiErrorResponse {
  error?: string
}

export function TaskForm({ projectId, task, members, onClose }: TaskFormProps) {
  const qc = useQueryClient()
  const isEdit = !!task

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'todo',
    assignee_id: task?.assignee_id ?? '',
    due_date: task?.due_date ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as TaskPriority,
        assignee_id: form.assignee_id || undefined,
        due_date: form.due_date || undefined,
      }
      if (isEdit) {
        return tasksApi.update(task.id, { ...payload, status: form.status as TaskStatus })
      }
      return tasksApi.create(projectId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success(isEdit ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (err: AxiosError<ApiErrorResponse>) => {
      const msg = err.response?.data?.error ?? 'Something went wrong'
      setErrors({ _: msg })
      toast.error(msg)
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <Modal title={isEdit ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errors._ && <ErrorMsg message={errors._} />}

        <Input label="Title" placeholder="What needs to be done?"
          value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          error={errors.title} autoFocus />

        <Textarea label="Description" placeholder="Add more context... (optional)"
          value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>

          {isEdit && (
            <Select label="Status" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </Select>
          )}
        </div>

        <Select label="Assignee" value={form.assignee_id}
          onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name}{m.role === 'owner' ? ' (owner)' : ''}
            </option>
          ))}
        </Select>

        <Input label="Due date" type="date" value={form.due_date}
          onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a1a]">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-50">
            {mutation.isPending && <Spinner size={13} />}
            {isEdit ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
