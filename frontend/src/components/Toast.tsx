import { Bell, X, CheckCircle } from 'lucide-react'
import type { ToastNotification as Toast } from '../hooks/useNotifications'

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl p-3.5
                     flex items-start gap-3 animate-in slide-in-from-right-5 duration-200"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-900/50 border border-indigo-700/40
                          flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bell size={13} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#e5e7eb] leading-relaxed">
              {toast.message}
            </p>
            {toast.projectName && (
              <p className="text-xs text-[#6b7280] mt-0.5 truncate">
                in {toast.projectName}
              </p>
            )}
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

// Inline success toast for bulk actions
export function InlineToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40
                    text-emerald-400 text-xs px-3 py-2 rounded">
      <CheckCircle size={13} />
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-auto text-emerald-600 hover:text-emerald-400">
        <X size={12} />
      </button>
    </div>
  )
}
