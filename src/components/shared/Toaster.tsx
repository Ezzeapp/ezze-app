import { useState, useEffect, useCallback } from 'react'
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from '@/components/ui/toast'

export interface ToastMessage {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

type ToastListener = (toast: ToastMessage) => void
const listeners: ToastListener[] = []

export function toast(msg: Omit<ToastMessage, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const message: ToastMessage = { id, duration: 4000, variant: 'default', ...msg }
  listeners.forEach((l) => l(message))
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: 'success' })

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: 'destructive' })

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((t: ToastMessage) => {
    setToasts((prev) => [...prev, t])
    setTimeout(() => {
      setToasts((prev) => prev.filter((p) => p.id !== t.id))
    }, t.duration || 4000)
  }, [])

  useEffect(() => {
    listeners.push(addToast)
    return () => {
      const idx = listeners.indexOf(addToast)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [addToast])

  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant}>
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
