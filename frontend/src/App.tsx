import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useNotifications } from './hooks/useNotifications'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectPage from './pages/ProjectPage'
import MyTasksPage from './pages/MyTasksPage'
import { Spinner } from './components/ui'
import { projectsApi, colleaguesApi } from './lib/api'
import { Layers, FolderOpen, CheckSquare, LogOut, Plus, ChevronDown, ChevronRight, LayoutDashboard, Users, X, Mail, AtSign } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen"><Spinner size={24} /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const hue = name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div className="rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue},55%,40%)` }}>
      {initials}
    </div>
  )
}

interface ColleagueType { id: string; name: string; username: string; email: string }

function ColleaguePopover({ colleague, onClose }: { colleague: ColleagueType; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const hue = colleague.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  const initials = colleague.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div ref={ref}
      className="absolute left-full ml-2 top-0 z-50 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl p-4 flex flex-col gap-3">
      <button onClick={onClose} className="absolute top-2.5 right-2.5 text-[#6b7280] hover:text-[#e5e7eb]">
        <X size={12} />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
          style={{ background: `hsl(${hue},55%,40%)` }}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#e5e7eb] truncate">{colleague.name}</p>
          <p className="text-[10px] text-indigo-400">Colleague</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <AtSign size={11} className="text-[#6b7280] flex-shrink-0" />
          <span className="truncate font-mono">{colleague.username}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <Mail size={11} className="text-[#6b7280] flex-shrink-0" />
          <span className="truncate">{colleague.email}</span>
        </div>
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [colleaguesOpen, setColleaguesOpen] = useState(true)
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data.projects),
  })

  const { data: colleaguesData } = useQuery({
    queryKey: ['colleagues'],
    queryFn: () => colleaguesApi.list().then((r) => r.data.colleagues),
  })

  const colleagues = colleaguesData ?? []

  return (
    <aside className="w-56 shrink-0 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#1a1a1a]">
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
          <Layers size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-[#e5e7eb] tracking-tight">TaskFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        <p className="px-2 text-[10px] font-semibold text-[#4b5563] uppercase tracking-wider mb-1">Main Menu</p>

        <NavLink to="/" end className={({ isActive }) =>
          `flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
            isActive ? 'bg-[#1a1a1a] text-[#e5e7eb]' : 'text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#141414]'
          }`}>
          <LayoutDashboard size={13} /> Dashboard
        </NavLink>

        <NavLink to="/my-tasks" className={({ isActive }) =>
          `flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
            isActive ? 'bg-[#1a1a1a] text-[#e5e7eb]' : 'text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#141414]'
          }`}>
          <CheckSquare size={13} /> My Tasks
        </NavLink>

        {/* Projects */}
        <div className="mt-3">
          <button onClick={() => setProjectsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-[#4b5563] uppercase tracking-wider hover:text-[#6b7280] transition-colors">
            <span>Project</span>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); navigate('/') }}
                className="p-0.5 hover:text-indigo-400 transition-colors"><Plus size={11} /></button>
              {projectsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </div>
          </button>
          {projectsOpen && projects?.map((p) => (
            <NavLink key={p.id} to={`/projects/${p.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors mt-0.5 ${
                  isActive ? 'bg-[#1a1a1a] text-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#141414]'
                }`}>
              <FolderOpen size={11} className="flex-shrink-0 text-indigo-500" />
              <span className="truncate">{p.name}</span>
            </NavLink>
          ))}
        </div>

        {/* Colleagues */}
        <div className="mt-3">
          <button onClick={() => setColleaguesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-[#4b5563] uppercase tracking-wider hover:text-[#6b7280] transition-colors">
            <span className="flex items-center gap-1.5"><Users size={10} />Colleagues</span>
            {colleaguesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
          {colleaguesOpen && (
            colleagues.length === 0 ? (
              <p className="px-2 py-1.5 text-[10px] text-[#4b5563] italic">No colleagues yet</p>
            ) : (
              colleagues.map((c) => (
                <div key={c.id} className="relative">
                  <button
                    onClick={() => setOpenPopover(openPopover === c.id ? null : c.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#141414] transition-colors mt-0.5 text-left">
                    <Avatar name={c.name} size={18} />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="text-[9px] text-[#4b5563] font-mono truncate">@{c.username}</span>
                  </button>
                  {openPopover === c.id && (
                    <ColleaguePopover colleague={c} onClose={() => setOpenPopover(null)} />
                  )}
                </div>
              ))
            )
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-[#1a1a1a] px-3 py-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-indigo-300">{user?.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#e5e7eb] truncate">{user?.name}</p>
          <p className="text-[10px] text-[#6b7280] truncate">@{user?.username}</p>
        </div>
        <button onClick={() => { logout(); navigate('/login') }}
          className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors p-1">
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { toasts, dismiss } = useNotifications()
  const shownRef = new Set<string>()
  toasts.forEach((t) => {
    if (!shownRef.has(t.id)) {
      shownRef.add(t.id)
      toast(t.message, { id: t.id, description: t.projectName ? `in ${t.projectName}` : undefined, onDismiss: () => dismiss(t.id) })
    }
  })
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><ProjectsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/my-tasks" element={<ProtectedRoute><AppLayout><MyTasksPage /></AppLayout></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><ProjectPage /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="bottom-right" theme="dark"
            toastOptions={{ style: { background: '#111111', border: '1px solid #2a2a2a', color: '#e5e7eb' } }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
