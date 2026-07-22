import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import TaskFormModal from '../TaskFormModal'
import i18n from '../../../i18n'

vi.mock('swr', () => ({ default: () => ({ data: undefined }) }))

vi.mock('../../../store/authStore', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Test User' } }),
}))

vi.mock('../../../services/api/client', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
}))

vi.mock('../../../services/api', () => ({
  createTask: vi.fn(),
}))

import { createTask } from '../../../services/api'

/**
 * The invalid-title highlight used to be driven by error?.includes('título'),
 * i.e. UI logic branching on the Spanish text of a message. Translating that
 * message to English made the check false and the field silently stopped
 * turning red — a fault only visible in one language, which no string-level
 * test would catch (see TaskFormModal.jsx history / BIT-014).
 *
 * These assert the behaviour, not the copy, so they stay meaningful whatever
 * the wording becomes and in whichever locale.
 */
describe('TaskFormModal — invalid title highlight', () => {
  const noop = () => {}

  const submit = () =>
    fireEvent.click(screen.getByRole('button', { name: i18n.t('tasks.form.create') }))

  const titleInput = () =>
    screen.getByPlaceholderText(i18n.t('tasks.form.title.placeholder'))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('does not highlight the title field before submitting', () => {
    render(<TaskFormModal projectId={1} onClose={noop} onCreated={noop} />)
    expect(titleInput().className).not.toContain('border-status-blocked')
  })

  it('highlights the title field when submitted empty', () => {
    render(<TaskFormModal projectId={1} onClose={noop} onCreated={noop} />)
    submit()
    expect(titleInput().className).toContain('border-status-blocked')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('highlights the title field in English too', async () => {
    await i18n.changeLanguage('en')
    render(<TaskFormModal projectId={1} onClose={noop} onCreated={noop} />)
    submit()
    // The old error?.includes('título') check returned false here, so the
    // field stayed unstyled while Spanish worked. This is the regression.
    expect(titleInput().className).toContain('border-status-blocked')
  })

  it('clears the highlight once a title is provided and resubmitted', () => {
    render(<TaskFormModal projectId={1} onClose={noop} onCreated={noop} />)
    submit()
    expect(titleInput().className).toContain('border-status-blocked')

    fireEvent.change(titleInput(), { target: { value: 'Escribir tests' } })
    submit()
    expect(titleInput().className).not.toContain('border-status-blocked')
  })
})
