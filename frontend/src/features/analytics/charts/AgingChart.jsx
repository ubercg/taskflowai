import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useSWR from 'swr';
import { getAgingMetrics } from '../../../services/api';

const getColor = (hours) => {
  if (hours < 24) return '#4ade80'; // Verde
  if (hours <= 72) return '#facc15'; // Amarillo
  return '#f87171'; // Rojo
};

const AgingChart = () => {
  const { data, error } = useSWR('/api/v1/metrics/aging', getAgingMetrics, { shouldRetryOnError: false });
  
  // Utilizamos los datos del backend, si fallan porque el server aún no lo retorna, no mostramos nada (o empty state)
  const chartData = data || [];

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Aging (Horas promedio por Status)</h4>
      {chartData.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No hay datos de aging disponibles.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
              dataKey="status" 
              type="category" 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false} 
              width={80} 
              tickFormatter={(val) => val.replace('_', ' ').toUpperCase()}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }} 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              formatter={(value) => [`${value} hrs`, "Promedio"]}
            />
            <Bar dataKey="avg_hours" radius={[0, 4, 4, 0]} barSize={20}>
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
