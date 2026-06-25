import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useSWR from 'swr';
import { getVelocity } from '../../../services/api';
import { useChartColors, tooltipStyles, CHART_CARD, CHART_TITLE, CHART_EMPTY } from './chartTheme';

/**
 * Gráfico de velocity por usuario para un proyecto y rango de mes dado.
 *
 * @param {{ projectId: number, startDate: string, endDate: string, animate?: boolean }} props
 */
const VelocityChart = ({ projectId, startDate, endDate, animate = true, forceTheme }) => {
  const c = useChartColors(forceTheme);
  const { data, error, isLoading } = useSWR(
    projectId ? ['/api/v1/metrics/velocity', projectId, startDate, endDate] : null,
    () => getVelocity(projectId, startDate, endDate),
    { shouldRetryOnError: false },
  );

  const chartData = data || [];
  const isEmpty = !isLoading && !error && chartData.length === 0;

  return (
    <div className={CHART_CARD}>
      <h4 className={CHART_TITLE}>Velocity por Usuario</h4>

      {isEmpty ? (
        <div className={CHART_EMPTY}>Sin datos de velocity para este período.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
            <XAxis dataKey="name" stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: c.cursor }} {...tooltipStyles(c)} />
            <Bar dataKey="completed" name="Tareas completadas" radius={[4, 4, 0, 0]} isAnimationActive={animate}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || c.accent} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default VelocityChart;
