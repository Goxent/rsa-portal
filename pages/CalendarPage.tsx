
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X, Edit, Trash2, Eye, EyeOff, Repeat, List, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AuthService } from '../services/firebase';
import { Task, CalendarEvent, UserRole, UserProfile } from '../types';
import { ComplianceEvent } from '../types/advanced';
import { useAuth } from '../context/AuthContext';
import EventModal from '../components/EventModal';
import EmptyState from '../components/common/EmptyState';
import { generateRecurringInstances, canEditEvent, canDeleteEvent, getVisibilityBadge, formatEventTime } from '../utils/eventUtils';
import { toBS, toAD } from '../utils/dates';
import { ComplianceService } from '../services/advanced';
import NepaliDate from 'nepali-date-converter';
import * as XLSX from 'xlsx';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useTasks, useUpdateTask } from '../hooks/useTasks';

// Helpers
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const bsMonths = [
    "Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

const DraggableTask = ({ task, canDrag }: { task: Task, canDrag: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `task-${task.id}`,
        disabled: !canDrag,
        data: { task }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onClick={(e) => { e.stopPropagation(); }}
        >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <div className="text-[10.5px] text-emerald-50 truncate font-bold leading-none">
                {task.title}
            </div>
        </div>
    );
};

const DroppableDay = ({ dateStr, isToday, isSelected, onClick, children }: any) => {
    const { isOver, setNodeRef } = useDroppable({
        id: dateStr,
    });

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className={`group relative min-h-[120px] p-3 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${isToday
                ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : isSelected
                    ? 'border-amber-500/50 bg-gradient-to-br from-blue-600/20 to-amber-900/10 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[1.02] z-10'
                    : 'border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07] hover:shadow-xl hover:scale-[1.01] hover:z-10'
                } ${isOver ? 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500/50' : ''}`}
        >
            {/* Hover Effect Light */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            {children}
        </div>
    );
};

const CalendarPage: React.FC = () => {
    const { user } = useAuth();

    // Core Calendar State
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showOnlyMyEvents, setShowOnlyMyEvents] = useState(false);

    // Queries
    const { data: allTasks = [] } = useTasks();
    const updateTaskMutation = useUpdateTask();
    const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

    // List View Filtering State
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [creatorFilter, setCreatorFilter] = useState<string>('ALL');

    useEffect(() => {
        fetchItems();
    }, [month, year, user]);

    const fetchItems = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [fetchedEvents, users] = await Promise.all([
                AuthService.getAllEventsForUser(user.uid, user.role, user.department || 'GENERAL'),
                AuthService.getAllUsers()
            ]);
            setEvents(fetchedEvents);
            setAllUsers(users);
        } catch (error) {
            console.error("Failed to fetch calendar data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const changeMonth = (delta: number) => {
        let newMonth = month + delta;
        let newYear = year;
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        setMonth(newMonth);
        setYear(newYear);
        setSelectedDate(null);
    };

    const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
        if (!user) return;
        setIsSaving(true);
        try {
            if (editingEvent) {
                await AuthService.updateEvent(editingEvent.id, eventData, user.uid, user.role);
            } else {
                await AuthService.saveEvent({
                    ...eventData as CalendarEvent,
                    createdBy: user.uid,
                    createdAt: new Date().toISOString()
                });
            }
            setIsModalOpen(false);
            setEditingEvent(undefined);
            fetchItems();
        } catch (error) {
            console.error("Failed to save event:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !confirm('Are you sure you want to delete this event?')) return;
        try {
            await AuthService.deleteEvent(event.id, user.uid, user.role);
            fetchItems();
        } catch (error) {
            console.error("Failed to delete event:", error);
        }
    };

    const handleEditEvent = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const handleOpenEventModal = (day?: number) => {
        if (day) setSelectedDate(day);
        setEditingEvent(undefined);
        setIsModalOpen(true);
    };

    const addToGoogleCalendar = (title: string, date: string, desc: string) => {
        const adDate = toAD(date);
        const start = adDate ? adDate.toISOString().split('T')[0].replace(/-/g, '') : '';
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${start}&details=${encodeURIComponent(desc)}`;
        window.open(url, '_blank');
    };

    // Bulk Actions
    const handleSelectEvent = (eventId: string) => {
        const newSelected = new Set(selectedEventIds);
        if (newSelected.has(eventId)) {
            newSelected.delete(eventId);
        } else {
            newSelected.add(eventId);
        }
        setSelectedEventIds(newSelected);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.task) {
            setActiveDragTask(active.data.current.task);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            setActiveDragTask(null);
            return;
        }

        const taskIdStr = active.id.toString();
        if (taskIdStr.startsWith('task-')) {
            const taskId = taskIdStr.replace('task-', '');
            const newDateStr = over.id.toString(); // We set id of DroppableDay to dateStr

            try {
                await updateTaskMutation.mutateAsync({ id: taskId, updates: { dueDate: newDateStr } });
                toast.success(`Task due date updated to ${newDateStr}`);
            } catch (error) {
                toast.error('Failed to update task due date');
            }
        }

        setActiveDragTask(null);
    };

    const handleSelectAll = () => {
        if (selectedEventIds.size === events.length) {
            setSelectedEventIds(new Set());
        } else {
            setSelectedEventIds(new Set(events.map(e => e.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (!user || selectedEventIds.size === 0) return;
        if (!confirm(`Delete ${selectedEventIds.size} events? This will remove all instances of recurring events.`)) return;

        setIsSaving(true);
        try {
            const masterIds = new Set<string>();
            selectedEventIds.forEach(id => {
                masterIds.add(id.split('_')[0]);
            });

            const promises = Array.from(masterIds).map(id =>
                AuthService.deleteEvent(id, user.uid, user.role)
            );

            await Promise.all(promises);
            fetchItems(); // Refresh
            setSelectedEventIds(new Set());
            toast.success("Events deleted successfully");
        } catch (error: any) {
            toast.error("Failed to delete some events");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkVisibility = async (visibility: string) => {
        if (!user || selectedEventIds.size === 0) return;

        setIsSaving(true);
        try {
            const masterIds = new Set<string>();
            selectedEventIds.forEach(id => masterIds.add(id.split('_')[0]));



            // ... existing code ...

            const promises = Array.from(masterIds).map(id =>
                AuthService.updateEvent(id, { visibility: visibility as any }, user.uid, user.role)
            );

            await Promise.all(promises);
            fetchItems();
            setSelectedEventIds(new Set());
            toast.success(`Updated visibility to ${visibility.toLowerCase()}`);
        } catch (error) {
            toast.error("Failed to update visibility");
        } finally {
            setIsSaving(false);
        }
    };

    const exportToCSV = () => {
        const data = events.map(ev => ({
            Date: ev.date,
            Time: ev.time || 'All Day',
            Title: ev.title,
            Type: ev.type,
            Visibility: ev.visibility || 'PUBLIC',
            Creator: allUsers.find(u => u.uid === ev.createdBy)?.displayName || 'System',
            Description: ev.description || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Calendar Audit");
        XLSX.writeFile(workbook, `RSA_Calendar_Log_${monthNames[month]}_${year}.xlsx`);
    };

    const getItemsForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(ev => ev.date === dateStr);
        const dayTasks = allTasks.filter(t => t.dueDate === dateStr);

        return { events: dayEvents, tasks: dayTasks, dateStr };
    };

    const { events: selectedDayEvents, tasks: selectedDayTasks } = selectedDate ? getItemsForDay(selectedDate) : { events: [], tasks: [] };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const blanks = Array(firstDay).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const totalSlots = [...blanks, ...days];

        return (
            <DndContext
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-7 gap-3 lg:gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <div key={d} className={`text-center text-[11px] font-black uppercase tracking-[0.2em] py-2 ${i === 6 ? 'text-rose-500 drop-shadow-sm' : 'text-emerald-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-3 lg:gap-4 auto-rows-fr">
                    {totalSlots.map((day, index) => {
                        if (!day) return <div key={`blank-${index}`} className="min-h-[120px] rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm"></div>;

                        const { events: dayEvents, tasks: dayTasks, dateStr } = getItemsForDay(day);
                        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                        const isSelected = day === selectedDate;

                        // Nepali Date for this day
                        const bsDateString = toBS(new Date(year, month, day));
                        const bsDay = bsDateString.split('-')[2];

                        return (
                            <DroppableDay
                                key={day}
                                dateStr={dateStr}
                                isToday={isToday}
                                isSelected={isSelected}
                                onClick={() => setSelectedDate(day)}
                            >
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <span className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all ${isToday
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                        : isSelected
                                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                                            : 'text-gray-300 group-hover:bg-white/10'}`}>
                                        {day}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium px-2 py-0.5 rounded-full bg-black/20 border border-white/5">
                                        {bsDay}
                                    </span>
                                </div>

                                <div className="space-y-1.5 mt-1 overflow-hidden flex-1 relative z-10">
                                    {dayTasks.slice(0, 3).map((task, i) => (
                                        <DraggableTask key={`task-${task.id}`} task={task} canDrag={user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER} />
                                    ))}
                                    {dayEvents.slice(0, Math.max(0, 3 - dayTasks.length)).map((ev, i) => (
                                        <div key={`ev-${ev.id || i}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 border border-white/20 hover:bg-white/20 transition-colors shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ backgroundColor: ev.color || '#fff' }}></div>
                                            <div className="text-[10.5px] text-white truncate font-bold leading-none">
                                                {ev.title}
                                            </div>
                                        </div>
                                    ))}
                                    {(dayEvents.length + dayTasks.length) > 3 && (
                                        <div className="text-[10px] text-gray-400 font-medium px-1">
                                            +{(dayEvents.length + dayTasks.length) - 3} more
                                        </div>
                                    )}
                                </div>
                            </DroppableDay>
                        );
                    })}
                </div>
                <DragOverlay>
                    {activeDragTask ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500 border border-blue-400 shadow-xl shadow-black/50 opacity-90 scale-105 rotate-2 cursor-grabbing pointer-events-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></div>
                            <div className="text-[10px] text-white truncate font-medium leading-none">
                                {activeDragTask.title}
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        );
    };

    const renderListView = () => {
        // Filter and Sort events
        const filteredEvents = events.filter(ev => {
            const matchesSearch = ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ev.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'ALL' || ev.type === typeFilter;
            const matchesCreator = creatorFilter === 'ALL' || ev.createdBy === creatorFilter;
            return matchesSearch && matchesType && matchesCreator;
        });

        const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return (
            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full border border-white/10">
                {/* Advanced Filter Toolbar */}
                <div className="p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 w-full">
                            <div className="relative flex-1 max-w-md group">
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white w-full focus:border-brand-500 focus:bg-black/40 transition-all outline-none placeholder:text-gray-500"
                                />
                                <div className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-brand-400 transition-colors">
                                    <List size={16} />
                                </div>
                            </div>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 transition-all cursor-pointer hover:bg-black/30"
                            >
                                <option value="ALL">All Types</option>
                                <option value="MEETING">Meeting</option>
                                <option value="DEADLINE">Deadline</option>
                                <option value="GENERAL">General</option>
                                <option value="PERSONAL">Personal</option>
                                <option value="FIRM_EVENT">Firm Event</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600/10 text-brand-300 border border-brand-500/20 rounded-xl text-sm font-bold hover:bg-brand-600/20 hover:border-brand-500/40 transition-all shadow-lg shadow-brand-500/5 group"
                            >
                                <FileDown size={16} className="group-hover:scale-110 transition-transform" />
                                <span>Export Log</span>
                            </button>
                        </div>
                    </div>

                    {/* Bulk Actions Bar */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSelectAll}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedEventIds.size === events.length && events.length > 0 ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/20' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                            >
                                {selectedEventIds.size === events.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedEventIds.size > 0 && (
                                <div className="flex items-center gap-2 p-1 bg-brand-500/10 rounded-xl border border-brand-500/20 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <span className="text-[10px] text-brand-300 font-bold px-3 uppercase tracking-wider">Bulk Actions:</span>
                                    <div className="h-4 w-px bg-brand-500/20"></div>
                                    <button
                                        onClick={() => handleBulkVisibility('PUBLIC')}
                                        className="px-3 py-1 hover:bg-brand-500/20 rounded-lg text-[10px] text-amber-300 font-bold uppercase transition-all"
                                    >
                                        Make Public
                                    </button>
                                    <button
                                        onClick={() => handleBulkVisibility('PRIVATE')}
                                        className="px-3 py-1 hover:bg-brand-500/20 rounded-lg text-[10px] text-gray-300 font-bold uppercase transition-all"
                                    >
                                        Make Private
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-[10px] text-red-400 font-bold uppercase transition-all flex items-center gap-1.5 border border-red-500/10 hover:border-red-500/30 ml-1"
                                    >
                                        <Trash2 size={10} /> Delete ({selectedEventIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            Showing {filteredEvents.length} of {events.length} events
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1 h-[60vh] custom-scrollbar bg-black/10">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#09090b] shadow-xl">
                            <tr className="border-b border-white/10 text-[10px] text-brand-200 uppercase font-black tracking-widest">
                                <th className="p-4 w-12 bg-white/5 backdrop-blur-md"></th>
                                <th className="p-4 bg-white/5 backdrop-blur-md">Date</th>
                                <th className="p-4 bg-white/5 backdrop-blur-md">Title</th>
                                <th className="p-4 bg-white/5 backdrop-blur-md">Type</th>
                                <th className="p-4 bg-white/5 backdrop-blur-md">Visibility</th>
                                <th className="p-4 bg-white/5 backdrop-blur-md">Creator</th>
                                <th className="p-4 text-right bg-white/5 backdrop-blur-md">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedEvents.map(event => {
                                const canEdit = user && canEditEvent(event, user);
                                const isSelected = selectedEventIds.has(event.id);
                                return (
                                    <tr key={event.id} className={`hover:bg-white/[0.03] transition-all group ${isSelected ? 'bg-brand-900/10' : ''}`}>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectEvent(event.id)}
                                                    className="w-4 h-4 rounded border-brand-500/30 bg-black/20 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer transition-all"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-300 font-mono whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white tracking-tight">{event.date}</span>
                                                <span className="text-[10px] text-gray-500 font-medium bg-white/5 w-fit px-1.5 rounded mt-0.5">{event.time || 'All Day'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ring-2 ring-white/5`} style={{ color: event.color || '#8b5cf6', backgroundColor: 'currentColor' }}></div>
                                                <div>
                                                    <span className="font-bold text-white group-hover:text-brand-300 transition-colors block">{event.title}</span>
                                                    {event.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{event.description}</p>}
                                                </div>
                                                {event.isRecurring && <Repeat size={14} className="text-emerald-400 shrink-0 opacity-70" />}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 bg-white/5 rounded-lg text-[10px] text-gray-300 font-bold uppercase tracking-tight border border-white/5 group-hover:border-white/10 transition-colors">
                                                {event.type.toLowerCase().replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold border shadow-sm ${getVisibilityBadge(event.visibility || 'PUBLIC').color}`}>
                                                {getVisibilityBadge(event.visibility || 'PUBLIC').text}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-300 border border-brand-500/20 shadow-inner">
                                                    {(allUsers.find(u => u.uid === event.createdBy)?.displayName || 'S')[0]}
                                                </div>
                                                <span className="text-xs text-gray-400">{allUsers.find(u => u.uid === event.createdBy)?.displayName || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                {canEdit && (
                                                    <button
                                                        onClick={(e) => handleEditEvent(event, e)}
                                                        className="p-1.5 hover:bg-amber-500/20 rounded-lg text-gray-400 hover:text-amber-300 transition-all border border-transparent hover:border-amber-500/20"
                                                        title="Edit"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => addToGoogleCalendar(event.title, event.date, event.description || '')}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                                    title="Add to G-Cal"
                                                >
                                                    <ExternalLink size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full p-4 md:p-6 bg-transparent">
            <div className="flex flex-col space-y-6 animate-in fade-in duration-500 pb-32">
                {/* Header Section */}
                <div className="flex flex-col xl:flex-row justify-between items-center gap-6 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CalendarIcon className="text-amber-400" />
                            Firm Calendar
                        </h1>
                    <p className="text-sm text-gray-400">Track task deadlines, meetings, and important firm events.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-white/10 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                        <button
                            onClick={() => setViewMode('GRID')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'GRID' ? 'bg-white text-blue-900 shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                        >
                            <CalendarIcon size={16} /> <span className="hidden sm:inline">Grid</span>
                        </button>
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'LIST' ? 'bg-white text-blue-900 shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                        >
                            <List size={16} /> <span className="hidden sm:inline">List</span>
                        </button>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center bg-black/20 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                        <div className="flex flex-col items-center px-4 min-w-[140px]">
                            <span className="text-lg font-bold text-white leading-none">{monthNames[month]} {year}</span>
                            <span className="text-[10px] text-brand-300 font-bold uppercase tracking-wider mt-1">
                                {(() => {
                                    const bs = toBS(new Date(year, month, 1)).split('-');
                                    return `${bsMonths[parseInt(bs[1]) - 1]} ${bs[0]}`;
                                })()}
                            </span>
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>


            {
                viewMode === 'GRID' ? (
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Main Calendar Grid */}
                        <div className="flex-1 glass-panel rounded-2xl p-4 lg:p-6 shadow-2xl">
                            {renderCalendarGrid()}
                        </div>

                        <div className="w-full lg:w-96 glass-panel rounded-2xl flex flex-col shadow-2xl h-[calc(100vh-280px)] sticky top-6 border border-white/10 shrink-0">
                            {/* Sidebar Header */}
                            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <CalendarIcon size={64} />
                                </div>
                                <div className="flex items-center justify-between mb-2 relative z-10">
                                    <h3 className="text-xl font-bold text-white flex items-center tracking-tight">
                                        {selectedDate ? `${monthNames[month]} ${selectedDate}` : 'Select a date'}
                                    </h3>
                                    <button
                                        onClick={() => handleOpenEventModal(selectedDate || undefined)}
                                        className="p-2.5 bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl text-white hover:from-brand-500 hover:to-brand-400 transition-all shadow-lg shadow-brand-500/30 transform hover:scale-105 active:scale-95"
                                        title="Create event"
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                </div>
                                {selectedDate && (
                                    <div className="flex items-center gap-2 relative z-10">
                                        <div className="h-1.5 w-1.5 rounded-full bg-brand-400"></div>
                                        <span className="text-xs text-brand-200 font-bold uppercase tracking-widest">
                                            {(() => {
                                                const bs = toBS(new Date(year, month, selectedDate)).split('-');
                                                return `${bsMonths[parseInt(bs[1]) - 1]} ${bs[2]}, ${bs[0]}`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Toggle for showing only my events */}
                            <div className="px-6 py-3 border-b border-white/5 bg-black/10">
                                <button
                                    onClick={() => setShowOnlyMyEvents(!showOnlyMyEvents)}
                                    className="flex items-center text-xs font-bold text-gray-400 hover:text-white transition-colors w-full"
                                >
                                    <div className={`w-8 h-4 rounded-full mr-3 relative transition-colors ${showOnlyMyEvents ? 'bg-brand-500' : 'bg-gray-700'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${showOnlyMyEvents ? 'left-4.5' : 'left-0.5'}`}></div>
                                    </div>
                                    {showOnlyMyEvents ? 'Showing only my events' : 'Showing all events'}
                                </button>
                            </div>

                            <div className="space-y-4 flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {/* Event Items */}
                                {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 ? (
                                    <EmptyState
                                        icon={CalendarIcon}
                                        title="No events for this date"
                                        description="No events or tasks scheduled for this day. Click + to add an event."
                                        className="h-48"
                                    />
                                ) : (
                                    <>
                                        {selectedDayEvents.map((ev, i) => {
                                            const eventWithDefaults = {
                                                ...ev,
                                                visibility: ev.visibility || 'PUBLIC',
                                                createdBy: ev.createdBy || 'system',
                                                type: ev.type || 'GENERAL'
                                            };

                                            const badge = getVisibilityBadge(eventWithDefaults.visibility);
                                            const canEdit = user && canEditEvent(eventWithDefaults, user);
                                            const canDelete = user && canDeleteEvent(eventWithDefaults, user);

                                            return (
                                                <div key={i} className="group relative p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all shadow-lg">
                                                    <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-lg" style={{ backgroundColor: ev.color || '#8b5cf6' }}></div>

                                                    <div className="pl-3">
                                                        <div className="flex items-start justify-between mb-1">
                                                            <h4 className="text-sm font-bold text-white leading-tight">{eventWithDefaults.title}</h4>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={(e) => handleEditEvent(eventWithDefaults, e)}
                                                                        className="p-1.5 hover:bg-amber-500/20 rounded text-amber-400 transition-colors"
                                                                    >
                                                                        <Edit size={12} />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={(e) => handleDeleteEvent(eventWithDefaults, e)}
                                                                        className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 mb-3 items-center">
                                                            <span className="flex items-center bg-black/30 px-1.5 py-0.5 rounded text-gray-300">
                                                                <Clock size={10} className="mr-1" />
                                                                {formatEventTime(eventWithDefaults)}
                                                            </span>
                                                            <span className="uppercase font-bold tracking-wider">{eventWithDefaults.type.replace('_', ' ')}</span>
                                                            {eventWithDefaults.isRecurring && (
                                                                <span className="text-emerald-400 flex items-center font-bold">
                                                                    <Repeat size={10} className="mr-1" /> Recurring
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${badge.color}`}>
                                                                {badge.text}
                                                            </span>
                                                            <button
                                                                onClick={() => addToGoogleCalendar(eventWithDefaults.title, eventWithDefaults.date, eventWithDefaults.description || '')}
                                                                className="text-[10px] text-gray-400 hover:text-white flex items-center hover:underline transition-colors"
                                                            >
                                                                <ExternalLink size={10} className="mr-1" /> export
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {selectedDayTasks.map((task, i) => (
                                            <div key={i} className="group flex flex-col p-4 rounded-xl bg-gradient-to-br from-amber-900/10 to-blue-900/5 hover:bg-blue-900/20 border border-amber-500/10 hover:border-amber-500/30 transition-all">
                                                <div className="flex items-start space-x-3 mb-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">{task.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">TASK</span>
                                                            <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{task.clientName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addToGoogleCalendar(task.title, task.dueDate, `Client: ${task.clientName}`)}
                                                    className="mt-1 text-xs flex items-center justify-center w-full py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 rounded-lg border border-amber-500/20 transition-all font-bold hover:shadow-lg hover:shadow-blue-500/10"
                                                >
                                                    <ExternalLink size={12} className="mr-2" /> Add to G-Cal
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden">
                        {renderListView()}
                    </div>
                )
            }

            {/* EventModal Component */}
            <EventModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingEvent(undefined);
                }}
                onSave={handleSaveEvent}
                event={editingEvent}
                selectedDate={selectedDate ? (() => {
                    const d = new Date(year, month, selectedDate);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                })() : undefined}
                user={user!}
                allUsers={allUsers}
            />
        </div>
        </div>
    );
};

export default CalendarPage;
