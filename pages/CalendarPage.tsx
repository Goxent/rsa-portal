
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X, Edit, Trash2, Eye, EyeOff, Repeat, List, FileDown } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { Task, CalendarEvent, UserRole, UserProfile } from '../types';
import { ComplianceEvent } from '../types/advanced';
import { useAuth } from '../context/AuthContext';
import EventModal from '../components/EventModal';
import { generateRecurringInstances, canEditEvent, canDeleteEvent, getVisibilityBadge, formatEventTime } from '../utils/eventUtils';
import { toBS, toAD } from '../utils/dateUtils';
import { ComplianceService } from '../services/advanced';
import NepaliDate from 'nepali-date-converter';
import * as XLSX from 'xlsx';

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

            const promises = Array.from(masterIds).map(id =>
                AuthService.updateEvent(id, { visibility: visibility as any })
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
        const dayTasks = [] as Task[]; // Tasks might be fetched separately if needed

        return { events: dayEvents, tasks: dayTasks };
    };

    const { events: selectedDayEvents, tasks: selectedDayTasks } = selectedDate ? getItemsForDay(selectedDate) : { events: [], tasks: [] };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
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

                    const { events: dayEvents } = getItemsForDay(day);
                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                    const isSelected = day === selectedDate;

                    // Nepali Date for this day
                    const bsDateString = toBS(new Date(year, month, day));
                    const bsDay = bsDateString.split('-')[2];

                    return (
                        <div
                            key={day}
                            onClick={() => setSelectedDate(day)}
                            className={`relative min-h-[100px] p-2 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isToday
                                ? 'border-emerald-500 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 shadow-lg shadow-emerald-500/20'
                                : isSelected
                                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20'
                                    : 'border-white/5 hover:border-brand-400/30 hover:bg-white/5'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-bold ${isToday ? 'text-emerald-300' : isSelected ? 'text-brand-300' : 'text-gray-300'}`}>
                                    {day}
                                </span>
                                <span className="text-[10px] text-gray-500 font-medium">
                                    {bsDay}
                                </span>
                            </div>
                            <div className="space-y-1 mt-1 overflow-hidden">
                                {dayEvents.map((ev, i) => (
                                    <div key={`ev-${i}`} className="px-1.5 py-1 rounded bg-purple-500/20 text-[10px] text-purple-200 truncate border-l-2 border-purple-500">
                                        {ev.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
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
            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
                {/* Advanced Filter Toolbar */}
                <div className="p-4 border-b border-white/10 bg-white/5 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 w-full">
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-navy-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white w-full max-w-sm focus:border-brand-500 transition-all outline-none"
                            />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-navy-900/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
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
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-xl text-sm font-bold hover:bg-brand-600/30 transition-all"
                            >
                                <FileDown size={16} /> Export Audit Log
                            </button>
                        </div>
                    </div>

                    {/* Bulk Actions Bar */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSelectAll}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedEventIds.size === events.length && events.length > 0 ? 'bg-brand-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                {selectedEventIds.size === events.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedEventIds.size > 0 && (
                                <div className="flex items-center gap-2 p-1 bg-brand-500/10 rounded-xl border border-brand-500/20">
                                    <span className="text-[10px] text-brand-400 font-bold px-2 uppercase">Bulk Actions:</span>
                                    <button
                                        onClick={() => handleBulkVisibility('PUBLIC')}
                                        className="px-2 py-1 hover:bg-white/10 rounded text-[10px] text-blue-400 font-bold uppercase transition-all"
                                    >
                                        Make Public
                                    </button>
                                    <button
                                        onClick={() => handleBulkVisibility('PRIVATE')}
                                        className="px-2 py-1 hover:bg-white/10 rounded text-[10px] text-gray-400 font-bold uppercase transition-all"
                                    >
                                        Make Private
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-[10px] text-red-400 font-bold uppercase transition-all flex items-center gap-1"
                                    >
                                        <Trash2 size={10} /> Delete ({selectedEventIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            Showing {filteredEvents.length} of {events.length} events
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1 h-[60vh] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-navy-900">
                            <tr className="bg-white/5 border-b border-white/10 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                <th className="p-4 w-10"></th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Title</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Visibility</th>
                                <th className="p-4">Creator</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedEvents.map(event => {
                                const canEdit = user && canEditEvent(event, user);
                                const isSelected = selectedEventIds.has(event.id);
                                return (
                                    <tr key={event.id} className={`hover:bg-white/5 transition-all group ${isSelected ? 'bg-brand-500/10' : ''}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectEvent(event.id)}
                                                className="rounded-lg border-white/10 bg-black/30 text-brand-500 focus:ring-brand-500 transition-all cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-4 text-sm text-gray-300 font-mono whitespace-nowrap">
                                            <span className="block font-bold text-white">{event.date}</span>
                                            <span className="text-[10px] text-gray-500">{event.time || 'All Day'}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]`} style={{ color: event.color || '#8b5cf6', backgroundColor: 'currentColor' }}></div>
                                                <span className="font-bold text-white group-hover:text-brand-400 transition-colors">{event.title}</span>
                                                {event.isRecurring && <Repeat size={12} className="text-emerald-400" />}
                                            </div>
                                            {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-sm">{event.description}</p>}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                                {event.type.toLowerCase().replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getVisibilityBadge(event.visibility || 'PUBLIC').color}`}>
                                                {getVisibilityBadge(event.visibility || 'PUBLIC').text}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-400 border border-brand-500/20">
                                                    {(allUsers.find(u => u.uid === event.createdBy)?.displayName || 'S')[0]}
                                                </div>
                                                <span className="text-xs text-gray-400">{allUsers.find(u => u.uid === event.createdBy)?.displayName || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {canEdit && (
                                                    <button onClick={(e) => handleEditEvent(event, e)} className="p-2 hover:bg-brand-500/20 rounded-lg text-brand-400 transition-all" title="Edit"><Edit size={14} /></button>
                                                )}
                                                <button onClick={() => addToGoogleCalendar(event.title, event.date, event.description || '')} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all" title="Add to G-Cal"><ExternalLink size={14} /></button>
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
        <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Firm Calendar</h1>
                    <p className="text-sm text-gray-400">Track task deadlines, meetings, and events</p>
                </div>
                <div className="flex items-center space-x-4">
                    {/* View Toggle */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
                        <button
                            onClick={() => setViewMode('GRID')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            title="Grid View"
                        >
                            <CalendarIcon size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <div className="flex flex-col items-center bg-white/5 px-4 py-1 rounded-xl border border-white/10">
                        <div className="flex items-center space-x-4">
                            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                            <div className="flex flex-col items-center w-32">
                                <span className="text-lg font-bold text-white select-none">{monthNames[month]} {year}</span>
                                <span className="text-[10px] text-brand-400 font-medium tracking-wider uppercase">
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
            </div>

            {viewMode === 'GRID' ? (
                <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
                    {/* Main Calendar Grid */}
                    <div className="flex-1 glass-panel rounded-2xl p-4 lg:p-6 overflow-y-auto shadow-2xl">
                        {renderCalendarGrid()}
                    </div>

                    <div className="w-full lg:w-80 glass-panel rounded-2xl p-6 flex flex-col shadow-2xl h-fit">
                        <div className="flex flex-col border-b border-white/10 pb-4 mb-4">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <CalendarIcon size={18} className="mr-2 text-blue-400" />
                                    {selectedDate ? `${monthNames[month]} ${selectedDate}` : 'Select a date'}
                                </h3>
                                <button
                                    onClick={() => handleOpenEventModal(selectedDate || undefined)}
                                    className="p-2 bg-brand-600 rounded-lg text-white hover:bg-brand-500 transition-colors shadow-lg"
                                    title="Create event"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            {selectedDate && (
                                <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest ml-7">
                                    {(() => {
                                        const bs = toBS(new Date(year, month, selectedDate)).split('-');
                                        return `${bsMonths[parseInt(bs[1]) - 1]} ${bs[2]}, ${bs[0]}`;
                                    })()}
                                </span>
                            )}
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

                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
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
            ) : (
                <div className="flex-1 overflow-hidden">
                    {renderListView()}
                </div>
            )}

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
