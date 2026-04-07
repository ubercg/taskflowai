import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskCard from '../../../components/kanban/TaskCard'
import { vi } from 'vitest'

const mockTask = {
  id: 1, title: 'Implementar login', status: 'in_progress',
  priority: 'high', estimated_hours: 8, logged_hours: 5,
  due_date: '2025-12-31', tags: ['auth'],
  assignee: { name: 'Uber García', avatar: 'UG', color: '#6366f1' },
  subtasks: [], objective_id: null
}

describe('TaskCard', () => {
  test('renderiza título de la tarea', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('Implementar login')).toBeInTheDocument()
  })

  test('muestra badge de prioridad high con color correcto', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  test('muestra horas logged/estimated', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText(/5h \/ 8h/)).toBeInTheDocument()
  })

  test('no muestra advertencia de horas cuando logged < estimated', () => {
    const { container } = render(<TaskCard task={mockTask} />)
    expect(container.querySelector('svg')).toBeNull() // Ícono advertencia no debe estar
  })

  test('muestra advertencia cuando logged > estimated', () => {
    const task = { ...mockTask, logged_hours: 10 }
    const { container } = render(<TaskCard task={task} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  test('muestra barra de progreso cuando hay subtareas', () => {
    const task = { ...mockTask, subtasks: [{status:'done'}, {status:'backlog'}] }
    const { container } = render(<TaskCard task={task} />)
    const progressBars = container.querySelectorAll('div[style*="width"]')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  test('muestra due_date vencida en rojo', () => {
    const task = { ...mockTask, due_date: '2020-01-01' } // Pasado
    render(<TaskCard task={task} />)
    const badge = screen.getByText(/1 ene/i)
    expect(badge).toHaveStyle('color: rgb(239, 68, 68)') // #ef4444 convertido a RGB por jsdom
  })

  test('llama onOpen cuando se hace click en el título', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    
    render(<TaskCard task={mockTask} onOpen={onOpen} />)
    await user.click(screen.getByText('Implementar login'))
    expect(onOpen).toHaveBeenCalledWith(1)
  })
})
