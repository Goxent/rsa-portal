
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X, Edit, Trash2, Eye, EyeOff, Repeat, List, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AuthService } from '../services/firebase';
import { Task, CalendarEvent, UserRole, UserProfile } from '../types';
import { ComplianceEvent } from '../types/advanced';
import { useAuth } from '../context/AuthContext';
import EventModal from '../components/EventModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import EmptyState from '../components/common/EmptyState';
import { generateRecurringInstances, canEditEvent, canDeleteEvent, getVisibilityBadge, formatEventTime } from '../utils/eventUtils';
import { toBS, toAD } from '../utils/dates';
import { ComplianceService } from '../services/advanced';
import NepaliDate from 'nepali-date-converter';
import * as XLSX from 'xlsx';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { useMedia } from 'react-use';

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
            style={{ ...style, background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' }}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onClick={(e) => { e.stopPropagation(); }}
        >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }}></div>
            <div className="text-[11px] truncate font-bold leading-none" style={{ color: 'var(--text-heading)' }}>
                {task.clientName || task.title}
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
            className={`group relative min-h-[110px] p-2.5 rounded-xl border transition-colors duration-150 cursor-pointer overflow-hidden flex flex-col ${
                isOver ? 'ring-2 ring-offset-1 ring-[var(--accent)]' : ''
            }`}
            style={{
                background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                borderColor: isSelected ? 'var(--border-accent)' : 'var(--border)',
                outline: isToday ? '2px solid var(--accent)' : 'none',
                outlineOffset: '-1px'
            }}
        >
            {children}
        </div>
    );
};

