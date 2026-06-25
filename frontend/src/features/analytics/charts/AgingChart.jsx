import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useSWR from 'swr';
import { getAgingMetrics } from '../../../services/api';
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
        <h4 className={CHART_TITLE}>Aging (Horas promedio por Status)</h4>
        <div className="flex h-[80%] flex-col items-center justify-center gap-2 text-center text-[13px] text-faint">
          <span className="text-xl">ℹ️</span>
          <span>El aging solo está disponible para el mes actual.</span>
          <span className="text-xs">Seleccioná el mes en curso para ver datos de aging.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={CHART_CARD}>
      <h4 className={CHART_TITLE}>Aging (Horas promedio por Status)</h4>
      {chartData.length === 0 ? (
        <div className={CHART_EMPTY}>No hay datos de aging disponibles.</div>
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
              tickFormatter={(val) => val.replace('_', ' ').toUpperCase()}
            />
            <Tooltip cursor={{ fill: c.cursor }} {...tooltipStyles(c)} formatter={(value) => [`${value} hrs`, 'Promedio']} />
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
