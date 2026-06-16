import React, { useState } from 'react';
import useSWR from 'swr';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { getCalendarTasks } from '../../services/api';
import CalendarDaySidebar from './CalendarDaySidebar';

function CalendarView({ projectId }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: tasks = [], error, isLoading } = useSWR(
    projectId ? ['/api/v1/tasks/calendar', projectId, startDate, endDate] : null,
    () => getCalendarTasks(projectId, startDate, endDate)
  );

  if (!projectId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Por favor selecciona un proyecto para ver el calendario.
      </div>
    );
  }

  // Mapeamos los tasks que caen en el día seleccionado
  const tasksForDay = tasks.filter((task) => {
    if (task.due_date && isSameDay(new Date(task.due_date), selectedDay)) return true;
    if (task.start_date && isSameDay(new Date(task.start_date), selectedDay)) return true;
    return false;
  });

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
          Calendario del Proyecto
        </h2>
        {isLoading && <p style={{ color: '#64748b' }}>Cargando calendario...</p>}
        {error && <p style={{ color: '#ef4444' }}>Error al cargar las tareas.</p>}
        {!isLoading && !error && (
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={(day) => {
              if (day) setSelectedDay(day);
            }}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        )}
      </div>

      <div style={{ width: '350px' }}>
        <CalendarDaySidebar 
          selectedDay={selectedDay} 
          tasks={tasksForDay} 
        />
      </div>
    </div>
  );
}

export default CalendarView;
