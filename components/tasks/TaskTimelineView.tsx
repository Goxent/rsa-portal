import React, { useMemo, useState } from 'react';
import { Task, UserProfile, Client, TaskStatus } from '../../types';
import { format, subDays, addDays, startOfDay, endOfDay, eachDayOfInterval, isToday, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react';
import { getAvatarColor, getInitials } from '../../utils/userUtils';

interface TaskTimelineViewProps {
    tasks: Task[];
    usersList: UserProfile[];
    clientsList: Client[];
    handleOpenEdit: (task: Task) => void;
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE';
    setGroupBy: (val: any) => void;
}

const statusColorVars: Record<TaskStatus, { bg: string; border: string; text: string }> = {
    [TaskStatus.NOT_STARTED]: { bg: 'rgba(217,164,65,0.15)', border: 'rgba(217,164,65,0.4)', text: 'var(--color-warning)' },
    [TaskStatus.IN_PROGRESS]: { bg: 'rgba(106,163,217,0.15)', border: 'rgba(106,163,217,0.4)', text: 'var(--color-info)' },
    [TaskStatus.COMPLETED]: { bg: 'rgba(79,178,134,0.15)', border: 'rgba(79,178,134,0.4)', text: 'var(--color-success)' },
    [TaskStatus.UNDER_REVIEW]: { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', text: '#a855f7' },
    [TaskStatus.HALTED]: { bg: 'rgba(224,112,122,0.15)', border: 'rgba(224,112,122,0.4)', text: 'var(--color-danger)' },
    [TaskStatus.ARCHIVED]: { bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)', text: 'var(--text-muted)' },
};

const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({
    tasks = [],
    usersList = [],
    clientsList = [],
    handleOpenEdit,
    groupBy,
    setGroupBy
}) => {
    if (!tasks) tasks = [];
    if (!usersList) usersList = [];
    if (!clientsList) clientsList = [];

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
        if (!tasks || !Array.isArray(tasks)) return [];

        tasks.filter(t => t && typeof t === 'object').forEach((task) => {
            const tStartStr = task.startDate || task.createdAt;
            const tStart = startOfDay(new Date(tStartStr));
            const tEnd = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(addDays(new Date(tStartStr), 1));
            
            if (tEnd.getTime() < startDate.getTime() || tStart.getTime() > endDate.getTime()) {
                return;
            }

            const addToGroup = (label: string) => {
                if (!groups[label]) groups[label] = [];
                
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
                const phaseLabel = task.auditPhase ? task.auditPhase.replace(/_/g, ' ') : 'No phase';
                addToGroup(phaseLabel);
            } else if (groupBy === 'ASSIGNEE') {
                if (!task.assignedTo || !Array.isArray(task.assignedTo) || task.assignedTo.length === 0) {
                    addToGroup('Unassigned');
                } else {
                    task.assignedTo.forEach(uid => {
                        const u = usersList.find(x => x.uid === uid);
                        const label = u?.displayName || 'Unknown staff';
                        addToGroup(label);
                    });
                }
            } else if (groupBy === 'AUDITOR') {
                const tc = clientsList.find(c => task.clientIds?.includes(c.id));
                const label = tc?.signingAuthority || 'Unassigned auditor';
                addToGroup(label);
            } else {
                addToGroup('All tasks');
            }
        });

        const sortedGroups = Object.keys(groups).sort((a, b) => {
            if (a === 'Unassigned' || a === 'Unassigned auditor') return 1;
            if (b === 'Unassigned' || b === 'Unassigned auditor') return -1;
            return a.localeCompare(b);
        }).map(k => ({
            label: k,
            items: groups[k].sort((a, b) => {
                const timeA = new Date(a.task.startDate || a.task.createdAt).getTime();
                const timeB = new Date(b.task.startDate || b.task.createdAt).getTime();
                return timeA - timeB;
            })
        }));

        return sortedGroups || [];
    }, [tasks, groupBy, usersList, clientsList, startDate, endDate]);

    const safeDaysInterval = daysInterval || [];
    const safeGroupedTasks = groupedTasks || [];

    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] z-20">
                <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--border)]">
                    {(['NONE', 'ASSIGNEE', 'PHASE', 'AUDITOR'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setGroupBy(mode)}
                            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${
                                groupBy === mode 
                                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            {mode === 'NONE' ? 'Standard' : mode === 'ASSIGNEE' ? 'Staff wise' : mode === 'PHASE' ? 'Phase' : 'Auditor'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleToday} 
                        className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] text-[var(--text-heading)] rounded-[var(--radius-md)] text-xs font-medium transition-colors border border-[var(--border)]"
                    >
                        Today
                    </button>
                    <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-0.5 border border-[var(--border)]">
                        <button onClick={handlePrev} className="p-1 hover:bg-[var(--bg-secondary)] rounded-[var(--radius-sm)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-heading)]"><ChevronLeft size={14} /></button>
                        <span className="text-xs font-medium text-[var(--text-muted)] px-1.5">Timeline</span>
                        <button onClick={handleNext} className="p-1 hover:bg-[var(--bg-secondary)] rounded-[var(--radius-sm)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-heading)]"><ChevronRight size={14} /></button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-2.5 py-1 rounded-[var(--radius-md)] border border-[var(--border)] text-xs">
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="bg-transparent text-xs text-[var(--text-heading)] font-medium focus:outline-none cursor-pointer"
                        />
                        <span className="text-[var(--text-muted)]">—</span>
                        <input
                            type="date"
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="bg-transparent text-xs text-[var(--text-heading)] font-medium focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-auto custom-scrollbar relative bg-[var(--bg-main)]">
                <div className="min-w-max pb-20" style={{ width: SIDEBAR_WIDTH + (safeDaysInterval.length) * DAY_WIDTH }}>
                    
                    {/* Header Row (Dates) */}
                    <div className="sticky top-0 z-30 flex bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                        <div 
                            className="flex-shrink-0 border-r border-[var(--border)] px-4 py-2.5 flex items-end sticky left-0 z-40 bg-[var(--bg-secondary)]" 
                            style={{ width: SIDEBAR_WIDTH }}
                        >
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Task details</span>
                        </div>
                        <div className="flex">
                            {safeDaysInterval.map((day) => {
                                const today = isToday(day);
                                return (
                                    <div 
                                        key={day.toISOString()} 
                                        className={`flex-shrink-0 flex flex-col items-center justify-end py-2 border-r border-[var(--border)] transition-colors ${today ? 'bg-[var(--accent-dim)]' : ''}`}
                                        style={{ width: DAY_WIDTH }}
                                    >
                                        <span className={`text-[10px] font-medium mb-0.5 ${today ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'}`}>{format(day, 'EEE')}</span>
                                        <span className={`text-xs tabular-nums font-semibold ${today ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-heading)]'}`}>{format(day, 'd')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Data */}
                    <div className="relative">
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 flex pointer-events-none z-0">
                            <div className="flex-shrink-0 border-r border-[var(--border)]" style={{ width: SIDEBAR_WIDTH }} />
                            {safeDaysInterval.map(day => (
                                <div key={day.toISOString()} className={`flex-shrink-0 border-r border-[var(--border)] ${isToday(day) ? 'bg-[var(--accent-dim)] opacity-40' : ''}`} style={{ width: DAY_WIDTH }} />
                            ))}
                        </div>

                        {/* Content Rows */}
                        <div className="relative z-10 flex flex-col">
                            {safeGroupedTasks.length === 0 ? (
                                <div className="h-56 flex flex-col items-center justify-center text-center mt-8 sticky left-0 w-full">
                                    <CalendarIcon size={36} className="mb-3 text-[var(--text-muted)] opacity-30" />
                                    <p className="text-xs font-semibold text-[var(--text-heading)]">No tasks visible in this timeframe</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Try expanding the date range or adjusting filters</p>
                                </div>
                            ) : (
                                safeGroupedTasks.map((group, groupIdx) => (
                                    <div key={groupIdx} className="flex flex-col border-b border-[var(--border)]">
                                        
                                        {/* Group Header Row */}
                                        {groupBy !== 'NONE' && (
                                            <div className="flex w-full group bg-[var(--bg-secondary)]">
                                                <div 
                                                    className="flex-shrink-0 px-4 py-2 border-r border-[var(--border)] sticky left-0 z-20 bg-[var(--bg-secondary)] transition-colors"
                                                    style={{ width: SIDEBAR_WIDTH }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {groupBy === 'ASSIGNEE' && group.label !== 'Unassigned' ? (
                                                            (() => {
                                                                const user = usersList.find(u => u.displayName === group.label);
                                                                const av = getAvatarColor(user?.uid || '');
                                                                return (
                                                                    <div className={`w-5 h-5 rounded-full ${av.bg} ${av.text} flex items-center justify-center text-[9px] font-medium`}>
                                                                        {getInitials(group.label)}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-[var(--text-heading)] truncate">{group.label}</span>
                                                            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">({group.items?.length || 0})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-[var(--bg-surface)] opacity-50" />
                                            </div>
                                        )}

                                        {/* Task Rows */}
                                        {(group.items || []).map((item: any, itemIdx: number) => {
                                            const { task, offsetDays, durationDays, isCutStart, isCutEnd } = item;
                                            const isDone = task.status === TaskStatus.COMPLETED;
                                            const statusStyle = statusColorVars[task.status as TaskStatus] || statusColorVars[TaskStatus.NOT_STARTED];
                                            
                                            const visibleOffset = Math.max(0, offsetDays);
                                            const maxAvailableDuration = safeDaysInterval.length - visibleOffset;
                                            const visibleDuration = Math.min(durationDays, maxAvailableDuration);

                                            return (
                                                <div key={task.id || `task-${itemIdx}`} className="flex w-full relative group/row hover:bg-[var(--bg-surface)] transition-colors">
                                                    {/* Sidebar Context */}
                                                    <div 
                                                        className="flex-shrink-0 px-4 py-2.5 border-r border-[var(--border)] sticky left-0 z-20 bg-[var(--bg-main)] group-hover/row:bg-[var(--bg-surface)] transition-colors flex items-center gap-2.5 overflow-hidden cursor-pointer"
                                                        style={{ width: SIDEBAR_WIDTH }}
                                                        onClick={() => handleOpenEdit(task)}
                                                    >
                                                        {isDone ? <Check size={13} className="text-[var(--color-success)] flex-shrink-0" /> : <div className="w-3 h-3 rounded-[var(--radius-sm)] border border-[var(--border-mid)] flex-shrink-0" />}
                                                        <div className="min-w-0 flex-1">
                                                            <div className={`text-xs font-medium truncate ${isDone ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-heading)]'}`}>{task.title}</div>
                                                            <div className="text-[11px] text-[var(--text-muted)] truncate">{task.clientName || 'Internal'}</div>
                                                        </div>
                                                        {task.assignedTo?.length > 0 && (
                                                            <div className="flex -space-x-1 flex-shrink-0">
                                                                {(task.assignedTo || []).slice(0, 2).map((uid: string, i: number) => {
                                                                    const u = usersList.find(x => x.uid === uid);
                                                                    const av = getAvatarColor(uid);
                                                                    return (
                                                                        <div key={uid || `assignee-${i}`} className={`w-5 h-5 rounded-full ring-1 ring-[var(--bg-main)] flex items-center justify-center text-[8px] font-medium ${av.bg} ${av.text}`}>
                                                                            {getInitials(u?.displayName || '?')}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Timeline placement */}
                                                    <div className="relative py-2" style={{ width: (safeDaysInterval.length) * DAY_WIDTH }}>
                                                        <div 
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }}
                                                            className={`absolute top-1.5 bottom-1.5 rounded-[var(--radius-sm)] flex items-center px-2.5 cursor-pointer transition-colors overflow-hidden border ${isDone ? 'opacity-50' : 'opacity-90 hover:opacity-100'}`}
                                                            style={{ 
                                                                left: visibleOffset * DAY_WIDTH + 2,
                                                                width: Math.max(16, (visibleDuration * DAY_WIDTH) - 4),
                                                                background: statusStyle.bg,
                                                                borderColor: statusStyle.border,
                                                                borderLeft: isCutStart ? 'none' : undefined,
                                                                borderRight: isCutEnd ? 'none' : undefined,
                                                            }}
                                                        >
                                                            <div className="min-w-0 flex-1 truncate">
                                                                <span className="text-[11px] font-semibold truncate tracking-tight" style={{ color: statusStyle.text }}>
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
