import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

/**
 * Panel lateral que entra desde la derecha. Cierra con Escape o click en el backdrop.
 * @param {{ open: boolean, onClose: () => void, width?: string, className?: string }} props
 */
export default function Drawer({ open, onClose, width = 'max-w-md', className, children }) {
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
      className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'h-full w-full overflow-y-auto bg-surface border-l border-border shadow-overlay',
          'animate-[drawer-in_0.2s_ease-out]',
          width,
          className,
        )}
      >
        {children}
      </aside>
    </div>,
    document.body,
  )
}
