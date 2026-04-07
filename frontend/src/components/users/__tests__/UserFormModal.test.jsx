import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import UserFormModal from '../UserFormModal'
import api from '../../../services/api/client'

vi.mock('swr', () => ({ default: () => ({ mutate: vi.fn() }) }))

vi.mock('../../../services/api/client', () => ({
  default: { post: vi.fn(), patch: vi.fn() }
}))

describe('UserFormModal', () => {
  test('renderiza formulario vacío en modo crear (user=null)', () => {
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('Nuevo Usuario')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Jane Doe/i)).toHaveValue('')
    expect(screen.getByPlaceholderText(/jane@example.com/i)).toHaveValue('')
  })

  test('rellena campos cuando recibe user existente (modo editar)', () => {
    const user = { id: 1, name: 'Uber', email: 'uber@test.com', role: 'admin', color: '#6366f1' }
    render(<UserFormModal user={user} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('Editar Usuario')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Uber')).toBeInTheDocument()
    expect(screen.getByDisplayValue('uber@test.com')).toBeInTheDocument()
  })

  test('genera iniciales automáticamente al escribir el nombre', async () => {
    const user = userEvent.setup()
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    const nameInput = screen.getByPlaceholderText(/Jane Doe/i)
    await user.type(nameInput, 'Juan Pérez')
    expect(screen.getByText('JP')).toBeInTheDocument()
  })

  test('muestra error de validación cuando email está vacío al submit', async () => {
    const userEventSetup = userEvent.setup()
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    
    await userEventSetup.type(screen.getByPlaceholderText(/Jane Doe/i), 'Test Name')
    await userEventSetup.click(screen.getByRole('button', { name: /Crear Usuario/i }))
    
    expect(screen.getByText(/El email es obligatorio/i)).toBeInTheDocument()
  })

  test('llama POST en modo crear al hacer submit válido', async () => {
    const userEventSetup = userEvent.setup()
    api.post.mockResolvedValueOnce({ data: { id: 1 } })
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    
    await userEventSetup.type(screen.getByPlaceholderText(/Jane Doe/i), 'Nuevo User')
    await userEventSetup.type(screen.getByPlaceholderText(/jane@example.com/i), 'test@test.com')
    await userEventSetup.click(screen.getByRole('button', { name: /Crear Usuario/i }))
    
    expect(api.post).toHaveBeenCalled()
  })

  test('llama PATCH en modo editar', async () => {
    const userEventSetup = userEvent.setup()
    const user = { id: 1, name: 'Uber', email: 'uber@test.com', role: 'admin', color: '#6366f1' }
    api.patch.mockResolvedValueOnce({ data: { id: 1 } })
    
    render(<UserFormModal user={user} onClose={() => {}} onSaved={() => {}} />)
    
    await userEventSetup.clear(screen.getByDisplayValue('Uber'))
    await userEventSetup.type(screen.getByPlaceholderText(/Jane Doe/i), 'Uber Modificado')
    await userEventSetup.click(screen.getByRole('button', { name: /Guardar Cambios/i }))
    
    expect(api.patch).toHaveBeenCalled()
  })
})
