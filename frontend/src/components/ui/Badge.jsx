import { cn } from '../../lib/cn'

const TONES = {
  neutral: 'bg-raised text-muted border border-border',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-status-done/15 text-status-done',
  warning: 'bg-priority-medium/15 text-priority-medium',
  danger: 'bg-status-blocked/15 text-status-blocked',
}

/**
 * Etiqueta/pill del design system.
 * Para colores dinámicos (estado/prioridad) usar `style` con tokens var(--color-*)
 * o pasar `className` con la clase semántica correspondiente.
 * @param {{ tone?: keyof typeof TONES, dot?: boolean }} props
 */
export default function Badge({ tone = 'neutral', dot = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
