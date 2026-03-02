import React, { useMemo, useState } from 'react';
import { Task, UserProfile, Client, TaskStatus, TaskPriority } from '../../types';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Tag, CheckCircle2, Circle } from 'lucide-react';

interface TaskTimelineViewProps {
    tasks: Task[];
    usersList: UserProfile[];
    clientsList: Client[];
    handleOpenEdit: (task: Task) => void;
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE';
}

const statusColors: Record<TaskStatus, string> = {
    [TaskStatus.NOT_STARTED]: 'bg-slate-500',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-500',
    [TaskStatus.UNDER_REVIEW]: 'bg-amber-500',
    [TaskStatus.HALTED]: 'bg-red-500',
    [TaskStatus.COMPLETED]: 'bg-emerald-500',
    [TaskStatus.ARCHIVED]: 'bg-gray-600',
};

// 14 days view
const DAYS_TO_SHOW = 14;

const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({
    tasks,
    usersList,
    clientsList,
    handleOpenEdit,
    groupBy
}) => {
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

    const handlePrev = () => setStartDate(prev => subWeeks(prev, 1));
    const handleNext = () => setStartDate(prev => addWeeks(prev, 1));
    const handleToday = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

    const days = useMemo(() => {
        return Array.from({ length: DAYS_TO_SHOW }).map((_, i) => addDays(startDate, i));
    }, [startDate]);

    // Group tasks
    const groupedTasks = useMemo(() => {
        const groups: Record<string, typeof tasks> = {};

        tasks.forEach(task => {
            // Give tasks without due date a generic placeholder or filter them out?
            // Usually Gantt needs start/end. Since we only have dueDate and createdAt, we estimate duration.
            // Let's filter out tasks without a due date to keep the timeline clean.
            if (!task.dueDate) return;

            // Determine group key
            let key = 'All Tasks';
            if (groupBy === 'ASSIGNEE') {
                if (!task.assignedTo || task.assignedTo.length === 0) {
                    key = 'Unassigned';
                } else {
                    // For simplicity, just use the first assignee for grouping in timeline
                    const u = usersList.find(u => u.uid === task.assignedTo[0]);
                    key = u?.displayName || 'Unknown Staff';
                }
            } else if (groupBy === 'AUDITOR') {
                const tc = clientsList.find(c => task.clientIds?.includes(c.id));
                key = tc?.signingAuthority || 'Unassigned Auditor';
            } else {
                // By default, let's group by Client if NONE is selected, as it's most useful.
                if (!task.clientName) {
                    key = 'Internal / No Client';
                } else {
                    key = task.clientName;
                }
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(task);
        });

        // Sort groups alphabetically
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {} as Record<string, typeof tasks>);
    }, [tasks, groupBy, usersList, clientsList]);

    // Calculate position and width of a task bar
    const getTaskStyle = (task: Task) => {
        const due = new Date(task.dueDate!);
        const created = new Date(task.createdAt);

        // Boundaries
        const viewStart = days[0];
        const viewEnd = days[days.length - 1];

        // If completely outside view, return null
        if (due < viewStart || created > viewEnd) {
            return null;
        }

        // Clamp dates to view bounds
        const start = created < viewStart ? viewStart : created;
        const end = due > viewEnd ? viewEnd : due;

        const totalMs = viewEnd.getTime() - viewStart.getTime();

        // Calculate percentages
        const leftPct = Math.max(0, ((start.getTime() - viewStart.getTime()) / totalMs) * 100);
        const rightPct = Math.min(100, ((end.getTime() - viewStart.getTime()) / totalMs) * 100);
        const widthPct = Math.max(2, rightPct - leftPct); // min 2% width so it's visible

        return {
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            colorClass: statusColors[task.status] || 'bg-slate-500'
        };
    };

    return (
        <div className="h-full flex flex-col bg-[#0a0f1e]/40 custom-scrollbar overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0f172a]/50 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={handleToday} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 transition-colors">
                        Today
                    </button>
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/5">
                        <button onClick={handlePrev} className="p-1 hover:bg-white/10 rounded-md transition-colors"><ChevronLeft size={16} className="text-gray-400" /></button>
                        <span className="text-sm font-bold text-white px-2 min-w-[140px] text-center">
                            {format(days[0], 'MMM d')} - {format(days[days.length - 1], 'MMM d, yyyy')}
                        </span>
                        <button onClick={handleNext} className="p-1 hover:bg-white/10 rounded-md transition-colors"><ChevronRight size={16} className="text-gray-400" /></button>
                    </div>
                </div>
                <div className="text-xs font-medium text-gray-500 flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> In Progress</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Halted</div>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto custom-scrollbar relative flex flex-col">

                {/* Headers */}
                <div className="flex sticky top-0 z-20 bg-[#0f172a] border-b border-white/10 shadow-md">
                    <div className="w-64 flex-shrink-0 border-r border-white/5 p-4 flex items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {groupBy === 'ASSIGNEE' ? 'Staff' : groupBy === 'AUDITOR' ? 'Auditor' : 'Client'}
                        </span>
                    </div>
                    <div className="flex-1 flex relative">
                        {days.map((d, i) => {
                            const isToday = isSameDay(d, new Date());
                            return (
                                <div key={i} className="flex-1 min-w-[60px] border-r border-white/5 p-2 flex flex-col items-center justify-center">
                                    <span className={`text-[10px] font-bold ${isToday ? 'text-blue-400' : 'text-gray-500'}`}>{format(d, 'EEE')}</span>
                                    <span className={`text-sm font-black ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{format(d, 'd')}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Rows Container */}
                <div className="flex-1 flex flex-col pb-20">

                    {/* Background grid lines */}
                    <div className="absolute top-[65px] bottom-0 left-64 right-0 flex pointer-events-none z-0">
                        {days.map((d, i) => (
                            <div key={i} className={`flex-1 min-w-[60px] border-r border-white-[0.02] ${isSameDay(d, new Date()) ? 'bg-blue-500/[0.02]' : ''}`} />
                        ))}
                    </div>

                    {Object.keys(groupedTasks).length === 0 ? (
                        <div className="p-12 text-center text-gray-500 z-10 w-full flex flex-col items-center">
                            <CalendarIcon size={32} className="mb-4 text-gray-700" />
                            <p className="font-semibold">No tasks scheduled in this timeframe.</p>
                            <p className="text-sm mt-1">Try adjusting the dates or ensuring tasks have deadlines.</p>
                        </div>
                    ) : (
                        Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
                            <div key={groupName} className="flex border-b border-white/[0.03] group hover:bg-white/[0.01] transition-colors relative z-10">
                                {/* Group Label (Left Column) */}
                                <div className="w-64 flex-shrink-0 p-4 border-r border-white/[0.03] flex flex-col justify-center bg-[#0a0f1e]/80">
                                    <span className="text-sm font-bold text-gray-200 line-clamp-1" title={groupName}>{groupName}</span>
                                    <span className="text-[10px] font-medium text-gray-500">{groupTasks.length} task{groupTasks.length !== 1 ? 's' : ''}</span>
                                </div>

                                {/* Gantt Area */}
                                <div className="flex-1 relative py-2 min-h-[60px]">
                                    {groupTasks.map(task => {
                                        const style = getTaskStyle(task);
                                        if (!style) return null; // Outside viewport

                                        const isCompleted = task.status === TaskStatus.COMPLETED;

                                        return (
                                            <div
                                                key={task.id}
                                                className="relative h-7 mb-1.5 last:mb-0 min-w-[20px] cursor-pointer group/bar px-1"
                                                style={{ left: style.left, width: style.width }}
                                                onClick={() => handleOpenEdit(task)}
                                                title={`${task.title} \nDue: ${new Date(task.dueDate!).toLocaleDateString()}`}
                                            >
                                                <div className={`w-full h-full rounded-md ${style.colorClass} ${isCompleted ? 'opacity-50' : 'opacity-90'} group-hover/bar:brightness-110 group-hover/bar:shadow-lg transition-all border border-black/20 flex items-center px-2 overflow-hidden`}>
                                                    <span className="text-[10px] font-bold text-white/90 truncate drop-shadow-md">
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};

export default TaskTimelineView;
