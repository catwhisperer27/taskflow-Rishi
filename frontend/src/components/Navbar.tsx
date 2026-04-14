import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Layers } from 'lucide-react'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-12 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center px-4 gap-4 sticky top-0 z-40">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-[#e5e7eb] hover:text-white transition-colors"
      >
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
          <Layers size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">TaskFlow</span>
      </button>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center">
              <span className="text-xs font-medium text-indigo-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-[#9ca3af] hidden sm:block">{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#e5e7eb] transition-colors px-2 py-1 rounded hover:bg-[#1a1a1a]"
          >
            <LogOut size={13} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      )}
    </header>
  )
}
