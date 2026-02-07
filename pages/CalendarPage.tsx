
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { Task, CalendarEvent, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

// Helpers
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
      title: '', time: '09:00', type: 'MEETING', description: ''
  });
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
      if (user) {
          AuthService.getAllTasks().then(setTasks);
          AuthService.getAllEvents().then(setEvents);
      }
  }, [user]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
    setSelectedDate(null);
  };

  const getItemsForDay = (day: number) => {
      const taskItems = tasks.filter(task => {
          const taskDate = new Date(task.dueDate);
          return taskDate.getDate() === day && 
                 taskDate.getMonth() === month && 
                 taskDate.getFullYear() === year;
      });

      const eventItems = events.filter(ev => {
          const evDate = new Date(ev.date);
          return evDate.getDate() === day && 
                 evDate.getMonth() === month && 
                 evDate.getFullYear() === year;
      });

      return { tasks: taskItems, events: eventItems };
  };

  const handleSaveEvent = async () => {
      if (!newEvent.title || !selectedDate) return;
      if (user?.role !== UserRole.ADMIN) {
          alert("Only Admins can create events.");
          return;
      }

      const dateStr = new Date(year, month, selectedDate).toISOString().split('T')[0]; // Simple YYYY-MM-DD
      
      const evt: CalendarEvent = {
          id: '',
          title: newEvent.title,
          date: dateStr,
          time: newEvent.time,
          description: newEvent.description,
          type: newEvent.type as any
      };

      await AuthService.saveEvent(evt);
      const updatedEvents = await AuthService.getAllEvents();
      setEvents(updatedEvents);
      setIsModalOpen(false);
      setNewEvent({ title: '', time: '09:00', type: 'MEETING', description: '' });
  };

  const addToGoogleCalendar = (title: string, date: string, desc: string) => {
      const dateStr = date.replace(/-/g, '');
      const details = encodeURIComponent(desc);
      const encTitle = encodeURIComponent(title);
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encTitle}&dates=${dateStr}/${dateStr}&details=${details}`;
      window.open(url, '_blank');
  };

  const renderCalendarGrid = () => {
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const totalSlots = [...blanks, ...days];

    return (
        <div className="grid grid-cols-7 gap-2 lg:gap-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={d} className={`text-center text-xs font-bold uppercase tracking-widest py-2 ${i === 6 ? 'text-red-400' : 'text-gray-500'}`}>
                    {d}
                </div>
            ))}
            {totalSlots.map((day, index) => {
                if (!day) return <div key={`blank-${index}`} className="h-24 lg:h-32 rounded-xl bg-white/2 border border-white/5"></div>;
                
                const { tasks: dayTasks, events: dayEvents } = getItemsForDay(day);
                const totalCount = dayTasks.length + dayEvents.length;
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                const isSelected = day === selectedDate;
                
                // Determine if Saturday (Day 6 in JS Date)
                const isSaturday = new Date(year, month, day).getDay() === 6;

                return (
                    <div 
                        key={day} 
                        onClick={() => setSelectedDate(day)}
                        className={`h-24 lg:h-32 rounded-xl border p-2 flex flex-col justify-between transition-all cursor-pointer group hover:border-blue-500/50 hover:bg-white/5
                            ${isSelected ? 'bg-white/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/10'}
                            ${isToday ? 'ring-1 ring-blue-400' : ''}
                        `}
                    >
                        <div className="flex justify-between items-start">
                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full 
                                ${isToday 
                                    ? 'bg-blue-600 text-white' 
                                    : isSaturday 
                                        ? 'text-red-400' // Red font for Saturdays
                                        : 'text-gray-300'
                                }`
                            }>
                                {day}
                            </span>
                            {totalCount > 0 && (
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-medium">
                                    {totalCount}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1 mt-1 overflow-hidden">
                            {dayEvents.map((ev, i) => (
                                <div key={`ev-${i}`} className="px-1.5 py-1 rounded bg-purple-500/20 text-[10px] text-purple-200 truncate border-l-2 border-purple-500">
                                    {ev.title}
                                </div>
                            ))}
                            {dayTasks.slice(0, 2 - dayEvents.length).map((t, i) => (
                                <div key={`t-${i}`} className="px-1.5 py-1 rounded bg-blue-500/20 text-[10px] text-blue-200 truncate border-l-2 border-blue-500">
                                    {t.title}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const { tasks: selectedDayTasks, events: selectedDayEvents } = selectedDate ? getItemsForDay(selectedDate) : { tasks: [], events: [] };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-white">Firm Calendar</h1>
            <p className="text-sm text-gray-400">Track task deadlines, meetings, and events</p>
         </div>
         <div className="flex items-center space-x-4 bg-white/5 p-1 rounded-xl border border-white/10">
             <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronLeft size={20}/></button>
             <span className="text-lg font-bold text-white w-32 text-center select-none">{monthNames[month]} {year}</span>
             <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronRight size={20}/></button>
         </div>
       </div>

       <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
           {/* Main Calendar Grid */}
           <div className="flex-1 glass-panel rounded-2xl p-4 lg:p-6 overflow-y-auto shadow-2xl">
               {renderCalendarGrid()}
           </div>

           {/* Side Panel: Selected Day Agenda */}
           <div className="w-full lg:w-80 glass-panel rounded-2xl p-6 flex flex-col shadow-2xl h-fit">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <CalendarIcon size={18} className="mr-2 text-blue-400"/>
                        {selectedDate ? `${monthNames[month]} ${selectedDate}` : 'Select a date'}
                    </h3>
                    {user?.role === UserRole.ADMIN && (
                        <button onClick={() => selectedDate && setIsModalOpen(true)} className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors shadow-lg">
                            <Plus size={16} />
                        </button>
                    )}
                </div>

                <div className="space-y-4 flex-1">
                    {selectedDayEvents.map((ev, i) => (
                        <div key={i} className="group flex flex-col p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/20">
                             <h4 className="text-sm font-semibold text-purple-200">{ev.title}</h4>
                             <p className="text-[10px] text-gray-400">{ev.time} • {ev.type}</p>
                             <button onClick={() => addToGoogleCalendar(ev.title, ev.date, ev.description || '')} className="mt-2 text-[10px] text-purple-300 hover:underline flex items-center"><ExternalLink size={10} className="mr-1"/> Add to G-Cal</button>
                        </div>
                    ))}
                    
                    {selectedDayTasks.map((task, i) => (
                        <div key={i} className="group flex flex-col p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <div className="flex items-start space-x-3 mb-2">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_currentColor]"></div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-200 group-hover:text-white">{task.title}</h4>
                                    <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{task.clientName}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => addToGoogleCalendar(task.title, task.dueDate, `Client: ${task.clientName}`)}
                                className="mt-2 text-xs flex items-center justify-center w-full py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 rounded-lg border border-blue-500/20 transition-colors"
                            >
                                <ExternalLink size={12} className="mr-2" /> Add to G-Cal
                            </button>
                        </div>
                    ))}
                    
                    {selectedDayTasks.length === 0 && selectedDayEvents.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            <p className="text-sm">No items for this date.</p>
                        </div>
                    )}
                </div>
           </div>
       </div>

       {/* Add Event Modal */}
       {isModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
              <div className="glass-modal rounded-xl w-full max-w-sm p-6 shadow-2xl">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="text-lg font-bold text-white">Add Event</h3>
                       <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                   </div>
                   <div className="space-y-4">
                       <div><label className="text-xs text-gray-400">Title</label><input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}/></div>
                       <div><label className="text-xs text-gray-400">Time</label><input type="time" className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})}/></div>
                       <div><label className="text-xs text-gray-400">Type</label><select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}><option value="MEETING">Meeting</option><option value="DEADLINE">Deadline</option><option value="GENERAL">General</option></select></div>
                       <div><label className="text-xs text-gray-400">Description</label><textarea className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}/></div>
                       <button onClick={handleSaveEvent} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Save Event</button>
                   </div>
              </div>
           </div>
       )}
    </div>
  );
};

export default CalendarPage;
