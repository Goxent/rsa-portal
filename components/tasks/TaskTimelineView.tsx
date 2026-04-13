import React, { useMemo, useState } from 'react';
import { Task, UserProfile, Client, TaskStatus, TaskPriority } from '../../types';
import { format, subDays, addDays, startOfDay, endOfDay, eachDayOfInterval, isToday, isSameDay, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react';
import { getAvatarColor, getInitials } from '../../utils/userUtils';

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
    [TaskStatus.COMPLETED]: '#10B981',    // emerald-500
    [TaskStatus.UNDER_REVIEW]: '#8B5CF6', // purple-500
    [TaskStatus.HALTED]: '#EF4444',       // red-500
    [TaskStatus.ARCHIVED]: '#94A3B8',     // slate-400
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
            // Refined duration logic: primarily use startDate, then fallback to createdAt
            const tStartStr = task.startDate || task.createdAt;
            const tStart = startOfDay(new Date(tStartStr));
            
            // Strictly follow dueDate if present, otherwise default to a small visual bar
            const tEnd = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(addDays(new Date(tStartStr), 1));
            
            // Skip tasks completely out of bounds
            if (tEnd.getTime() < startDate.getTime() || tStart.getTime() > endDate.getTime()) {
                return;
            }

            // Function to add task to a specific group
            const addToGroup = (label: string) => {
                if (!groups[label]) groups[label] = [];
                
                // Calc exact placement
                const visualStart = tStart < startDate ? startDate : tStart;
                const visualEnd = tEnd > endDate ? endDate : tEnd;
                
                const offsetDays = differenceInDays(visualStart, startDate);
                const durationDays = Math.max(1, differenceInDays(visualEnd, visualStart) + 1);
                
                groups[label].push({
                    task,
                    visualStart,
                    visualEnd,
                    offsetDays: tStart < startDate ? 0 : differenceInDays(tStart, startDate),
                    durationDays: Math.max(1, differenceInDays(tEnd, tStart) + 1),
                    isCutStart: tStart < startDate,
                    isCutEnd: tEnd > endDate
                });
            };

            if (groupBy === 'PHASE') {
                const phaseLabel = task.auditPhase ? task.auditPhase.replace(/_/g, ' ') : 'No Phase';
                addToGroup(phaseLabel);
            } else if (groupBy === 'ASSIGNEE') {
                // Multi-assignee support: task appears in each assignee's row
                if (!task.assignedTo || task.assignedTo.length === 0) {
                    addToGroup('Unassigned');
                } else {
                    task.assignedTo.forEach(uid => {
                        const u = usersList.find(u => u.uid === uid);
                        const label = u?.displayName || 'Unknown Staff';
                        addToGroup(label);
                    });
                }
            } else if (groupBy === 'AUDITOR') {
                const tc = clientsList.find(c => task.clientIds?.includes(c.id));
                const label = tc?.signingAuthority || 'Unassigned Auditor';
                addToGroup(label);
            } else {
                addToGroup('All Tasks');
            }
        });

        // Sort groups: Handle specifically for Phase order if needed, otherwise alphabetical
        const sortedGroups = Object.keys(groups).sort((a, b) => {
            // Custom order for phases if possible, or just default alphabetical
            return a.localeCompare(b);
        }).map(k => ({
            label: k,
            items: groups[k].sort((a, b) => {
                const timeA = new Date(a.task.startDate || a.task.createdAt).getTime();
                const timeB = new Date(b.task.startDate || b.task.createdAt).getTime();
                return timeA - timeB;
            })
        }));

        return sortedGroups;
    }, [tasks, groupBy, usersList, clientsList, startDate, endDate]);

    return (
        <div className="h-full flex flex-col bg-slate-50/50 dark:bg-transparent overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#09090b]/50 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <button onClick={handleToday} className="px-3 py-1.5 bg-slate-100 dark:bg-white/[0.03] hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-white/[0.08] rounded-md text-[11px] font-black tracking-widest uppercase text-slate-500 dark:text-slate-300 transition-colors border border-slate-200 dark:border-white/[0.08] shadow-sm hover:shadow">
                        Today
                    </button>
                    <div className="flex items-center gap-1 bg-white dark:bg-black/20 rounded-md p-0.5 border border-slate-200 dark:border-white/[0.05] shadow-sm">
                        <button onClick={handlePrev} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-sm transition-colors text-slate-400 hover:text-brand-600 dark:hover:text-white"><ChevronLeft size={14} strokeWidth={2.5} /></button>
                        <span className="text-[10px] font-black text-slate-500 px-2 uppercase tracking-widest hidden sm:inline">Timeline</span>
                        <button onClick={handleNext} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-sm transition-colors text-slate-400 hover:text-brand-600 dark:hover:text-white"><ChevronRight size={14} strokeWidth={2.5} /></button>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-black/20 px-3 py-1.5 rounded-md border border-slate-200 dark:border-white/[0.05] shadow-sm">
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="bg-transparent text-[11px] text-brand-600 dark:text-amber-500 font-black focus:outline-none cursor-pointer uppercase tracking-wider"
                        />
                        <span className="text-slate-400 text-[10px] font-black">—</span>
                        <input
                            type="date"
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="bg-transparent text-[11px] text-brand-600 dark:text-amber-500 font-black focus:outline-none cursor-pointer uppercase tracking-wider"
                        />
                    </div>
                </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-[#09090b]">
                <div className="min-w-max pb-24" style={{ width: SIDEBAR_WIDTH + daysInterval.length * DAY_WIDTH }}>
                    
                    {/* Header Row (Dates) */}
                    <div className="sticky top-0 z-10 flex bg-slate-50/95 dark:bg-[#0a0f1e]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] shadow-sm">
                        <div 
                            className="flex-shrink-0 border-r border-slate-200 dark:border-white/[0.06] px-5 py-3 flex items-end sticky left-0 z-20 bg-slate-50/95 dark:bg-[#0a0f1e]/95 backdrop-blur-xl" 
                            style={{ width: SIDEBAR_WIDTH }}
                        >
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Task Details</span>
                        </div>
                        <div className="flex">
                            {daysInterval.map((day, i) => {
                                const today = isToday(day);
                                return (
                                    <div 
                                        key={day.toISOString()} 
                                        className={`flex-shrink-0 flex flex-col items-center justify-end py-2.5 border-r border-slate-200 dark:border-white/[0.04] transition-colors ${today ? 'bg-brand-50 dark:bg-amber-500/[0.05] shadow-[inset_0_-2px_0_theme(colors.brand.500)] dark:shadow-[inset_0_-2px_0_theme(colors.amber.500)]' : ''}`}
                                        style={{ width: DAY_WIDTH }}
                                    >
                                        <span className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${today ? 'text-brand-600 dark:text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>{format(day, 'EEE')}</span>
                                        <span className={`text-[12px] font-black ${today ? 'text-brand-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>{format(day, 'd')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Data */}
                    <div className="relative">
                        {/* Background Grid Lines (Absolute overlay just for the grid) */}
                        <div className="absolute inset-0 flex pointer-events-none z-0">
                            <div className="flex-shrink-0 border-r border-slate-200 dark:border-white/[0.04]" style={{ width: SIDEBAR_WIDTH }} />
                            {daysInterval.map(day => (
                                <div key={day.toISOString()} className={`flex-shrink-0 border-r border-slate-200/50 dark:border-white/[0.02] ${isToday(day) ? 'bg-brand-50/50 dark:bg-amber-500/[0.02]' : ''}`} style={{ width: DAY_WIDTH }} />
                            ))}
                        </div>

                        {/* Content Rows */}
                        <div className="relative z-10 flex flex-col">
                            {groupedTasks.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-center mt-8 sticky left-0 w-full">
                                    <CalendarIcon size={40} className="mb-4 text-slate-400 dark:text-slate-700 opacity-50" />
                                    <p className="font-black text-slate-500 dark:text-slate-400">No tasks visible in this timeframe.</p>
                                    <p className="text-[11px] mt-1 text-slate-400 font-medium">Try zooming out the dates or adjusting filters.</p>
                                </div>
                            ) : (
                                groupedTasks.map((group, groupIdx) => (
                                    <div key={groupIdx} className="flex flex-col border-b border-slate-200 dark:border-white/[0.02]">
                                        
                                        {/* Group Header Row */}
                                        {groupBy !== 'NONE' && (
                                            <div className="flex w-full group hover:bg-slate-50 dark:hover:bg-white/[0.01]">
                                                <div 
                                                    className="flex-shrink-0 px-5 py-3 border-r border-slate-200 dark:border-white/[0.04] sticky left-0 z-20 bg-white dark:bg-[#09090b] group-hover:bg-slate-50 dark:group-hover:bg-[#0a0f1e] transition-colors"
                                                    style={{ width: SIDEBAR_WIDTH }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-slate-600" />
                                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">{group.label}</span>
                                                        <span className="ml-auto text-[10px] font-black text-slate-500 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-transparent">{group.items.length}</span>
                                                    </div>
                                                </div>
                                                {/* Empty span for the rest of the row */}
                                                <div className="flex-1" />
                                            </div>
                                        )}

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
                                                <div key={task.id} className="flex w-full relative group/row hover:bg-emerald-50/50 dark:hover:bg-white/[0.02]">
                                                    {/* Sidebar Context */}
                                                    <div 
                                                        className="flex-shrink-0 px-5 py-3 border-r border-slate-200 dark:border-white/[0.04] sticky left-0 z-20 bg-white dark:bg-[#09090b] group-hover/row:bg-emerald-50/50 dark:group-hover/row:bg-[#0c1322] transition-colors flex items-center gap-3 overflow-hidden cursor-pointer shadow-sm group-hover/row:shadow-md"
                                                        style={{ width: SIDEBAR_WIDTH }}
                                                        onClick={() => handleOpenEdit(task)}
                                                    >
                                                        {isDone ? <Check size={14} className="text-brand-500 dark:text-emerald-500 flex-shrink-0" strokeWidth={3} /> : <div className="w-3.5 h-3.5 rounded-[4px] border-[1.5px] border-slate-300 dark:border-slate-600 transition-colors group-hover/row:border-brand-400 dark:group-hover/row:border-slate-400 flex-shrink-0" />}
                                                        <div className="min-w-0 flex-1 pl-1">
                                                            <div className={`text-[12px] font-black truncate transition-colors ${isDone ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200 group-hover/row:text-brand-700 dark:group-hover/row:text-white'}`}>{task.title}</div>
                                                            <div className="text-[10px] text-slate-500 font-bold truncate mt-0.5">{task.clientName || 'Internal'}</div>
                                                        </div>
                                                        {/* Avatar summary */}
                                                        {task.assignedTo?.length > 0 && (
                                                            <div className="flex -space-x-1 flex-shrink-0 group-hover/row:space-x-0 transition-all duration-300">
                                                                {task.assignedTo.slice(0,2).map((uid: string) => {
                                                                    const u = usersList.find(x => x.uid === uid);
                                                                    const av = getAvatarColor(uid);
                                                                    return (
                                                                        <div key={uid} className={`w-[24px] h-[24px] rounded-full ring-2 ring-white dark:ring-[#09090b] group-hover/row:ring-emerald-50 group-hover/row:dark:ring-[#0c1322] flex items-center justify-center text-[8px] font-black text-white shadow-sm transition-all duration-300 ${av.bg} ${av.text}`}>
                                                                            {getInitials(u?.displayName || '?')}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Timeline placement */}
                                                    <div className="relative py-2.5" style={{ width: daysInterval.length * DAY_WIDTH }}>
                                                        <div 
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }}
                                                            className={`absolute top-2 bottom-2 rounded-[5px] flex items-center px-1.5 cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 z-10 hover:z-20 ${isDone ? 'opacity-50 saturate-50' : 'group-hover/row:opacity-100 opacity-90'}`}
                                                            style={{ 
                                                                left: visibleOffset * DAY_WIDTH + 4,
                                                                width: (visibleDuration * DAY_WIDTH) - 8,
                                                                background: `linear-gradient(90deg, ${color}30 0%, ${color}15 100%)`,
                                                                borderLeft: isCutStart ? 'none' : `3px solid ${color}`,
                                                                borderRight: isCutEnd ? 'none' : `1px solid ${color}40`,
                                                                borderTop: `1px solid ${color}40`,
                                                                borderBottom: `1px solid ${color}40`,
                                                                borderTopLeftRadius: isCutStart ? 0 : 5,
                                                                borderBottomLeftRadius: isCutStart ? 0 : 5,
                                                                borderTopRightRadius: isCutEnd ? 0 : 5,
                                                                borderBottomRightRadius: isCutEnd ? 0 : 5,
                                                            }}
                                                        >
                                                            {/* Pill inner text */}
                                                            <div className="min-w-0 flex-1 truncate">
                                                                <span className="text-[10.5px] font-black truncate tracking-wide mix-blend-color-burn dark:mix-blend-normal" style={{ color: color }}>
                                                                    {task.title}
                                                                </span>
                                                            </div>
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
