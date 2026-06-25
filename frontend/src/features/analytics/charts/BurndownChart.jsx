import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';
import { getBurndown } from '../../../services/api';

/**
 * Gráfico de burndown para un proyecto y rango de mes dado.
 *
 * @param {{ projectId: number, startDate: string, endDate: string, animate?: boolean }} props
 */
const BurndownChart = ({ projectId, startDate, endDate, animate = true }) => {
  const { data, isLoading } = useSWR(
    projectId ? ['/api/v1/metrics/burndown', projectId, startDate, endDate] : null,
    () => getBurndown(projectId, startDate, endDate),
    { shouldRetryOnError: false }
  );

  // Serie vacía: array vacío o todos los puntos con ideal=0 y real=0
  const isEmpty = !isLoading && (!data || data.length === 0 || data.every(p => p.ideal === 0 && p.real === 0));

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Burndown Chart</h4>

      {isEmpty ? (
        <div style={{ height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Sin tareas con fecha de entrega en este período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontSize: '13px', fontWeight: 500 }}
              labelStyle={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
            <Line type="monotone" dataKey="ideal" name="Ritmo Ideal" stroke="#cbd5e1" strokeWidth={2} dot={false} isAnimationActive={animate} />
            <Line type="monotone" dataKey="real" name="Progreso Real" stroke="#6366f1" strokeWidth={2} isAnimationActive={animate} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default BurndownChart;
