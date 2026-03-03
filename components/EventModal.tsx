import React, { useState, useEffect } from 'react';
import { X, Save, Users, Calendar, Clock, Repeat, Bell, MapPin, Palette, Plus, Trash2 } from 'lucide-react';
import { CalendarEvent, UserProfile, UserRole, EventVisibility, EventType, RecurrenceRule } from '../types';
import { canCreateEventWithVisibility, getEventColor } from '../utils/eventUtils';
import NepaliDatePicker from './NepaliDatePicker';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Partial<CalendarEvent>) => Promise<void>;
    event?: CalendarEvent; // For editing existing event
    selectedDate?: string; // Pre-fill date for new event
    user: UserProfile;
    allUsers: UserProfile[];
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    onClose,
    onSave,
    event,
    selectedDate,
    user,
    allUsers,
}) => {
    const isEditing = !!event;

    // Helper to get local date string without timezone conversion
    const getLocalDateString = (date: Date = new Date()): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Form state
    const [formData, setFormData] = useState<Partial<CalendarEvent>>({
        title: '',
        date: selectedDate || getLocalDateString(),
        time: '',
        endTime: '',
        description: '',
        type: 'GENERAL' as EventType,
        visibility: 'PRIVATE' as EventVisibility,
        location: '',
        color: '',
        teamIds: [],
        participants: [],
        rsvpRequired: false,
        isRecurring: false,
    });

    const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>({
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [],
    });

    const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [useNepali, setUseNepali] = useState(false);

    // Initialize form when event or selectedDate changes
    useEffect(() => {
        if (event) {
            setFormData({
                ...event,
                teamIds: event.teamIds || [],
                participants: event.participants || [],
            });
            if (event.recurrenceRule) {
                setRecurrenceRule(event.recurrenceRule);
            }
            setSelectedTeamMembers(event.teamIds || []);
        } else {
            setFormData({
                title: '',
                date: selectedDate || getLocalDateString(),
                time: '',
                endTime: '',
                description: '',
                type: 'GENERAL',
                visibility: 'PRIVATE',
                location: '',
                color: '',
                teamIds: [],
                participants: [],
                rsvpRequired: false,
                isRecurring: false,
                createdBy: user.uid,
            });
            setSelectedTeamMembers([]);
            setRecurrenceRule({
                frequency: 'WEEKLY',
                interval: 1,
                daysOfWeek: [],
            });
        }
    }, [event, selectedDate, user.uid]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            // Validation
            if (!formData.title?.trim()) {
                throw new Error('Event title is required');
            }

            // Check visibility permission
            if (!canCreateEventWithVisibility(formData.visibility!, user)) {
                throw new Error(`You don't have permission to create ${formData.visibility} events`);
            }

            // Prepare event data
            const eventData: Partial<CalendarEvent> = {
                ...formData,
                createdBy: formData.createdBy || user.uid,
                teamIds: formData.visibility === 'TEAM' ? selectedTeamMembers : undefined,
                department: formData.visibility === 'DEPARTMENT' ? user.department : undefined,
                recurrenceRule: formData.isRecurring ? recurrenceRule : undefined,
                color: formData.color || getEventColor(formData.type!),
            };

            await onSave(eventData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save event');
        } finally {
            setSaving(false);
        }
    };

    const toggleTeamMember = (userId: string) => {
        setSelectedTeamMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const toggleDayOfWeek = (day: number) => {
        setRecurrenceRule(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek?.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...(prev.daysOfWeek || []), day],
        }));
    };

    if (!isOpen) return null;

    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;

    // Base types available to everyone
    const baseEventTypes: EventType[] = ['MEETING', 'DEADLINE', 'GENERAL', 'PERSONAL'];

    // Admin-only types
    const eventTypes: EventType[] = isAdmin
        ? [...baseEventTypes, 'FIRM_EVENT', 'HOLIDAY']
        : baseEventTypes;

    const visibilityOptions: EventVisibility[] =
        isAdmin
            ? ['PRIVATE', 'TEAM', 'DEPARTMENT', 'PUBLIC']
            : ['PRIVATE', 'TEAM'];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
            <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="text-lg font-bold text-white font-heading flex items-center">
                        <Calendar size={20} className="mr-2 text-brand-500" />
                        {isEditing ? 'Edit Event' : 'Create New Event'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 bg-red-500/20 text-red-200 px-4 py-3 rounded-lg text-sm border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Event Title */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Event Title *</label>
                            <input
                                type="text"
                                required
                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                placeholder="Enter event title..."
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        {/* Date and Time */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-gray-400 uppercase">Date *</label>
                                    <button
                                        type="button"
                                        onClick={() => setUseNepali(!useNepali)}
                                        className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-all ${useNepali ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-500'}`}
                                    >
                                        {useNepali ? 'SELECT AD' : 'SELECT BS'}
                                    </button>
                                </div>
                                {useNepali ? (
                                    <NepaliDatePicker
                                        value={formData.date || ''}
                                        onChange={(ad) => setFormData({ ...formData, date: ad })}
                                        className="w-full"
                                    />
                                ) : (
                                    <input
                                        type="date"
                                        required
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Start Time</label>
                                <input
                                    type="time"
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">End Time</label>
                                <input
                                    type="time"
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={formData.endTime}
                                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Event Type & Visibility */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Event Type</label>
                                <select
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as EventType })}
                                >
                                    {eventTypes.map(type => (
                                        <option key={type} value={type}>{type.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">
                                    Visibility {user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && <span className="text-[10px]">(Admins can set PUBLIC)</span>}
                                </label>
                                <select
                                    className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={formData.visibility}
                                    onChange={e => setFormData({ ...formData, visibility: e.target.value as EventVisibility })}
                                >
                                    {visibilityOptions.map(vis => (
                                        <option key={vis} value={vis}>{vis}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Team Members Selection (if TEAM visibility) */}
                        {formData.visibility === 'TEAM' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase flex items-center">
                                    <Users size={14} className="mr-1" /> Select Team Members
                                </label>
                                <div className="glass-panel p-3 rounded-lg max-h-40 overflow-y-auto">
                                    {allUsers.filter(u => u.uid !== user.uid).map(u => (
                                        <label key={u.uid} className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedTeamMembers.includes(u.uid)}
                                                onChange={() => toggleTeamMember(u.uid)}
                                                className="mr-3"
                                            />
                                            <span className="text-sm text-gray-300">{u.displayName} <span className="text-xs text-gray-500">({u.email})</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Description</label>
                            <textarea
                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                rows={3}
                                placeholder="Event description..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase flex items-center">
                                <MapPin size={14} className="mr-1" /> Location
                            </label>
                            <input
                                type="text"
                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                placeholder="Meeting room, video call link, etc."
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>

                        {/* Recurring Event */}
                        <div className="border-t border-white/10 pt-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isRecurring}
                                    onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                                    className="mr-3"
                                />
                                <Repeat size={16} className="mr-2 text-brand-400" />
                                <span className="text-sm font-semibold text-gray-300">Recurring Event</span>
                            </label>

                            {formData.isRecurring && (
                                <div className="mt-3 space-y-3 pl-8">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                                            <select
                                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                                value={recurrenceRule.frequency}
                                                onChange={e => setRecurrenceRule({ ...recurrenceRule, frequency: e.target.value as any })}
                                            >
                                                <option value="DAILY">Daily</option>
                                                <option value="WEEKLY">Weekly</option>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="YEARLY">Yearly</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Every</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                                value={recurrenceRule.interval}
                                                onChange={e => setRecurrenceRule({ ...recurrenceRule, interval: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    {recurrenceRule.frequency === 'WEEKLY' && (
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-2">Days of Week</label>
                                            <div className="flex gap-2">
                                                {dayNames.map((day, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => toggleDayOfWeek(idx)}
                                                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${recurrenceRule.daysOfWeek?.includes(idx)
                                                            ? 'bg-brand-600 text-white'
                                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">End Date (optional)</label>
                                        <input
                                            type="date"
                                            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                            value={recurrenceRule.endDate}
                                            onChange={e => setRecurrenceRule({ ...recurrenceRule, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RSVP */}
                        <div>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.rsvpRequired}
                                    onChange={e => setFormData({ ...formData, rsvpRequired: e.target.checked })}
                                    className="mr-3"
                                />
                                <Users size={16} className="mr-2 text-emerald-400" />
                                <span className="text-sm font-semibold text-gray-300">Require RSVP</span>
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-6 mt-6 border-t border-white/10 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center disabled:opacity-50"
                        >
                            <Save size={16} className="mr-2" />
                            {saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventModal;
