
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X, Edit, Trash2, Eye, EyeOff, Repeat } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { Task, CalendarEvent, UserRole, UserProfile } from '../types';
import { ComplianceEvent } from '../types/advanced';
import { useAuth } from '../context/AuthContext';
import EventModal from '../components/EventModal';
import { generateRecurringInstances, canEditEvent, canDeleteEvent, getVisibilityBadge, formatEventTime } from '../utils/eventUtils';
import { toBS, toAD } from '../utils/dateUtils';
import { ComplianceService } from '../services/advanced';
import NepaliDate from 'nepali-date-converter';

// Helpers
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const CalendarPage: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());

    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [complianceEvents, setComplianceEvents] = useState<ComplianceEvent[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [showOnlyMyEvents, setShowOnlyMyEvents] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    useEffect(() => {
        if (user) {
            AuthService.getAllTasks().then(setTasks);
            // Use new visibility-aware function
            AuthService.getAllEventsForUser(user.uid, user.role, user.department).then(rawEvents => {
                // Expand recurring events for the current month view
                const startOfMonth = new Date(year, month, 1);
                const endOfMonth = new Date(year, month + 1, 0);

                const expandedEvents: CalendarEvent[] = [];
                rawEvents.forEach(event => {
                    if (event.isRecurring && event.recurrenceRule) {
                        const instances = generateRecurringInstances(event, startOfMonth, endOfMonth);
                        expandedEvents.push(...instances);
                    } else {
                        expandedEvents.push(event);
                    }
                });

                setEvents(expandedEvents);
            });
            // Load compliance events
            ComplianceService.getEvents().then(setComplianceEvents);
            AuthService.getAllUsers().then(setAllUsers);

            // Fetch Clients for VAT/ITR Auto-Events
            AuthService.getAllClients().then(clients => {
                const autoEvents: ComplianceEvent[] = [];
                // 1. VAT Returns (25th of every Nepali Month)
                // We need to find the AD date for the 25th of the CURRENT Nepali month(s) that overlap with the current grid view

                // Simple approach: Get current Nepali Year/Month
                const npNow = new NepaliDate(new Date());
                const currentNpYear = npNow.getYear();
                const currentNpMonth = npNow.getMonth(); // 0-11

                // Generate for current month and next month to be safe
                for (let i = 0; i < 2; i++) {
                    const targetMonth = currentNpMonth + i;
                    // Handle year rollover if needed (basic implementation)
                    const npDate = new NepaliDate(currentNpYear, targetMonth, 25);
                    const adDate = npDate.toJsDate();
                    const adDateStr = adDate.toISOString().split('T')[0];

                    // Find clients with VAT Return enabled
                    const vatClients = clients.filter(c => c.vatReturn);
                    if (vatClients.length > 0) {
                        autoEvents.push({
                            id: `vat_${adDateStr}`,
                            title: `VAT Return Deadline (${vatClients.length} Clients)`,
                            dueDate: adDateStr,
                            priority: 'CRITICAL',
                            status: 'PENDING',
                            assignedTo: [], // Auto-assigned
                            description: `VAT Return for: ${vatClients.map(c => c.code).join(', ')}`
                        });
                    }
                }

                setComplianceEvents(prev => [...prev, ...autoEvents]);
            });
        }
    }, [user, year, month]);

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(year, month + offset, 1));
        setSelectedDate(null);
    };

    const getItemsForDay = (day: number) => {
        const taskItems = tasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            const isSameDay = taskDate.getDate() === day &&
                taskDate.getMonth() === month &&
                taskDate.getFullYear() === year;

            if (!isSameDay) return false;

            // Filter for non-admins
            if (user && user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.MANAGER) {
                if (!task.assignedTo || !task.assignedTo.includes(user.uid)) {
                    return false;
                }
            }
            return true;
        });

        let eventItems = events.filter(ev => {
            const evDate = new Date(ev.date);
            return evDate.getDate() === day &&
                evDate.getMonth() === month &&
                evDate.getFullYear() === year;
        });

        // Get compliance events for this day
        const complianceItems = complianceEvents.filter(ce => {
            const ceDate = new Date(ce.dueDate);
            return ceDate.getDate() === day &&
                ceDate.getMonth() === month &&
                ceDate.getFullYear() === year;
        });

        // Filter to only user's events if toggle is on
        if (showOnlyMyEvents && user) {
            eventItems = eventItems.filter(ev => ev.createdBy === user.uid);
        }

        return { tasks: taskItems, events: eventItems, compliance: complianceItems };
    };

    const handleOpenEventModal = (date?: number) => {
        if (date) setSelectedDate(date);
        setEditingEvent(undefined);
        setIsModalOpen(true);
    };

    const handleEditEvent = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (user && canEditEvent(event, user)) {
            setEditingEvent(event);
            setIsModalOpen(true);
        }
    };

    const handleDeleteEvent = async (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !canDeleteEvent(event, user)) return;

        if (confirm(`Delete event "${event.title}"?`)) {
            try {
                await AuthService.deleteEvent(event.id, user.uid, user.role);
                // Refresh events
                const rawEvents = await AuthService.getAllEventsForUser(user.uid, user.role, user.department);
                const startOfMonth = new Date(year, month, 1);
                const endOfMonth = new Date(year, month + 1, 0);

                const expandedEvents: CalendarEvent[] = [];
                rawEvents.forEach(ev => {
                    if (ev.isRecurring && ev.recurrenceRule) {
                        expandedEvents.push(...generateRecurringInstances(ev, startOfMonth, endOfMonth));
                    } else {
                        expandedEvents.push(ev);
                    }
                });
                setEvents(expandedEvents);
            } catch (error: any) {
                alert(error.message || 'Failed to delete event');
            }
        }
    };

    const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
        if (!user) return;
        if (isSaving) return; // Prevent duplicate submissions

        setIsSaving(true);
        try {
            if (editingEvent) {
                // Update existing event
                await AuthService.updateEvent(editingEvent.id, eventData, user.uid, user.role);
            } else {
                // Create new event - use eventData.date directly to avoid timezone issues
                const fullEvent: CalendarEvent = {
                    id: 'temp_' + Date.now(),
                    ...eventData as CalendarEvent,
                    date: eventData.date!, // Use the date from the form (already in YYYY-MM-DD format)
                    createdBy: user.uid,
                };
                await AuthService.saveEvent(fullEvent);
            }

            // Refresh events
            const rawEvents = await AuthService.getAllEventsForUser(user.uid, user.role, user.department);
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const expandedEvents: CalendarEvent[] = [];
            rawEvents.forEach(ev => {
                if (ev.isRecurring && ev.recurrenceRule) {
                    expandedEvents.push(...generateRecurringInstances(ev, startOfMonth, endOfMonth));
                } else {
                    expandedEvents.push(ev);
                }
            });
            setEvents(expandedEvents);

            setIsModalOpen(false);
            setEditingEvent(undefined);
        } catch (error: any) {
            alert(error.message || 'Failed to save event');
        } finally {
            setIsSaving(false);
        }
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

                    const { tasks: dayTasks, events: dayEvents, compliance: dayCompliance } = getItemsForDay(day);
                    const totalCount = dayTasks.length + dayEvents.length + dayCompliance.length;
                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                    const isSelected = day === selectedDate;

                    // Determine if Saturday (Day 6 in JS Date)
                    const isSaturday = new Date(year, month, day).getDay() === 6;
                    const isCurrent = isToday; // Renamed for clarity with the new className

                    return (
                        <div
                            key={day}
                            onClick={() => setSelectedDate(day)}
                            className={`relative min-h-[100px] p-2 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isCurrent
                                ? 'border-emerald-500 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 shadow-lg shadow-emerald-500/20'
                                : day === selectedDate
                                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20'
                                    : 'border-white/5 hover:border-brand-400/30 hover:bg-white/5'
                                }  ${dayTasks.length > 0 || dayEvents.length > 0 || dayCompliance.length > 0 ? 'shadow-inner' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-bold ${isCurrent ? 'text-emerald-300' : day === selectedDate ? 'text-brand-300' : 'text-gray-300'}`}>
                                    {day}
                                </span>
                                <div className="flex flex-col items-end gap-0.5">
                                    {totalCount > 0 && (
                                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-medium">
                                            {totalCount}
                                        </span>
                                    )}
                                    <span className="text-[8px] text-gray-600 font-mono">
                                        {toBS(new Date(year, month, day)).split('-')[2]}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1 mt-1 overflow-hidden">
                                {dayCompliance.map((comp, i) => (
                                    <div key={`comp-${i}`} className={`px-1.5 py-1 rounded text-[10px] truncate border-l-2 ${comp.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-200 border-red-500' :
                                        comp.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-200 border-orange-500' :
                                            'bg-amber-500/20 text-amber-200 border-amber-500'
                                        }`} title={comp.title}>
                                        🔔 {comp.title}
                                    </div>
                                ))}
                                {dayEvents.map((ev, i) => (
                                    <div key={`ev-${i}`} className="px-1.5 py-1 rounded bg-purple-500/20 text-[10px] text-purple-200 truncate border-l-2 border-purple-500">
                                        {ev.title}
                                    </div>
                                ))}
                                {dayTasks.slice(0, 2 - dayEvents.length - dayCompliance.length).map((t, i) => (
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
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                    <span className="text-lg font-bold text-white w-32 text-center select-none">{monthNames[month]} {year}</span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
                {/* Main Calendar Grid */}
                <div className="flex-1 glass-panel rounded-2xl p-4 lg:p-6 overflow-y-auto shadow-2xl">
                    {renderCalendarGrid()}
                </div>

                <div className="w-full lg:w-80 glass-panel rounded-2xl p-6 flex flex-col shadow-2xl h-fit">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                        <h3 className="text-lg font-bold text-white flex items-center">
                            <CalendarIcon size={18} className="mr-2 text-blue-400" />
                            {selectedDate ? `${monthNames[month]} ${selectedDate}` : 'Select a date'}
                        </h3>
                        {/* Everyone can create events now */}
                        <button
                            onClick={() => handleOpenEventModal(selectedDate || undefined)}
                            className="p-2 bg-brand-600 rounded-lg text-white hover:bg-brand-500 transition-colors shadow-lg"
                            title="Create event"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* Toggle for showing only my events */}
                    <div className="mb-4">
                        <button
                            onClick={() => setShowOnlyMyEvents(!showOnlyMyEvents)}
                            className="flex items-center text-xs text-gray-400 hover:text-gray-200 transition-colors"
                        >
                            {showOnlyMyEvents ? <Eye size={14} className="mr-1" /> : <EyeOff size={14} className="mr-1" />}
                            {showOnlyMyEvents ? 'Show all events' : 'Show only my events'}
                        </button>
                    </div>

                    <div className="space-y-3 flex-1">
                        {/* Event Items */}
                        {selectedDayEvents.map((ev, i) => {
                            // Add defaults for old events without new fields
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
                                <div key={i} className="group flex flex-col p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/20">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-purple-200">{eventWithDefaults.title}</h4>
                                            <p className="text-[10px] text-gray-400">{formatEventTime(eventWithDefaults)} • {eventWithDefaults.type.replace('_', ' ')}</p>
                                            {eventWithDefaults.isRecurring && (
                                                <p className="text-[10px] text-emerald-400 flex items-center mt-1">
                                                    <Repeat size={10} className="mr-1" /> Recurring
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => handleEditEvent(eventWithDefaults, e)}
                                                    className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                                                    title="Edit event"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={(e) => handleDeleteEvent(eventWithDefaults, e)}
                                                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Delete event"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badge.color}`}>
                                            {badge.text}
                                        </span>
                                        <button
                                            onClick={() => addToGoogleCalendar(eventWithDefaults.title, eventWithDefaults.date, eventWithDefaults.description || '')}
                                            className="text-[10px] text-purple-300 hover:underline flex items-center"
                                        >
                                            <ExternalLink size={10} className="mr-1" /> G-Cal
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

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
    );
};

export default CalendarPage;
