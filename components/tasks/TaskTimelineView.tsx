import React, { useMemo, useState } from 'react';
import { Task, UserProfile, Client, TaskStatus } from '../../types';
import { format, subDays, addDays, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

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
    // Defaults: show past 7 days to next 21 days
    const [startDateStr, setStartDateStr] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDateStr, setEndDateStr] = useState(() => format(addDays(new Date(), 21), 'yyyy-MM-dd'));

    const handlePrev = () => {
        setStartDateStr(prev => format(subDays(new Date(prev), 7), 'yyyy-MM-dd'));
        setEndDateStr(prev => format(subDays(new Date(prev), 7), 'yyyy-MM-dd'));
    };

    const handleNext = () => {
        setStartDateStr(prev => format(addDays(new Date(prev), 7), 'yyyy-MM-dd'));
        setEndDateStr(prev => format(addDays(new Date(prev), 7), 'yyyy-MM-dd'));
    };

    const handleToday = () => {
        setStartDateStr(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
        setEndDateStr(format(addDays(new Date(), 21), 'yyyy-MM-dd'));
    };

    const startMs = startOfDay(new Date(startDateStr)).getTime();
    const endMs = endOfDay(new Date(endDateStr)).getTime();

    const chartData = useMemo(() => {
        const rawData = tasks.map((task, index) => {
            const tStart = startOfDay(new Date(task.createdAt)).getTime();
            // If due date is missing, treat as due in +2 days from start to give it some visual presence
            const tEnd = task.dueDate ? endOfDay(new Date(task.dueDate)).getTime() : startOfDay(addDays(new Date(task.createdAt), 2)).getTime();

            let groupLabel = 'All Tasks';
            if (groupBy === 'PHASE') {
                groupLabel = task.auditPhase ? task.auditPhase.replace(/_/g, ' ') : 'No Phase';
            } else if (groupBy === 'ASSIGNEE') {
                if (!task.assignedTo || task.assignedTo.length === 0) {
                    groupLabel = 'Unassigned';
                } else {
                    const u = usersList.find(u => u.uid === task.assignedTo[0]);
                    groupLabel = u?.displayName || 'Unknown Staff';
                }
            } else if (groupBy === 'AUDITOR') {
                const tc = clientsList.find(c => task.clientIds?.includes(c.id));
                groupLabel = tc?.signingAuthority || 'Unassigned Auditor';
            } else {
                groupLabel = task.clientName || 'Internal / No Client';
            }

            // Ensure min length visual representation for Gantt bar (prevent 0 width lines)
            const resolvedStart = Math.min(tStart, tEnd);
            let resolvedEnd = Math.max(tStart, tEnd);
            if (resolvedEnd - resolvedStart < 86400000) resolvedEnd = resolvedStart + 86400000;

            return {
                id: task.id + '-' + index, // Ensure unique keys
                name: task.title,
                group: groupLabel,
                dateRange: [Math.max(resolvedStart, startMs), Math.min(resolvedEnd, endMs)],
                color: statusColors[task.status] || '#64748B',
                originalStart: resolvedStart,
                originalEnd: resolvedEnd,
                status: task.status,
                taskRef: task
            };
        });

        // Filter tasks entirely outside window
        const filteredData = rawData.filter(d => !(d.originalEnd < startMs || d.originalStart > endMs));

        // Sort by group and then start date
        filteredData.sort((a, b) => {
            if (a.group !== b.group) return a.group.localeCompare(b.group);
            return a.originalStart - b.originalStart;
        });

        return filteredData;
    }, [tasks, groupBy, usersList, clientsList, startMs, endMs]);

    // Custom tick component
    const renderCustomAxisTick = (props: any) => {
        const { x, y, payload, index } = props;
        const currentData = chartData[index];
        const prevData = index > 0 ? chartData[index - 1] : null;

        const showGroup = prevData ? currentData.group !== prevData.group : true;

        return (
            <g transform={`translate(${x},${y})`}>
                {showGroup && (
                    <text x={-10} y={-24} textAnchor="end" fill="#94A3B8" fontSize={11} fontWeight="bold" className="uppercase tracking-wider">
                        {currentData.group.length > 25 ? currentData.group.substring(0, 25) + '...' : currentData.group}
                    </text>
                )}
                <text x={-10} y={4} textAnchor="end" fill="#E2E8F0" fontSize={12}>
                    <title>{currentData.name}</title>
                    {currentData.name.length > 25 ? currentData.name.substring(0, 25) + '...' : currentData.name}
                </text>
            </g>
        );
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-sm z-50 min-w-[200px]">
                    <p className="font-bold text-white mb-1">{data.name}</p>
                    <p className="text-slate-400 text-xs mb-3 font-semibold pb-2 border-b border-slate-700">{data.group}</p>
                    <div className="flex flex-col gap-1 text-xs">
                        <div>
                            <span className="text-slate-500 inline-block w-12">Start:</span>
                            <span className="text-slate-300 font-medium">{format(new Date(data.originalStart), 'MMM d, yyyy')}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 inline-block w-12">Due:</span>
                            <span className="text-slate-300 font-medium">{format(new Date(data.originalEnd), 'MMM d, yyyy')}</span>
                        </div>
                    </div>
                    <div className="mt-3 text-xs pt-2 border-t border-slate-700 flex items-center gap-2">
                        <span className="text-slate-500">Status:</span>
                        <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: data.color, backgroundColor: `${data.color}20` }}>
                            {data.status.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col bg-[#0a0f1e]/40 overflow-hidden relative">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/5 bg-[#09090b]/50 flex-shrink-0 gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleToday} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 transition-colors border border-white/10">
                        Today
                    </button>
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5 border border-white/5 shadow-inner">
                        <button onClick={handlePrev} className="p-1 hover:bg-white/10 rounded-md transition-colors"><ChevronLeft size={16} className="text-gray-400 hover:text-white" /></button>
                        <span className="text-sm font-bold text-gray-300 px-2 uppercase tracking-wide text-[10px]">Window</span>
                        <button onClick={handleNext} className="p-1 hover:bg-white/10 rounded-md transition-colors"><ChevronRight size={16} className="text-gray-400 hover:text-white" /></button>
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5 pointer-events-auto">
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="bg-transparent text-xs text-brand-400 font-semibold focus:outline-none cursor-pointer"
                        />
                        <span className="text-gray-600 text-xs font-bold leading-none">-</span>
                        <input
                            type="date"
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="bg-transparent text-xs text-brand-400 font-semibold focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: statusColors[TaskStatus.NOT_STARTED] }} /> Not Started</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: statusColors[TaskStatus.IN_PROGRESS] }} /> In Progress</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: statusColors[TaskStatus.UNDER_REVIEW] }} /> Review</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: statusColors[TaskStatus.COMPLETED] }} /> Completed</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: statusColors[TaskStatus.HALTED] }} /> Halted</div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 p-2 md:p-6 overflow-y-auto custom-scrollbar relative z-10">
                {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-white/[0.02] rounded-2xl border border-white/5">
                        <CalendarIcon size={48} className="mb-4 text-gray-600 opacity-50" />
                        <p className="font-bold text-gray-400">No tasks visible in this timeframe.</p>
                        <p className="text-xs mt-1 text-gray-500">Try zooming out or adjusting filters.</p>
                    </div>
                ) : (
                    <div style={{ height: Math.max(100 + chartData.length * 60, 400) }} className="w-full bg-white/[0.01] rounded-2xl border border-white/[0.05] p-4 pr-8 pt-8 shadow-inner">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 10, right: 30, left: 180, bottom: 20 }}
                                barSize={24}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} vertical={true} />
                                <XAxis
                                    type="number"
                                    domain={[startMs, endMs]}
                                    tickFormatter={(tick) => format(new Date(tick), 'MMM d')}
                                    stroke="#334155"
                                    tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                                    scale="time"
                                    orientation="top"
                                    axisLine={{ stroke: '#334155' }}
                                    tickLine={{ stroke: '#334155' }}
                                    allowDataOverflow
                                />
                                <YAxis
                                    type="category"
                                    dataKey="id"
                                    stroke="#334155"
                                    tick={renderCustomAxisTick}
                                    interval={0}
                                    axisLine={{ stroke: '#334155' }}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: '#ffffff05' }}
                                    isAnimationActive={false}
                                />
                                <Bar
                                    dataKey="dateRange"
                                    radius={[4, 4, 4, 4]}
                                    onClick={(data) => {
                                        if (data && data.payload && data.payload.taskRef) {
                                            handleOpenEdit(data.payload.taskRef);
                                        }
                                    }}
                                    style={{ cursor: 'pointer', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
                                    isAnimationActive={true}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            className="hover:brightness-125 transition-all duration-300"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskTimelineView;
