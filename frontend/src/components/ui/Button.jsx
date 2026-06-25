import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover shadow-soft',
  secondary:
    'bg-surface text-fg border border-border hover:bg-raised',
  ghost:
    'bg-transparent text-muted hover:bg-raised hover:text-fg',
  destructive:
    'bg-status-blocked text-white hover:opacity-90 shadow-soft',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0',
}

/**
 * Botón base del design system.
 * @param {{ variant?: keyof typeof VARIANTS, size?: keyof typeof SIZES }} props
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-input font-medium',
        'transition-colors duration-150 outline-none cursor-pointer',
        'focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})

export default Button
