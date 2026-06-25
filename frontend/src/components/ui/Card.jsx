import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

/**
 * Superficie elevada del design system. `interactive` agrega hover/elevación
 * para tarjetas clickeables (proyectos, usuarios, tareas).
 * @param {{ interactive?: boolean }} props
 */
const Card = forwardRef(function Card(
  { interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface border border-border rounded-card shadow-soft',
        interactive &&
          'transition-all duration-150 cursor-pointer hover:border-accent hover:shadow-card',
        className,
      )}
      {...props}
    />
  )
})

export default Card
