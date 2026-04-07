import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useSWR from 'swr';
import { getVelocityMetrics } from '../../../services/api';

const mockVelocityData = [
  { name: 'Alice', completed: 15, color: '#ec4899' },
  { name: 'Bob', completed: 8, color: '#3b82f6' },
  { name: 'Charlie', completed: 12, color: '#10b981' },
  { name: 'Diana', completed: 5, color: '#8b5cf6' },
];

const VelocityChart = ({ projectId }) => {
  const { data, error } = useSWR('/api/v1/metrics/velocity', getVelocityMetrics, { shouldRetryOnError: false });
  const chartData = (data && !error && data.length > 0) ? data : mockVelocityData;

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Velocity por Usuario</h4>
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
    </div>
  );
};

export default VelocityChart;
