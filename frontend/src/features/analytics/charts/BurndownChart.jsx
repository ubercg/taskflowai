import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getBurndown } from '../../../services/api';
import { useChartColors, tooltipStyles, CHART_CARD, CHART_TITLE, CHART_EMPTY } from './chartTheme';

/**
 * Gráfico de burndown para un proyecto y rango de mes dado.
 *
 * @param {{ projectId: number, startDate: string, endDate: string, animate?: boolean }} props
 */
const BurndownChart = ({ projectId, startDate, endDate, animate = true, forceTheme }) => {
  const { t } = useTranslation();
  const c = useChartColors(forceTheme);
  const { data, isLoading } = useSWR(
    projectId ? ['/api/v1/metrics/burndown', projectId, startDate, endDate] : null,
    () => getBurndown(projectId, startDate, endDate),
    { shouldRetryOnError: false },
  );

  const isEmpty = !isLoading && (!data || data.length === 0 || data.every((p) => p.ideal === 0 && p.real === 0));

  return (
    <div className={CHART_CARD}>
      <h4 className={CHART_TITLE}>{t('metrics.charts.burndown.title')}</h4>

      {isEmpty ? (
        <div className={CHART_EMPTY}>{t('metrics.charts.burndown.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
            <XAxis dataKey="date" stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyles(c)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
            <Line type="monotone" dataKey="ideal" name={t('metrics.charts.burndown.idealLine')} stroke={c.ideal} strokeWidth={2} dot={false} isAnimationActive={animate} />
            <Line type="monotone" dataKey="real" name={t('metrics.charts.burndown.realLine')} stroke={c.accent} strokeWidth={2} isAnimationActive={animate} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default BurndownChart;