const CalendarPage: React.FC = () => {
    React.useEffect(() => {
        document.title = 'Calendar — RSA';
        return () => { document.title = 'RSA'; };
    }, []);
    const { user } = useAuth();
    const isMobile = useMedia('(max-width: 768px)', false);

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

    // Permission-based Task Filtering
    const filteredTasks = React.useMemo(() => {
        if (!user) return [];
        // Admin and Master Admin see all tasks
        if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) {
            return allTasks;
        }
        // Staff only see tasks where they are in the assignedTo list
        return allTasks.filter(t => t.assignedTo?.includes(user.uid));
    }, [allTasks, user]);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        variant?: 'danger' | 'warning' | 'info';
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });
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
        // CA4 Fix: Clamp selected day to valid days in the new month instead of resetting
        if (selectedDate !== null) {
            const maxDays = getDaysInMonth(newYear, newMonth);
            setSelectedDate(Math.min(selectedDate, maxDays));
        }
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

    const handleDeleteEvent = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        setConfirmModal({
            open: true,
            title: 'Delete Event',
            message: `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
            confirmLabel: 'Delete Event',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await AuthService.deleteEvent(event.id, user.uid, user.role);
                    fetchItems();
                    toast.success('Event deleted');
                } catch (error) {
                    console.error("Failed to delete event:", error);
                    toast.error("Failed to delete event");
                }
            }
        });
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

    const handleBulkDelete = () => {
        if (!user || selectedEventIds.size === 0) return;
        setConfirmModal({
            open: true,
            title: 'Delete Selected Events',
            message: `Are you sure you want to delete ${selectedEventIds.size} events? This will remove all instances of recurring events.`,
            confirmLabel: `Delete (${selectedEventIds.size})`,
            variant: 'danger',
            onConfirm: async () => {
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
                    fetchItems();
                    setSelectedEventIds(new Set());
                    toast.success("Events deleted successfully");
                } catch (error: any) {
                    toast.error("Failed to delete some events");
                } finally {
                    setIsSaving(false);
                }
            }
        });
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
        const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);

        return { events: dayEvents, tasks: dayTasks, dateStr };
    };

    const { events: selectedDayEvents, tasks: selectedDayTasks } = selectedDate ? getItemsForDay(selectedDate) : { events: [], tasks: [] };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const blanks = Array(firstDay).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const totalSlots = [...blanks, ...days];

        if (isMobile) {
            return (
                <div className="flex flex-col gap-6">
                    {/* Horizontal Day Strip */}
                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar px-1 -mx-4 md:mx-0 sm:px-4">
                        {days.map((day) => {
                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                            const isSelected = day === selectedDate;
                            const { events: dayEvents, tasks: dayTasks } = getItemsForDay(day);
                            const hasItems = dayEvents.length > 0 || dayTasks.length > 0;

                            return (
                                <button
                                    key={`strip-${day}`}
                                    onClick={() => setSelectedDate(day)}
                                    className="flex-shrink-0 w-12 h-16 rounded-xl flex flex-col items-center justify-center transition-colors border"
                                    style={{
                                        background: isSelected 
                                            ? 'var(--accent)' 
                                            : isToday 
                                                ? 'var(--accent-dim)' 
                                                : 'var(--bg-surface)',
                                        borderColor: isSelected 
                                            ? 'var(--border-accent)' 
                                            : isToday 
                                                ? 'var(--accent)' 
                                                : 'var(--border)',
                                        color: isSelected 
                                            ? 'var(--on-accent)' 
                                            : isToday 
                                                ? 'var(--accent)' 
                                                : 'var(--text-heading)'
                                    }}
                                >
                                    <span className="text-[10px] font-medium opacity-70">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(year, month, day).getDay()]}
                                    </span>
                                    <span className="text-base font-bold tabular-nums">{day}</span>
                                    {hasItems && !isSelected && (
                                        <div className="w-1 h-1 rounded-full mt-1" style={{ background: 'var(--accent)' }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Day Agenda */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                                <span className="w-1.5 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
                                {selectedDate ? `${monthNames[month]} ${selectedDate}, ${year}` : 'Select a date'}
                            </h3>
                            <button
                                onClick={() => handleOpenEventModal(selectedDate || undefined)}
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-opacity"
                                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        {selectedDate && (
                            <div className="space-y-3">
                                {[...selectedDayTasks, ...selectedDayEvents].length === 0 ? (
                                    <div className="py-8 rounded-xl border border-dashed flex flex-col items-center justify-center text-center px-4" style={{ borderColor: 'var(--border)' }}>
                                        <CalendarIcon size={32} className="mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                                        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No schedule for this day</p>
                                        <button 
                                            onClick={() => handleOpenEventModal(selectedDate)}
                                            className="mt-3 text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}
                                        >
                                            Add entry
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {selectedDayTasks.map((task) => (
                                            <div 
                                                key={task.id}
                                                className="p-3 rounded-lg border flex items-center gap-3 transition-colors" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                                    <CheckCircle2 size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--accent)' }}>Task assignment</p>
                                                    <h4 className="font-semibold truncate text-xs" style={{ color: 'var(--text-heading)' }}>{task.title}</h4>
                                                    {task.clientName && <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{task.clientName}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Due</p>
                                                    <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{task.dueDate?.split('-').slice(1).join('/')}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedDayEvents.map((ev) => (
                                            <div 
                                                key={ev.id}
                                                onClick={(e) => handleEditEvent(ev, e)}
                                                className="p-3 rounded-lg border flex items-center gap-3 transition-colors cursor-pointer" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ backgroundColor: `${ev.color}15`, borderColor: `${ev.color}30`, color: ev.color }}>
                                                    <Clock size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-[10px] font-semibold" style={{ color: ev.color }}>{ev.type}</p>
                                                        {ev.isRecurring && <Repeat size={10} style={{ color: 'var(--text-muted)' }} />}
                                                    </div>
                                                    <h4 className="font-semibold truncate text-xs" style={{ color: 'var(--text-heading)' }}>{ev.title}</h4>
                                                    {ev.time && <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{ev.time}</p>}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => handleDeleteEvent(ev, e)} className="p-2 transition-colors" style={{ color: 'var(--text-muted)' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <DndContext
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-7 gap-3 lg:gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <div key={d} className="text-center text-xs font-semibold py-1.5" style={{ color: i === 6 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-3 lg:gap-4 auto-rows-fr">
                    {totalSlots.map((day, index) => {
                        if (!day) return <div key={`blank-${index}`} className="min-h-[120px] rounded-xl border border-transparent opacity-30"></div>;

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
                                    <span className={`text-base font-bold w-7 h-7 flex items-center justify-center rounded-lg transition-colors tabular-nums ${isToday
                                        ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                                        : isSelected
                                            ? 'bg-[var(--bg-elevated)] border border-[var(--border-accent)] text-[var(--text-heading)]'
                                            : 'text-[var(--text-heading)] group-hover:bg-[var(--bg-elevated)]'}`}>
                                        {day}
                                    </span>
                                    <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded border" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                                        {bsDay}
                                    </span>
                                </div>

                                <div className="space-y-1.5 mt-1 overflow-hidden flex-1 relative z-10">
                                    {dayTasks.slice(0, 3).map((task, i) => (
                                        <DraggableTask key={`task-${task.id}`} task={task} canDrag={user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER} />
                                    ))}
                                    {dayEvents.slice(0, Math.max(0, 3 - dayTasks.length)).map((ev, i) => (
                                        <div key={`ev-${ev.id || i}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors shadow-sm"
                                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color || 'var(--accent)' }}></div>
                                            <div className="text-[11px] truncate font-medium leading-none" style={{ color: 'var(--text-heading)' }}>
                                                {ev.title}
                                            </div>
                                        </div>
                                    ))}
                                    {(dayEvents.length + dayTasks.length) > 3 && (
                                        <div className="text-[10px] font-medium px-1" style={{ color: 'var(--text-muted)' }}>
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
                                {activeDragTask.clientName || activeDragTask.title}
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
            <div className="rounded-xl overflow-hidden flex flex-col h-full border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                {/* Advanced Filter Toolbar */}
                <div className="p-4 border-b space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 w-full">
                            <div className="relative flex-1 max-w-md group">
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="border rounded-lg pl-10 pr-4 py-2 text-xs w-full transition-colors outline-none"
                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
                                />
                                <div className="absolute left-3 top-2.5 transition-colors" style={{ color: 'var(--text-muted)' }}>
                                    <List size={14} />
                                </div>
                            </div>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-xs outline-none transition-colors cursor-pointer"
                                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
                            >
                                <option value="ALL">All types</option>
                                <option value="MEETING">Meeting</option>
                                <option value="DEADLINE">Deadline</option>
                                <option value="GENERAL">General</option>
                                <option value="PERSONAL">Personal</option>
                                <option value="FIRM_EVENT">Firm event</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors border"
                                style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--border-accent)' }}
                            >
                                <FileDown size={14} />
                                <span>Export log</span>
                            </button>
                        </div>
                    </div>

                    {/* Bulk Actions Bar */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSelectAll}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                                style={{ 
                                    background: selectedEventIds.size === events.length && events.length > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                                    color: selectedEventIds.size === events.length && events.length > 0 ? 'var(--on-accent)' : 'var(--text-muted)',
                                    borderColor: 'var(--border)'
                                }}
                            >
                                {selectedEventIds.size === events.length ? 'Deselect all' : 'Select all'}
                            </button>

                            {selectedEventIds.size > 0 && (
                                <div className="flex items-center gap-2 p-1 rounded-lg border animate-in fade-in slide-in-from-left-4 duration-300"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                    <span className="text-xs font-semibold px-2" style={{ color: 'var(--text-muted)' }}>Bulk actions:</span>
                                    <div className="h-4 w-px" style={{ background: 'var(--border)' }} />
                                    <button
                                        onClick={() => handleBulkVisibility('PUBLIC')}
                                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                        style={{ color: 'var(--text-heading)' }}
                                    >
                                        Make public
                                    </button>
                                    <button
                                        onClick={() => handleBulkVisibility('PRIVATE')}
                                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        Make private
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 border"
                                        style={{ color: 'var(--color-danger)', borderColor: 'rgba(224,112,122,0.3)', background: 'rgba(224,112,122,0.1)' }}
                                    >
                                        <Trash2 size={12} /> Delete ({selectedEventIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-xs font-medium px-3 py-1 rounded-lg border"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            Showing {filteredEvents.length} of {events.length} events
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1 h-[60vh] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-surface)' }}>
                            <tr className="border-b text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                <th className="p-3 w-12"></th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Title</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Visibility</th>
                                <th className="p-3">Creator</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                            {sortedEvents.map(event => {
                                const canEdit = user && canEditEvent(event, user);
                                const isSelected = selectedEventIds.has(event.id);
                                return (
                                    <tr key={event.id} className="transition-colors group hover:bg-[var(--bg-secondary)]"
                                        style={{ background: isSelected ? 'var(--accent-dim)' : 'transparent' }}>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectEvent(event.id)}
                                                    className="w-4 h-4 rounded cursor-pointer"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-3 text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                            <div className="flex flex-col">
                                                <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{event.date}</span>
                                                <span className="text-[10px] mt-0.5">{event.time || 'All day'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: event.color || 'var(--accent)' }}></div>
                                                <div>
                                                    <span className="font-semibold text-xs block" style={{ color: 'var(--text-heading)' }}>{event.title}</span>
                                                    {event.description && <p className="text-xs mt-0.5 line-clamp-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>{event.description}</p>}
                                                </div>
                                                {event.isRecurring && <Repeat size={12} className="shrink-0" style={{ color: 'var(--accent)' }} />}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-medium border"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}>
                                                {event.type.toLowerCase().replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getVisibilityBadge(event.visibility || 'PUBLIC').color}`}>
                                                {getVisibilityBadge(event.visibility || 'PUBLIC').text}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border"
                                                    style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                                    {(allUsers.find(u => u.uid === event.createdBy)?.displayName || 'S')[0]}
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{allUsers.find(u => u.uid === event.createdBy)?.displayName || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                {canEdit && (
                                                    <button
                                                        onClick={(e) => handleEditEvent(event, e)}
                                                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface)]"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        title="Edit"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => addToGoogleCalendar(event.title, event.date, event.description || '')}
                                                    className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface)]"
                                                    style={{ color: 'var(--text-muted)' }}
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
                        <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: 'var(--text-heading)' }}>
                            <CalendarIcon size={20} style={{ color: 'var(--accent)' }} />
                            Firm Calendar
                        </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Track task deadlines, meetings, and important firm events.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    {/* View Toggle */}
                    <div className="inline-flex items-center p-0.5 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <button
                            onClick={() => setViewMode('GRID')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'GRID' ? 'shadow-xs border' : ''}`}
                            style={{ background: viewMode === 'GRID' ? 'var(--bg-secondary)' : 'transparent', color: viewMode === 'GRID' ? 'var(--text-heading)' : 'var(--text-muted)', borderColor: viewMode === 'GRID' ? 'var(--border-mid)' : 'transparent' }}
                        >
                            <CalendarIcon size={14} /> <span className="hidden sm:inline">Grid</span>
                        </button>
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'LIST' ? 'shadow-xs border' : ''}`}
                            style={{ background: viewMode === 'LIST' ? 'var(--bg-secondary)' : 'transparent', color: viewMode === 'LIST' ? 'var(--text-heading)' : 'var(--text-muted)', borderColor: viewMode === 'LIST' ? 'var(--border-mid)' : 'transparent' }}
                        >
                            <List size={14} /> <span className="hidden sm:inline">List</span>
                        </button>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center p-1 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.color='var(--text-heading)'} onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}><ChevronLeft size={16} /></button>
                        <div className="flex flex-col items-center px-3 min-w-[130px]">
                            <span className="text-sm font-bold leading-none" style={{ color: 'var(--text-heading)' }}>{monthNames[month]} {year}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {(() => {
                                    const bs = toBS(new Date(year, month, 1)).split('-');
                                    return `${bsMonths[parseInt(bs[1]) - 1]} ${bs[0]}`;
                                })()}
                            </span>
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.color='var(--text-heading)'} onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>


            {
                viewMode === 'GRID' ? (
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Main Calendar Grid */}
                        <div className="flex-1 rounded-xl p-4 lg:p-5 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                            {renderCalendarGrid()}
                        </div>

                        <div className="w-full lg:w-80 rounded-xl flex flex-col h-[calc(100vh-280px)] sticky top-6 border shrink-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                            {/* Sidebar Header */}
                            <div className="p-4 border-b relative" style={{ borderColor: 'var(--border)' }}>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-bold flex items-center" style={{ color: 'var(--text-heading)' }}>
                                        {selectedDate ? `${monthNames[month]} ${selectedDate}` : 'Select a date'}
                                    </h3>
                                    <button
                                        onClick={() => handleOpenEventModal(selectedDate || undefined)}
                                        className="p-1.5 rounded-lg text-white transition-all active:scale-95" style={{ background: 'var(--accent)' }}
                                        title="Create event"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                {selectedDate && (
                                    <div className="flex items-center gap-2 relative z-10">
                                        <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }}></div>
                                        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                                            {(() => {
                                                const bs = toBS(new Date(year, month, selectedDate)).split('-');
                                                return `${bsMonths[parseInt(bs[1]) - 1]} ${bs[2]}, ${bs[0]}`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Toggle for showing only my events */}
                            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                                <button
                                    onClick={() => setShowOnlyMyEvents(!showOnlyMyEvents)}
                                    className="flex items-center text-xs font-semibold transition-colors w-full"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <div className="w-8 h-4 rounded-full mr-3 relative transition-colors"
                                        style={{ background: showOnlyMyEvents ? 'var(--accent)' : 'var(--border)' }}>
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${showOnlyMyEvents ? 'left-4.5' : 'left-0.5'}`}></div>
                                    </div>
                                    {showOnlyMyEvents ? 'Showing only my events' : 'Showing all events'}
                                </button>
                            </div>

                            <div className="space-y-3 flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                                                <div key={i} className="group relative p-3.5 rounded-xl border transition-colors shadow-sm"
                                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r" style={{ backgroundColor: ev.color || 'var(--accent)' }}></div>

                                                    <div className="pl-2">
                                                        <div className="flex items-start justify-between mb-1">
                                                            <h4 className="text-xs font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{eventWithDefaults.title}</h4>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={(e) => handleEditEvent(eventWithDefaults, e)}
                                                                        className="p-1 rounded transition-colors"
                                                                        style={{ color: 'var(--text-muted)' }}
                                                                    >
                                                                        <Edit size={12} />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={(e) => handleDeleteEvent(eventWithDefaults, e)}
                                                                        className="p-1 rounded transition-colors"
                                                                        style={{ color: 'var(--color-danger)' }}
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 text-[10px] mb-2 items-center" style={{ color: 'var(--text-muted)' }}>
                                                            <span className="flex items-center px-1.5 py-0.5 rounded border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                                                <Clock size={10} className="mr-1" />
                                                                {formatEventTime(eventWithDefaults)}
                                                            </span>
                                                            <span className="font-semibold">{eventWithDefaults.type.replace('_', ' ')}</span>
                                                            {eventWithDefaults.isRecurring && (
                                                                <span className="flex items-center font-semibold" style={{ color: 'var(--accent)' }}>
                                                                    <Repeat size={10} className="mr-1" /> Recurring
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${badge.color}`}>
                                                                {badge.text}
                                                            </span>
                                                            <button
                                                                onClick={() => addToGoogleCalendar(eventWithDefaults.title, eventWithDefaults.date, eventWithDefaults.description || '')}
                                                                className="text-[10px] flex items-center hover:underline transition-colors"
                                                                style={{ color: 'var(--text-muted)' }}
                                                            >
                                                                <ExternalLink size={10} className="mr-1" /> Export
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {selectedDayTasks.map((task, i) => (
                                            <div key={i} className="group flex flex-col p-3.5 rounded-xl border transition-colors shadow-sm"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <div className="flex items-start space-x-3 mb-2">
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                                                        style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                                        <CheckCircle2 size={15} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-heading)' }}>{task.clientName || task.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold"
                                                                style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>Task</span>
                                                            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{task.title}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addToGoogleCalendar(task.clientName || task.title, task.dueDate, `Task: ${task.title}`)}
                                                    className="mt-1 text-xs flex items-center justify-center w-full py-1.5 rounded-lg border transition-colors font-semibold"
                                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-body)' }}
                                                >
                                                    <ExternalLink size={12} className="mr-1.5" /> Add to G-Cal
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

            <ConfirmationModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmLabel={confirmModal.confirmLabel}
                variant={confirmModal.variant}
                onConfirm={() => {
                    confirmModal.onConfirm?.();
                    setConfirmModal(prev => ({ ...prev, open: false }));
                }}
                onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            />
        </div>
        </div>
    );
};

export default CalendarPage;
