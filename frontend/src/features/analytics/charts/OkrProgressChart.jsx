import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';
import { getObjectives } from '../../../services/api';
import { useChartColors, tooltipStyles, CHART_CARD, CHART_TITLE, CHART_EMPTY } from './chartTheme';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

const OkrProgressChart = ({ projectId, animate = true, forceTheme }) => {
  const c = useChartColors(forceTheme);
  const { data, error } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null,
    () => getObjectives(projectId),
    { shouldRetryOnError: false },
  );

  const chartData = data && !error && data.length > 0
    ? data.map((obj, i) => ({
        name: obj.title,
        progress: obj.progress || 0,
        fill: COLORS[i % COLORS.length],
      }))
    : [];

  return (
    <div className={CHART_CARD}>
      <h4 className={CHART_TITLE}>Progreso de Objetivos (OKRs)</h4>
      {chartData.length === 0 ? (
        <div className={CHART_EMPTY}>No hay objetivos definidos.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={12} data={chartData} startAngle={90} endAngle={-270}>
            <RadialBar minAngle={15} background clockWise dataKey="progress" cornerRadius={10} isAnimationActive={animate} />
            <Tooltip {...tooltipStyles(c)} formatter={(value) => [`${value}%`, 'Completado']} />
            <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', color: c.fg, lineHeight: '24px' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default OkrProgressChart;
