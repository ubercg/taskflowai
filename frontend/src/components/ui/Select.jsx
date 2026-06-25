import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { FIELD_BASE } from './Input'

const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(FIELD_BASE, 'cursor-pointer appearance-none pr-8', className)}
      {...props}
    >
      {children}
    </select>
  )
})

export default Select
