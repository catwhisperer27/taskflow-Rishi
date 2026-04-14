import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

export interface ToastNotification {
  id: string
  message: string
  taskTitle?: string
  projectName?: string
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/v1'

export function useNotifications() {
  const { token } = useAuth()
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const esRef = useRef<EventSource | null>(null)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!token) return

    const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data)
        const notification: ToastNotification = {
          id: crypto.randomUUID(),
          message: data.message,
          taskTitle: data.task_title,
          projectName: data.project_name,
        }
        setToasts((prev) => [...prev.slice(-4), notification])
        setTimeout(() => dismiss(notification.id), 5000)
      } catch {
        // ignore
      }
    })

    es.onerror = () => es.close()

    return () => { es.close(); esRef.current = null }
  }, [token, dismiss])

  return { toasts, dismiss }
}
