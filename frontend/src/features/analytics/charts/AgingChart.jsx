import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getAgingMetrics } from '../../../services/api';
import { taskStatusLabel } from '../../../i18n/enums';
import { useChartColors, tooltipStyles, CHART_CARD, CHART_TITLE, CHART_EMPTY } from './chartTheme';

// Color por aging (semántico: verde/amarillo/rojo, válido en ambos temas).
const getColor = (hours) => {
  if (hours < 24) return '#4ade80';
  if (hours <= 72) return '#facc15';
  return '#f87171';
};

/**
 * Gráfico de aging por status.
 * El aging es point-in-time (NOW) y solo es significativo para el mes actual.
 *
 * @param {{ projectId: number, isCurrentMonth: boolean, animate?: boolean }} props
 */
const AgingChart = ({ projectId, isCurrentMonth = true, animate = true, forceTheme }) => {
  const { t } = useTranslation();
  const c = useChartColors(forceTheme);
  const { data } = useSWR(
    projectId && isCurrentMonth ? ['/api/v1/metrics/aging', projectId] : null,
    () => getAgingMetrics(projectId),
    { shouldRetryOnError: false },
  );

  const chartData = data || [];

  if (!isCurrentMonth) {
    return (
      <div className={CHART_CARD}>
        <h4 className={CHART_TITLE}>{t('metrics.charts.aging.title')}</h4>
        <div className="flex h-[80%] flex-col items-center justify-center gap-2 text-center text-[13px] text-faint">
          <span className="text-xl" aria-hidden="true">ℹ️</span>
          <span>{t('metrics.charts.aging.onlyCurrentMonth')}</span>
          <span className="text-xs">{t('metrics.charts.aging.selectCurrentMonthHint')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={CHART_CARD}>
      <h4 className={CHART_TITLE}>{t('metrics.charts.aging.title')}</h4>
      {chartData.length === 0 ? (
        <div className={CHART_EMPTY}>{t('metrics.charts.aging.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
            <XAxis type="number" stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="status"
              type="category"
              stroke={c.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={80}
              tickFormatter={(val) => taskStatusLabel(val).toUpperCase()}
            />
            <Tooltip
              cursor={{ fill: c.cursor }}
              {...tooltipStyles(c)}
              formatter={(value) => [t('metrics.charts.aging.tooltipValue', { value }), t('metrics.charts.aging.tooltipAverage')]}
            />
            <Bar dataKey="avg_hours" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={animate}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.avg_hours)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default AgingChart;
