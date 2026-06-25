import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useSWR from 'swr';
import { getVelocity } from '../../../services/api';

/**
 * Gráfico de velocity por usuario para un proyecto y rango de mes dado.
 *
 * @param {{ projectId: number, startDate: string, endDate: string }} props
 */
const VelocityChart = ({ projectId, startDate, endDate }) => {
  const { data, error, isLoading } = useSWR(
    projectId ? ['/api/v1/metrics/velocity', projectId, startDate, endDate] : null,
    () => getVelocity(projectId, startDate, endDate),
    { shouldRetryOnError: false }
  );

  const chartData = data || [];
  const isEmpty = !isLoading && !error && chartData.length === 0;

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Velocity por Usuario</h4>

      {isEmpty ? (
        <div style={{ height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Sin datos de velocity para este período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="completed" name="Tareas completadas" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default VelocityChart;
