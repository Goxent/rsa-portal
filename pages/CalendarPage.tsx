
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ExternalLink, Plus, X, Edit, Trash2, Eye, EyeOff, Repeat, List } from 'lucide-react';
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

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const CalendarPage: React.FC = () => {
    const { user } = useAuth();
    // List View State
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

    // ... (keep existing effects)

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
            // Extract unique master IDs (handle recurring instances like "id_date")
            const masterIds = new Set<string>();
            selectedEventIds.forEach(id => {
                masterIds.add(id.split('_')[0]);
            });

            const promises = Array.from(masterIds).map(id =>
                AuthService.deleteEvent(id, user.uid, user.role)
            );

            await Promise.all(promises);

            // Refresh
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
            setSelectedEventIds(new Set());
            alert("Events deleted successfully");
        } catch (error: any) {
            alert("Failed to delete some events: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const renderListView = () => {
        // Sort events by date
        const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return (
            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSelectAll}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedEventIds.size === events.length && events.length > 0 ? 'bg-brand-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            {selectedEventIds.size === events.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedEventIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                            >
                                <Trash2 size={14} /> Delete Selected ({selectedEventIds.size})
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
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
                                    <tr key={event.id} className={`hover:bg-white/5 transition-all ${isSelected ? 'bg-brand-500/10' : ''}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectEvent(event.id)}
                                                className="rounded border-gray-600 bg-black/30 text-brand-500 focus:ring-brand-500"
                                            />
                                        </td>
                                        <td className="p-4 text-sm text-gray-300 font-mono whitespace-nowrap">
                                            {event.date}
                                            <span className="ml-2 text-xs text-gray-500">{event.time}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: event.color || '#8b5cf6' }}></div>
                                                <span className="font-medium text-white">{event.title}</span>
                                                {event.isRecurring && <Repeat size={12} className="text-gray-500" />}
                                            </div>
                                            {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.description}</p>}
                                        </td>
                                        <td className="p-4 text-xs text-gray-400 capitalize">{event.type.toLowerCase().replace('_', ' ')}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getVisibilityBadge(event.visibility || 'PUBLIC').color}`}>
                                                {getVisibilityBadge(event.visibility || 'PUBLIC').text}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-400">
                                            {allUsers.find(u => u.uid === event.createdBy)?.displayName || 'System'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {canEdit && (
                                                    <>
                                                        <button onClick={(e) => handleEditEvent(event, e)} className="p-1.5 hover:bg-white/10 rounded-lg text-blue-400 transition-colors"><Edit size={14} /></button>
                                                        <button onClick={(e) => handleDeleteEvent(event, e)} className="p-1.5 hover:bg-white/10 rounded-lg text-red-400 transition-colors"><Trash2 size={14} /></button>
                                                    </>
                                                )}
                                                <button onClick={() => addToGoogleCalendar(event.title, event.date, event.description || '')} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><ExternalLink size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedEvents.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-gray-500">No events found for this month.</td>
                                </tr>
                            )}
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

                    <div className="flex items-center space-x-4 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                        <span className="text-lg font-bold text-white w-32 text-center select-none">{monthNames[month]} {year}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"><ChevronRight size={20} /></button>
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
