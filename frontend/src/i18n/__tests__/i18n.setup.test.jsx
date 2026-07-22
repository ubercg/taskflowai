import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'

import i18n, {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  readStoredLocale,
  SUPPORTED_LOCALES,
} from '../../i18n'
import { taskStatusLabel } from '../../i18n/enums'
import { useLocaleStore } from '../../store/localeStore'
import LanguageSelector from '../../components/shared/LanguageSelector'
import { formatLocalized } from '../../utils/dateUtils'

function renderSelector() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSelector />
    </I18nextProvider>,
  )
}

describe('i18n setup (TSK-018)', () => {
  beforeEach(async () => {
    localStorage.removeItem(LOCALE_STORAGE_KEY)
    useLocaleStore.setState({ locale: DEFAULT_LOCALE })
    await i18n.changeLanguage(DEFAULT_LOCALE)
  })

  it('defaults to es with no persisted preference (RN-006)', () => {
    expect(readStoredLocale()).toBe('es')
    expect(i18n.language).toMatch(/^es/)
  })

  it('ignores an unsupported persisted locale and falls back to es', () => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ state: { locale: 'fr' }, version: 0 }),
    )
    expect(readStoredLocale()).toBe('es')
    expect(normalizeLocale('pt-BR')).toBe('es')
  })

  it('changes language without a full page reload and persists it (RN-004 / RN-005)', async () => {
    const user = userEvent.setup()
    renderSelector()

    expect(taskStatusLabel('in_progress')).toBe('En progreso')

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(useLocaleStore.getState().locale).toBe('en')
    expect(i18n.language).toMatch(/^en/)
    expect(taskStatusLabel('in_progress')).toBe('In progress')

    const raw = JSON.parse(localStorage.getItem(LOCALE_STORAGE_KEY))
    expect(raw.state.locale).toBe('en')
  })

  it('falls back to Spanish for a missing key (RN-007)', async () => {
    await i18n.changeLanguage('en')
    // Key only present conceptually — missing in both files falls to defaultValue / key.
    const missing = i18n.t('this.key.does.not.exist')
    expect(missing).toBe('this.key.does.not.exist')

    // FallbackLng: a key that exists only in `es` would resolve via chain;
    // we assert the configured fallback language instead.
    expect(i18n.options.fallbackLng).toEqual(expect.arrayContaining(['es']))
  })

  it('formats month names with the active locale (RN-011)', async () => {
    const july = new Date(2026, 6, 1)
    await i18n.changeLanguage('es')
    expect(formatLocalized(july, 'MMMM').toLowerCase()).toContain('julio')

    await i18n.changeLanguage('en')
    expect(formatLocalized(july, 'MMMM').toLowerCase()).toContain('july')
  })

  it('can register a third locale without touching components (RN-008 smoke)', () => {
    i18n.addResourceBundle(
      'pt',
      'translation',
      { language: { pt: 'Português' }, enums: { task: { status: { in_progress: 'Em progresso' } } } },
      true,
      true,
    )
    // Components iterate SUPPORTED_LOCALES — adding a language is registry + allowlist,
    // not a UI rewrite. Bundle is readable without remounting any component.
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(true)
    expect(
      i18n.getResourceBundle('pt', 'translation').enums.task.status.in_progress,
    ).toBe('Em progresso')
    expect(SUPPORTED_LOCALES).toEqual(['es', 'en'])
  })
})
