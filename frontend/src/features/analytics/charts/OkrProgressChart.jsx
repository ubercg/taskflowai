import React from 'react';
import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';
import { getObjectives } from '../../../services/api';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

const OkrProgressChart = ({ projectId }) => {
  const { data, error } = useSWR(
    projectId ? `/api/v1/objectives?project_id=${projectId}` : null, 
    () => getObjectives(projectId), 
    { shouldRetryOnError: false }
  );

  // Parseamos los datos para inyectarles el porcentaje y color
  const chartData = (data && !error && data.length > 0) 
    ? data.map((obj, i) => ({
        name: obj.title,
        progress: obj.progress || 0, // Fallback a 0 si no hay progress
        fill: COLORS[i % COLORS.length]
      }))
    : [];

  return (
    <div style={{ height: 320, backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Progreso de Objetivos (OKRs)</h4>
      {chartData.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No hay objetivos definidos.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="20%" 
            outerRadius="90%" 
            barSize={12} 
            data={chartData} 
            startAngle={90} 
            endAngle={-270}
          >
            <RadialBar 
              minAngle={15} 
              background 
              clockWise 
              dataKey="progress" 
              cornerRadius={10} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              formatter={(value) => [`${value}%`, "Completado"]}
            />
            <Legend 
              iconSize={10} 
              layout="vertical" 
              verticalAlign="middle" 
              align="right" 
              wrapperStyle={{ fontSize: '12px', color: '#475569', lineHeight: '24px' }} 
            />
          </RadialBarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default OkrProgressChart;
