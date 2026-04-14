import axios from 'axios'

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string; name: string; username: string; email: string; created_at: string
}

export interface Project {
  id: string; name: string; description?: string
  owner_id: string; created_at: string
}

export interface ProjectMember {
  user_id: string; name: string; username: string; email: string; role: 'owner' | 'member'
}

export interface ProjectWithTasks extends Project {
  tasks: Task[]
  members: ProjectMember[]
}

export interface Task {
  id: string; title: string; description?: string
  status: TaskStatus; priority: TaskPriority
  project_id: string; assignee_id?: string
  due_date?: string; created_at: string; updated_at: string
}

export interface TaskWithProject extends Task { project_name: string }

export const authApi = {
  register: (d: { name: string; username: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', d),
  login: (d: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', d),
  me: () => api.get<User>('/auth/me'),
}

export const projectsApi = {
  list: () => api.get<{ projects: Project[] }>('/projects'),
  get: (id: string) => api.get<ProjectWithTasks>(`/projects/${id}`),
  create: (d: { name: string; description?: string }) =>
    api.post<Project>('/projects', d),
  update: (id: string, d: { name?: string; description?: string }) =>
    api.patch<Project>(`/projects/${id}`, d),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, identifier: string) =>
    api.post(`/projects/${id}/members`, { identifier }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/${userId}`),
  listMembers: (id: string) =>
    api.get<{ members: ProjectMember[] }>(`/projects/${id}/members`),
}

export const tasksApi = {
  list: (projectId: string, params?: { status?: string; assignee?: string }) =>
    api.get<{ tasks: Task[] }>(`/projects/${projectId}/tasks`, { params }),
  my: () => api.get<{ tasks: TaskWithProject[] }>('/tasks/my'),
  create: (projectId: string, d: {
    title: string; description?: string; priority?: string
    assignee_id?: string; due_date?: string
  }) => api.post<Task>(`/projects/${projectId}/tasks`, d),
  update: (id: string, d: Partial<{
    title: string; description: string; status: TaskStatus
    priority: TaskPriority; assignee_id: string | null; due_date: string | null
  }>) => api.patch<Task>(`/tasks/${id}`, d),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  bulk: (taskIds: string[], status: string) =>
    api.post('/tasks/bulk', { task_ids: taskIds, status }),
}

export const usersApi = {
  list: () => api.get<{ users: { id: string; name: string; username: string; email: string }[] }>('/users'),
}

export interface Comment {
  id: string
  project_id: string
  user_id: string
  user_name: string
  user_initials: string
  body: string
  created_at: string
}

export const commentsApi = {
  list: (projectId: string) => api.get<{ comments: Comment[] }>(`/projects/${projectId}/comments`),
  create: (projectId: string, body: string) => api.post<Comment>(`/projects/${projectId}/comments`, { body }),
  delete: (projectId: string, commentId: string) => api.delete(`/projects/${projectId}/comments/${commentId}`),
}

export const colleaguesApi = {
  list: () => api.get<{ colleagues: { id: string; name: string; username: string; email: string }[] }>('/colleagues'),
}
