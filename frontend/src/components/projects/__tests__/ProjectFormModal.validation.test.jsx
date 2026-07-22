import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import ProjectFormModal from '../ProjectFormModal'
import i18n from '../../../i18n'

vi.mock('swr', () => ({ default: () => ({ mutate: vi.fn() }) }))

vi.mock('../../../services/api/client', () => ({
  default: { post: vi.fn(), patch: vi.fn() },
}))

import api from '../../../services/api/client'

/**
 * The invalid-name highlight used to be driven by error?.includes('nombre'),
 * i.e. UI logic branching on the Spanish text of a message. Translating that
 * message to English made the check false and the field silently stopped
 * turning red — a fault only visible in one language, which no string-level
 * test would catch.
 *
 * These assert the behaviour, not the copy, so they stay meaningful whatever
 * the wording becomes and in whichever locale.
 */
describe('ProjectFormModal — invalid name highlight', () => {
  const noop = () => {}

  const submit = () =>
    fireEvent.click(screen.getByRole('button', { name: i18n.t('projects.form.create') }))

  const nameInput = () =>
    screen.getByPlaceholderText(i18n.t('projects.form.name.placeholder'))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('does not highlight the name field before submitting', () => {
    render(<ProjectFormModal project={null} onClose={noop} onSaved={noop} />)
    expect(nameInput().className).not.toContain('border-status-blocked')
  })

  it('highlights the name field when submitted empty', () => {
    render(<ProjectFormModal project={null} onClose={noop} onSaved={noop} />)
    submit()
    expect(nameInput().className).toContain('border-status-blocked')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('highlights the name field in English too', async () => {
    await i18n.changeLanguage('en')
    render(<ProjectFormModal project={null} onClose={noop} onSaved={noop} />)
    submit()
    // The old error?.includes('nombre') check returned false here, so the
    // field stayed unstyled while Spanish worked. This is the regression.
    expect(nameInput().className).toContain('border-status-blocked')
  })

  it('clears the highlight once a name is provided and resubmitted', () => {
    render(<ProjectFormModal project={null} onClose={noop} onSaved={noop} />)
    submit()
    expect(nameInput().className).toContain('border-status-blocked')

    fireEvent.change(nameInput(), { target: { value: 'Lanzamiento V2' } })
    submit()
    expect(nameInput().className).not.toContain('border-status-blocked')
  })
})
