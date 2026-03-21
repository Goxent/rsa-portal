import React, { useMemo, useState } from 'react';
import { Task, UserProfile, Client, TaskStatus, TaskPriority } from '../../types';
import { format, subDays, addDays, startOfDay, endOfDay, eachDayOfInterval, isToday, isSameDay, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react';

interface TaskTimelineViewProps {
    tasks: Task[];
    usersList: UserProfile[];
    clientsList: Client[];
    handleOpenEdit: (task: Task) => void;
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE';
}

const statusColors: Record<TaskStatus, string> = {
    [TaskStatus.NOT_STARTED]: '#64748B',  // slate-500
    [TaskStatus.IN_PROGRESS]: '#3B82F6',  // blue-500
    [TaskStatus.UNDER_REVIEW]: '#F59E0B', // amber-500
    [TaskStatus.HALTED]: '#EF4444',       // red-500
    [TaskStatus.COMPLETED]: '#10B981',    // emerald-500
    [TaskStatus.ARCHIVED]: '#4B5563',     // gray-600
};

const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({
    tasks,
    usersList,
    clientsList,
    handleOpenEdit,
    groupBy
}) => {
    const [startDateStr, setStartDateStr] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDateStr, setEndDateStr] = useState(() => format(addDays(new Date(), 28), 'yyyy-MM-dd'));

    const handlePrev = () => {
        setStartDateStr(prev => format(subDays(new Date(prev), 14), 'yyyy-MM-dd'));
        setEndDateStr(prev => format(subDays(new Date(prev), 14), 'yyyy-MM-dd'));
    };

    const handleNext = () => {
        setStartDateStr(prev => format(addDays(new Date(prev), 14), 'yyyy-MM-dd'));
        setEndDateStr(prev => format(addDays(new Date(prev), 14), 'yyyy-MM-dd'));
    };

    const handleToday = () => {
        setStartDateStr(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
        setEndDateStr(format(addDays(new Date(), 28), 'yyyy-MM-dd'));
    };

    const startDate = startOfDay(new Date(startDateStr));
    const endDate = endOfDay(new Date(endDateStr));
    const daysInterval = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDateStr, endDateStr]);
    const DAY_WIDTH = 48; // px
    const SIDEBAR_WIDTH = 260; // px

    const groupedTasks = useMemo(() => {
        const groups: Record<string, any[]> = {};

        tasks.forEach((task) => {
            const tStart = startOfDay(new Date(task.createdAt));
            // Default 2 days length if no due date explicitly set to look good
            const tEnd = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(addDays(new Date(task.createdAt), 2));
            
            // Skip tasks completely out of bounds
            if (tEnd.getTime() < startDate.getTime() || tStart.getTime() > endDate.getTime()) {
                return;
            }

            let groupLabel = 'All Tasks';
            if (groupBy === 'PHASE') {
                groupLabel = task.auditPhase ? task.auditPhase.replace(/_/g, ' ') : 'No Phase';
            } else if (groupBy === 'ASSIGNEE') {
                if (!task.assignedTo || task.assignedTo.length === 0) groupLabel = 'Unassigned';
                else {
                    const u = usersList.find(u => u.uid === task.assignedTo[0]);
                    groupLabel = u?.displayName || 'Unknown Staff';
                }
            } else if (groupBy === 'AUDITOR') {
                const tc = clientsList.find(c => task.clientIds?.includes(c.id));
                groupLabel = tc?.signingAuthority || 'Unassigned Auditor';
            } else {
                groupLabel = task.clientName || 'Internal';
            }

            if (!groups[groupLabel]) groups[groupLabel] = [];
            
            // Calc exact placement
            // Cap start/end to visible bounds for calculating width smoothly
            const visualStart = tStart < startDate ? startDate : tStart;
            const visualEnd = tEnd > endDate ? endDate : tEnd;
            
            const offsetDays = differenceInDays(visualStart, startDate);
            const durationDays = Math.max(1, differenceInDays(visualEnd, visualStart) + 1);
            
            groups[groupLabel].push({
                task,
                visualStart,
                visualEnd,
                offsetDays: tStart < startDate ? 0 : differenceInDays(tStart, startDate),
                durationDays: Math.max(1, differenceInDays(tEnd, tStart) + 1),
                isCutStart: tStart < startDate,
                isCutEnd: tEnd > endDate
            });
        });

        // Sort groups alphabetically, then tasks by start date
        const sortedGroups = Object.keys(groups).sort().map(k => ({
            label: k,
            items: groups[k].sort((a, b) => new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime())
        }));

        return sortedGroups;
    }, [tasks, groupBy, usersList, clientsList, startDate, endDate]);

    return (
        <div className="h-full flex flex-col bg-transparent overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#09090b]/50 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={handleToday} className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-md text-[11px] font-bold tracking-widest uppercase text-slate-300 transition-colors border border-white/[0.08]">
                        Today
                    </button>
                    <div className="flex items-center gap-1 bg-black/20 rounded-md p-0.5 border border-white/[0.05]">
                        <button onClick={handlePrev} className="p-1 hover:bg-white/10 rounded-sm transition-colors text-slate-400 hover:text-white"><ChevronLeft size={14} strokeWidth={2.5} /></button>
                        <span className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-widest hidden sm:inline">Timeline</span>
                        <button onClick={handleNext} className="p-1 hover:bg-white/10 rounded-sm transition-colors text-slate-400 hover:text-white"><ChevronRight size={14} strokeWidth={2.5} /></button>
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 px-2 py-1.5 rounded-md border border-white/[0.05]">
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="bg-transparent text-[11px] text-amber-500 font-bold focus:outline-none cursor-pointer uppercase tracking-wider"
                        />
                        <span className="text-slate-600 text-[10px] font-bold">—</span>
                        <input
                            type="date"
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="bg-transparent text-[11px] text-amber-500 font-bold focus:outline-none cursor-pointer uppercase tracking-wider"
                        />
                    </div>
                </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#09090b]">
                <div className="min-w-max pb-24" style={{ width: SIDEBAR_WIDTH + daysInterval.length * DAY_WIDTH }}>
                    
                    {/* Header Row (Dates) */}
                    <div className="sticky top-0 z-30 flex bg-[#0a0f1e]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-sm">
                        <div 
                            className="flex-shrink-0 border-r border-white/[0.06] px-5 py-3 flex items-end sticky left-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl" 
                            style={{ width: SIDEBAR_WIDTH }}
                        >
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Details</span>
                        </div>
                        <div className="flex">
                            {daysInterval.map((day, i) => {
                                const today = isToday(day);
                                return (
                                    <div 
                                        key={day.toISOString()} 
                                        className={`flex-shrink-0 flex flex-col items-center justify-end py-2 border-r border-white/[0.04] transition-colors ${today ? 'bg-amber-500/[0.05]' : ''}`}
                                        style={{ width: DAY_WIDTH }}
                                    >
                                        <span className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${today ? 'text-amber-500' : 'text-slate-500'}`}>{format(day, 'EEE')}</span>
                                        <span className={`text-[11px] font-black ${today ? 'text-amber-400' : 'text-slate-300'}`}>{format(day, 'd')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Data */}
                    <div className="relative">
                        {/* Background Grid Lines (Absolute overlay just for the grid) */}
                        <div className="absolute inset-0 flex pointer-events-none z-0">
                            <div className="flex-shrink-0 border-r border-white/[0.04]" style={{ width: SIDEBAR_WIDTH }} />
                            {daysInterval.map(day => (
                                <div key={day.toISOString()} className={`flex-shrink-0 border-r border-white/[0.02] ${isToday(day) ? 'bg-amber-500/[0.02]' : ''}`} style={{ width: DAY_WIDTH }} />
                            ))}
                        </div>

                        {/* Content Rows */}
                        <div className="relative z-10 flex flex-col">
                            {groupedTasks.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-center mt-8 sticky left-0 w-full">
                                    <CalendarIcon size={40} className="mb-4 text-slate-700 opacity-50" />
                                    <p className="font-bold text-slate-400">No tasks visible in this timeframe.</p>
                                    <p className="text-[11px] mt-1 text-slate-500">Try zooming out the dates or adjusting filters.</p>
                                </div>
                            ) : (
                                groupedTasks.map((group, groupIdx) => (
                                    <div key={groupIdx} className="flex flex-col border-b border-white/[0.02]">
                                        
                                        {/* Group Header Row */}
                                        <div className="flex w-full group hover:bg-white/[0.01]">
                                            <div 
                                                className="flex-shrink-0 px-5 py-3 border-r border-white/[0.04] sticky left-0 z-20 bg-[#09090b] group-hover:bg-[#0a0f1e] transition-colors"
                                                style={{ width: SIDEBAR_WIDTH }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">{group.label}</span>
                                                    <span className="ml-auto text-[10px] font-bold text-slate-600 bg-slate-800 px-1.5 rounded">{group.items.length}</span>
                                                </div>
                                            </div>
                                            {/* Empty span for the rest of the row */}
                                            <div className="flex-1" />
                                        </div>

                                        {/* Task Rows */}
                                        {group.items.map((item: any, itemIdx: number) => {
                                            const { task, offsetDays, durationDays, isCutStart, isCutEnd } = item;
                                            const color = statusColors[task.status as TaskStatus] || '#64748B';
                                            const isDone = task.status === TaskStatus.COMPLETED;
                                            
                                            // Ensure width fits within the visible window
                                            const visibleOffset = Math.max(0, offsetDays);
                                            // Max available slots from offset to end of interval
                                            const maxAvailableDuration = daysInterval.length - visibleOffset;
                                            // Ensure duration visually doesn't burst out of the right side completely
                                            const visibleDuration = Math.min(durationDays, maxAvailableDuration);

                                            return (
                                                <div key={task.id} className="flex w-full relative group/row hover:bg-white/[0.01]">
                                                    {/* Sidebar Context */}
                                                    <div 
                                                        className="flex-shrink-0 px-5 py-2.5 border-r border-white/[0.04] sticky left-0 z-20 bg-[#09090b] group-hover/row:bg-[#0a1120] transition-colors flex items-center gap-3 overflow-hidden cursor-pointer"
                                                        style={{ width: SIDEBAR_WIDTH }}
                                                        onClick={() => handleOpenEdit(task)}
                                                    >
                                                        {isDone ? <Check size={14} className="text-emerald-500" strokeWidth={3} /> : <div className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-slate-600" />}
                                                        <div className="min-w-0 flex-1">
                                                            <div className={`text-[12px] font-semibold truncate transition-colors ${isDone ? 'text-slate-500 line-through' : 'text-slate-200 group-hover/row:text-white'}`}>{task.title}</div>
                                                            <div className="text-[10px] text-slate-500 truncate">{task.clientName || 'Internal'}</div>
                                                        </div>
                                                        {/* Avatar summary */}
                                                        {task.assignedTo?.length > 0 && (
                                                            <div className="flex -space-x-1.5 flex-shrink-0">
                                                                <div className="w-5 h-5 rounded-full bg-slate-800 border-[1.5px] border-[#09090b] flex items-center justify-center text-[8px] font-black text-amber-500 shadow-sm">
                                                                    {usersList.find(u => u.uid === task.assignedTo[0])?.displayName?.substring(0,2).toUpperCase() || '?'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Timeline placement */}
                                                    <div className="relative py-2" style={{ width: daysInterval.length * DAY_WIDTH }}>
                                                        <div 
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }}
                                                            className="absolute top-1.5 bottom-1.5 rounded-md flex items-center px-3 cursor-pointer group-hover/row:brightness-110 transition-all shadow-sm overflow-hidden"
                                                            style={{ 
                                                                left: visibleOffset * DAY_WIDTH + 4, // 4px padding so it doesn't touch the lines
                                                                width: (visibleDuration * DAY_WIDTH) - 8,
                                                                backgroundColor: `${color}25`,
                                                                borderLeft: isCutStart ? 'none' : `3px solid ${color}`,
                                                                borderRight: isCutEnd ? 'none' : `1px solid ${color}40`,
                                                                borderTop: `1px solid ${color}40`,
                                                                borderBottom: `1px solid ${color}40`,
                                                                borderTopLeftRadius: isCutStart ? 0 : 6,
                                                                borderBottomLeftRadius: isCutStart ? 0 : 6,
                                                                borderTopRightRadius: isCutEnd ? 0 : 6,
                                                                borderBottomRightRadius: isCutEnd ? 0 : 6,
                                                                opacity: isDone ? 0.6 : 1
                                                            }}
                                                        >
                                                            {/* Pill inner text */}
                                                            <span className="text-[10px] font-bold truncate tracking-wide" style={{ color: color }}>
                                                                {task.title}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskTimelineView;
