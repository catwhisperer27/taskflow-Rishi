import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'

// ── Badge ─────────────────────────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  todo: 'bg-[#1a1a1a] text-[#6b7280] border border-[#2a2a2a]',
  in_progress: 'bg-indigo-950/40 text-indigo-400 border border-indigo-800/40',
  done: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40',
}
const priorityStyles: Record<string, string> = {
  low: 'bg-[#1a1a1a] text-[#6b7280] border border-[#2a2a2a]',
  medium: 'bg-amber-950/40 text-amber-400 border border-amber-800/40',
  high: 'bg-red-950/40 text-red-400 border border-red-800/40',
}

export function StatusBadge({ status }: { status: string }) {
  const label = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-sm ${statusStyles[status] ?? 'bg-[#1a1a1a] text-[#6b7280]'}`}>
      {label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded-sm ${priorityStyles[priority] ?? 'bg-[#1a1a1a] text-[#6b7280]'}`}>
      {priority}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-[#6b7280]" />
}

// ── Error message ─────────────────────────────────────────────────────────────

export function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
      <AlertCircle size={14} />
      <span>{message}</span>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}

export function Modal({ title, onClose, children, width = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl w-full ${width}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e5e7eb]">{title}</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors rounded p-0.5 hover:bg-[#2a2a2a]">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode; title: string; description: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-[#333] mb-3">{icon}</div>
      <p className="text-sm font-medium text-[#e5e7eb] mb-1">{title}</p>
      <p className="text-xs text-[#6b7280] mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#9ca3af]">{label}</label>}
      <input
        {...props}
        className={`w-full bg-[#1a1a1a] border ${error ? 'border-red-500/60' : 'border-[#2a2a2a]'} 
          text-[#e5e7eb] text-sm rounded px-3 py-2 placeholder:text-[#6b7280]
          focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30
          transition-colors disabled:opacity-40 ${className}`}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#9ca3af]">{label}</label>}
      <select
        {...props}
        className={`w-full bg-[#1a1a1a] border ${error ? 'border-red-500/60' : 'border-[#2a2a2a]'}
          text-[#e5e7eb] text-sm rounded px-3 py-2
          focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30
          transition-colors disabled:opacity-40 ${className}`}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[#9ca3af]">{label}</label>}
      <textarea
        {...props}
        className={`w-full bg-[#1a1a1a] border ${error ? 'border-red-500/60' : 'border-[#2a2a2a]'}
          text-[#e5e7eb] text-sm rounded px-3 py-2 placeholder:text-[#6b7280] resize-none
          focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30
          transition-colors disabled:opacity-40 ${className}`}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#111111] border border-[#1a1a1a] rounded-md">
      <div className="w-3 h-3 rounded-full bg-[#222] animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#222] rounded animate-pulse w-2/3" />
        <div className="h-2.5 bg-[#1a1a1a] rounded animate-pulse w-1/3" />
      </div>
      <div className="h-4 w-12 bg-[#222] rounded-sm animate-pulse" />
      <div className="h-4 w-10 bg-[#1a1a1a] rounded-sm animate-pulse" />
    </div>
  )
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1
                      bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] text-[#e5e7eb]
                      whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none
                      transition-opacity z-50 shadow-xl">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a2a2a]" />
      </div>
    </div>
  )
}
