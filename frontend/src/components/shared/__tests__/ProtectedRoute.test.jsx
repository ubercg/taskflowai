import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock del authStore
vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn(),
  useAuth: vi.fn()
}))

import { useAuthStore, useAuth } from '../../../store/authStore'
import ProtectedRoute from '../ProtectedRoute'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const renderWithRouter = (ui, { initialEntries = ['/'] } = {}) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('redirige a /login si no está autenticado', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    renderWithRouter(<ProtectedRoute><div>Protected</div></ProtectedRoute>)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  test('muestra children si está autenticado sin restricción de rol', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true, user: { role: 'developer' }
    })
    renderWithRouter(<ProtectedRoute><div>Contenido</div></ProtectedRoute>)
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  test('redirige a /unauthorized si el rol no tiene permiso', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true, user: { role: 'developer' }
    })
    renderWithRouter(<ProtectedRoute roles={['admin']}><div>Admin</div></ProtectedRoute>)
    expect(screen.getByText('Unauthorized')).toBeInTheDocument()
  })

  test('permite acceso si el rol está en la lista permitida', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true, user: { role: 'manager' }
    })
    renderWithRouter(
      <ProtectedRoute roles={['admin','manager']}><div>Manager OK</div></ProtectedRoute>
    )
    expect(screen.getByText('Manager OK')).toBeInTheDocument()
  })
})
