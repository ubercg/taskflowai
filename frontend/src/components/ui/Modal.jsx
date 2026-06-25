import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

/**
 * Diálogo centrado con backdrop difuminado. Cierra con Escape o click afuera.
 * @param {{ open: boolean, onClose: () => void, className?: string }} props
 */
export default function Modal({ open, onClose, className, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full max-w-lg max-h-[90vh] overflow-y-auto',
          'bg-surface border border-border rounded-card shadow-overlay',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
