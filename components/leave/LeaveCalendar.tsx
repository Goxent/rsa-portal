import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { LeaveRequest, StaffDirectoryProfile } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, parseISO, addMonths, subMonths, isToday } from 'date-fns';

interface LeaveCalendarProps {
    leaves: LeaveRequest[];
    staff: StaffDirectoryProfile[];
}

const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ leaves, staff }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const approvedLeaves = leaves.filter(l => l.status === 'APPROVED');

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Helper to get leaves for a specific day
    const getLeavesForDay = (day: Date) => {
        return approvedLeaves.filter(l => {
            const start = parseISO(l.startDate);
            const end = parseISO(l.endDate);
            return isWithinInterval(day, { start, end });
        });
    };

    return (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div>
                    <h3 className="text-xl font-black text-white">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Team Availability Overview</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={previousMonth}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest"
                    >
                        Today
                    </button>
                    <button 
                        onClick={nextMonth}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-white/2 py-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                            {day}
                        </div>
                    ))}
                    
                    {/* Empty cells for padding if month doesn't start on Sunday */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-white/[0.01] h-32 border-b border-r border-white/5" />
                    ))}

                    {days.map((day, idx) => {
                        const dayLeaves = getLeavesForDay(day);
                        const isCurrentDay = isToday(day);
                        
                        return (
                            <div 
                                key={day.toString()} 
                                className={`bg-white/[0.02] h-32 p-2 border-b border-r border-white/5 transition-all hover:bg-white/5 relative group ${isCurrentDay ? 'ring-1 ring-brand-500/50 inset-0 z-10 bg-brand-500/5' : ''}`}
                            >
                                <span className={`text-[11px] font-bold ${isCurrentDay ? 'text-brand-400' : 'text-gray-500'} group-hover:text-white transition-colors`}>
                                    {format(day, 'd')}
                                </span>
                                
                                <div className="mt-2 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                                    {dayLeaves.map((l, i) => (
                                        <div 
                                            key={l.id + i}
                                            className="px-2 py-1 rounded bg-brand-500/20 border border-brand-500/20 text-[9px] text-white font-bold truncate flex items-center gap-1 shadow-sm"
                                            title={`${l.userName}: ${l.type}`}
                                        >
                                            <div className="w-1 h-1 rounded-full bg-brand-400" />
                                            {l.userName.split(' ')[0]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="px-6 py-4 bg-white/2 border-t border-white/5 flex items-center justify-between">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Approved Leave</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded ring-1 ring-brand-500/50 bg-brand-500/10" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Today</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">Click on a day to view detailed schedule</p>
            </div>
        </div>
    );
};

export default LeaveCalendar;
