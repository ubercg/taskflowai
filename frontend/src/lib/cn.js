import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases condicionales (clsx) y resuelve conflictos de utilidades
 * de Tailwind (tailwind-merge). Es la base del design system: las primitivas
 * en components/ui/ usan cn() para componer variantes sin pisar estilos.
 *
 * @param  {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
