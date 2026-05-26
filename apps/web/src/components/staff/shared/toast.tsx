"use client"

import { X } from "lucide-react"
import { createContext, useCallback, useContext, useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

interface Toast {
  id: string
  message: string
  variant: "success" | "error"
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    setMounted(true)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...t, id }])
      const timer = setTimeout(() => removeToast(id), 3500)
      timersRef.current.set(id, timer)
    },
    [removeToast],
  )

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                t.variant === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToastNotify() {
  try {
    return useToast()
  } catch {
    return { toast: (_: Omit<Toast, "id">) => {} }
  }
}
