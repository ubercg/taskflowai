import { useTranslation } from 'react-i18next'
import { useLocale } from '../../store/localeStore'
import { SUPPORTED_LOCALES } from '../../i18n'
import { cn } from '../../lib/cn'

/**
 * Compact language switcher for login + authenticated layout (TSK-018 / RN-001).
 */
const LanguageSelector = ({ className }) => {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()

  return (
    <div
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-canvas p-0.5', className)}
      role="group"
      aria-label={t('common.language')}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = locale === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-raised hover:text-fg',
            )}
          >
            {t(`language.${code}`)}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageSelector
