import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

const FIELD_BASE =
  'w-full bg-canvas text-fg placeholder:text-faint border border-border rounded-input ' +
  'px-3 py-2 text-sm outline-none transition-colors duration-150 ' +
  'focus:border-accent focus:ring-2 focus:ring-accent-soft ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(FIELD_BASE, className)}
      {...props}
    />
  )
})

export { FIELD_BASE }
export default Input
