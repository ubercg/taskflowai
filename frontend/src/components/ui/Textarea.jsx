import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { FIELD_BASE } from './Input'

const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(FIELD_BASE, 'resize-y leading-relaxed', className)}
      {...props}
    />
  )
})

export default Textarea
