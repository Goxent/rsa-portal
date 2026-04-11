import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { LeaveRequest } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, addMonths, subMonths, isToday } from 'date-fns';

interface LeaveCalendarProps {
    leaves: LeaveRequest[];
    isAdmin: boolean;
    currentUserId: string;
}

const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ leaves, isAdmin, currentUserId }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Only show approved leaves in the public calendar
    const approvedLeaves = leaves.filter(l => l.status === 'APPROVED');

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const getLeavesForDay = (day: Date) => {
        return approvedLeaves.filter(l => {
            const start = parseISO(l.startDate);
            const end = parseISO(l.endDate);
            return isWithinInterval(day, { start, end });
        });
    };

    return (
        <div className="bg-surface rounded-xl overflow-hidden">
            {/* Header / Nav */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-heading uppercase tracking-wider">{format(currentMonth, 'MMMM yyyy')}</h3>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-0.5">Availability Overview</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={previousMonth}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted hover:text-heading transition-all border border-transparent hover:border-border"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-3 py-1 rounded-md bg-secondary text-[10px] font-bold text-heading hover:bg-border transition-all uppercase tracking-widest border border-border"
                    >
                        Today
                    </button>
                    <button 
                        onClick={nextMonth}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted hover:text-heading transition-all border border-transparent hover:border-border"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 bg-transparent">
                <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden shadow-sm">
                    {/* Day Names */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-secondary/50 py-2.5 text-center text-[10px] font-black text-muted uppercase tracking-widest border-b border-border">
                            {day}
                        </div>
                    ))}
                    
                    {/* Leading Empty Cells */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-surface h-28 border-border" />
                    ))}

                    {/* Day Cells */}
                    {days.map((day) => {
                        const dayLeaves = getLeavesForDay(day);
                        const isCurrentDay = isToday(day);
                        
                        return (
                            <div 
                                key={day.toString()} 
                                className={`bg-surface h-28 p-2 transition-all hover:bg-secondary/40 relative group ${isCurrentDay ? 'ring-2 ring-accent/30 ring-inset z-10' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-[11px] font-bold ${isCurrentDay ? 'text-accent' : 'text-muted'} group-hover:text-heading transition-colors`}>
                                        {format(day, 'd')}
                                    </span>
                                    {isCurrentDay && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-accent-glow" />
                                    )}
                                </div>
                                
                                <div className="mt-2 space-y-1 overflow-y-auto max-h-[75px] custom-scrollbar">
                                    {dayLeaves.map((l, i) => {
                                        const isMyLeave = l.userId === currentUserId;
                                        return (
                                            <div 
                                                key={l.id + i}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate flex items-center gap-1.5 shadow-sm border ${
                                                    isMyLeave 
                                                        ? 'bg-accent/10 border-accent/20 text-accent' 
                                                        : 'bg-status-completed-dim border-status-completed-dim text-status-completed'
                                                }`}
                                                title={`${l.userName}: ${l.type}`}
                                            >
                                                <div className={`w-1 h-1 rounded-full ${isMyLeave ? 'bg-accent' : 'bg-status-completed'}`} />
                                                {l.userName.split(' ')[0]}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="px-6 py-3 bg-secondary/30 border-t border-border flex items-center justify-between">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded bg-status-completed shadow-sm" />
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded ring-1 ring-accent/50 bg-accent/20" />
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Today</span>
                    </div>
                </div>
                <p className="text-[10px] text-muted font-medium italic opacity-60">Visibility: Approved protocol requirements only.</p>
            </div>
        </div>
    );
};

export default LeaveCalendar;
