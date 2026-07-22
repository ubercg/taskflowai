import { useTranslation } from 'react-i18next';
import { addMonths, subMonths } from 'date-fns';
import { formatLocalized } from '../../utils/dateUtils';
import { useLocale } from '../../store/localeStore';

/**
 * Selector de mes para el dashboard de métricas.
 *
 * @param {{ value: Date, onChange: (date: Date) => void }} props
 */
const MonthSelector = ({ value, onChange }) => {
  const { t } = useTranslation();
  // Re-render when locale changes so month names follow i18n (TSK-018).
  useLocale();

  const handlePrev = () => onChange(subMonths(value, 1));
  const handleNext = () => onChange(addMonths(value, 1));

  const label = formatLocalized(value, 'MMMM yyyy');
  const navBtn =
    'rounded-md border border-border px-3 py-1.5 text-base leading-none text-muted transition-colors hover:bg-raised hover:text-fg';

  return (
    <div className="flex items-center gap-3">
      <button aria-label={t('calendar.view.prevMonth')} onClick={handlePrev} className={navBtn}>‹</button>
      <span className="min-w-[140px] text-center text-[15px] font-semibold capitalize text-fg">{label}</span>
      <button aria-label={t('calendar.view.nextMonth')} onClick={handleNext} className={navBtn}>›</button>
    </div>
  );
};

export default MonthSelector;
