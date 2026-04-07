import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const mockData = [
  { date: '01/04', ideal: 50, real: 50 },
  { date: '04/04', ideal: 40, real: 45 },
  { date: '08/04', ideal: 30, real: 38 },
  { date: '12/04', ideal: 20, real: 25 },
  { date: '15/04', ideal: 10, real: 15 },
  { date: '18/04', ideal: 0, real: 8 },
];

const BurndownChart = ({ projectId }) => {
  // Aquí se usaría el data fetching cuando el endpoint esté listo.
  // Por ahora se calcula o simula la data para que el chart funcione visualmente.
  const data = mockData;

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Burndown Chart</h4>
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
          <Line type="monotone" dataKey="ideal" name="Ritmo Ideal" stroke="#cbd5e1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="real" name="Progreso Real" stroke="#6366f1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BurndownChart;
