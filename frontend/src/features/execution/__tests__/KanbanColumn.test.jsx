import { render, screen } from '@testing-library/react'
import KanbanColumn from '../KanbanColumn'
import { DragDropContext } from '@hello-pangea/dnd'

const renderWithDnd = (ui) => {
  return render(
    <DragDropContext onDragEnd={() => {}}>
      {ui}
    </DragDropContext>
  )
}

describe('KanbanColumn', () => {
  test('renderiza el título de la columna', () => {
    renderWithDnd(<KanbanColumn columnId="todo" title="To Do" tasks={[]} />)
    expect(screen.getByText('To Do')).toBeInTheDocument()
  })

  test('muestra badge WIP N/3 en columna in_progress', () => {
    renderWithDnd(<KanbanColumn columnId="in_progress" title="In Progress" tasks={[]} wipCount={2} wipLimit={3} />)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  test('badge WIP es rojo cuando wip >= límite', () => {
    renderWithDnd(<KanbanColumn columnId="in_progress" title="In Progress" tasks={[]} wipCount={3} wipLimit={3} />)
    const badge = screen.getByText('3/3')
    expect(badge).toHaveStyle('color: rgb(239, 68, 68)')
  })

  test('badge WIP es gris/normal cuando wip < límite', () => {
    renderWithDnd(<KanbanColumn columnId="in_progress" title="In Progress" tasks={[]} wipCount={1} wipLimit={3} />)
    const badge = screen.getByText('1/3')
    expect(badge).toHaveStyle('color: rgb(100, 116, 139)')
  })

  test('muestra badge de bottleneck cuando is_bottleneck es true', () => {
    const bottleneck = { is_bottleneck: true, avg_hours: 50 }
    renderWithDnd(<KanbanColumn columnId="in_progress" title="In Progress" tasks={[]} bottleneck={bottleneck} />)
    expect(screen.getByText(/Aging 50h promedio/i)).toBeInTheDocument()
  })

  test('no muestra badge bottleneck cuando is_bottleneck es false', () => {
    const bottleneck = { is_bottleneck: false, avg_hours: 10 }
    renderWithDnd(<KanbanColumn columnId="in_progress" title="In Progress" tasks={[]} bottleneck={bottleneck} />)
    expect(screen.queryByText(/Aging/i)).not.toBeInTheDocument()
  })
})
