import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import UserFormModal from '../UserFormModal'
import api from '../../../services/api/client'
import i18n from '../../../i18n'

vi.mock('swr', () => ({ default: () => ({ mutate: vi.fn() }) }))

vi.mock('../../../services/api/client', () => ({
  default: { post: vi.fn(), patch: vi.fn() }
}))

describe('UserFormModal', () => {
  test('renderiza formulario vacío en modo crear (user=null)', () => {
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText(i18n.t('users.form.createTitle'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(i18n.t('users.form.name.placeholder'))).toHaveValue('')
    expect(screen.getByPlaceholderText(i18n.t('users.form.email.placeholder'))).toHaveValue('')
  })

  test('rellena campos cuando recibe user existente (modo editar)', () => {
    const user = { id: 1, name: 'Uber', email: 'uber@test.com', role: 'admin', color: '#6366f1' }
    render(<UserFormModal user={user} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText(i18n.t('users.form.editTitle'))).toBeInTheDocument()
    expect(screen.getByDisplayValue('Uber')).toBeInTheDocument()
    expect(screen.getByDisplayValue('uber@test.com')).toBeInTheDocument()
  })

  test('genera iniciales automáticamente al escribir el nombre', async () => {
    const user = userEvent.setup()
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)
    const nameInput = screen.getByPlaceholderText(i18n.t('users.form.name.placeholder'))
    await user.type(nameInput, 'Juan Pérez')
    expect(screen.getByText('JP')).toBeInTheDocument()
  })

  test('muestra error de validación cuando email está vacío al submit', async () => {
    const userEventSetup = userEvent.setup()
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)

    await userEventSetup.type(screen.getByPlaceholderText(i18n.t('users.form.name.placeholder')), 'Test Name')
    await userEventSetup.click(screen.getByRole('button', { name: i18n.t('users.form.create') }))

    expect(screen.getByText(i18n.t('users.form.errors.emailRequired'))).toBeInTheDocument()
  })

  test('llama POST en modo crear al hacer submit válido', async () => {
    const userEventSetup = userEvent.setup()
    api.post.mockResolvedValueOnce({ data: { id: 1 } })
    render(<UserFormModal user={null} onClose={() => {}} onSaved={() => {}} />)

    await userEventSetup.type(screen.getByPlaceholderText(i18n.t('users.form.name.placeholder')), 'Nuevo User')
    await userEventSetup.type(screen.getByPlaceholderText(i18n.t('users.form.email.placeholder')), 'test@test.com')
    await userEventSetup.click(screen.getByRole('button', { name: i18n.t('users.form.create') }))

    expect(api.post).toHaveBeenCalled()
  })

  test('llama PATCH en modo editar', async () => {
    const userEventSetup = userEvent.setup()
    const user = { id: 1, name: 'Uber', email: 'uber@test.com', role: 'admin', color: '#6366f1' }
    api.patch.mockResolvedValueOnce({ data: { id: 1 } })

    render(<UserFormModal user={user} onClose={() => {}} onSaved={() => {}} />)

    await userEventSetup.clear(screen.getByDisplayValue('Uber'))
    await userEventSetup.type(screen.getByPlaceholderText(i18n.t('users.form.name.placeholder')), 'Uber Modificado')
    await userEventSetup.click(screen.getByRole('button', { name: i18n.t('users.form.saveChanges') }))

    expect(api.patch).toHaveBeenCalled()
  })
})
