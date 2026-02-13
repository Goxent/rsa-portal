import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Plus, Calendar as CalIcon, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { ComplianceEvent } from '../types/advanced';
import { ComplianceService } from '../services/advanced';

const CompliancePage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const [events, setEvents] = useState<ComplianceEvent[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        category: 'TAX',
        dueDate: '',
        priority: 'MEDIUM',
    });

    useEffect(() => {
        if (user) loadEvents();
    }, [user]);

    const loadEvents = async () => {
        const data = await ComplianceService.getEvents();
        setEvents(data);
    };

    const handleSaveEvent = async () => {
        if (!user || !newEvent.title || !newEvent.dueDate) return;

        const eventData = {
            ...newEvent,
            category: newEvent.category as ComplianceEvent['category'],
            priority: newEvent.priority as ComplianceEvent['priority'],
        };

        if (editingId) {
            await ComplianceService.updateEvent(editingId, eventData);
        } else {
            await ComplianceService.createEvent({
                ...eventData,
                status: 'UPCOMING',
                assignedTo: [user.uid],
                isRecurring: false,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
            });
        }

        setNewEvent({
            title: '',
            description: '',
            category: 'TAX',
            dueDate: '',
            priority: 'MEDIUM',
        });
        setEditingId(null);
        setIsModalOpen(false);
        await loadEvents();
    };

    const handleEdit = (event: ComplianceEvent) => {
        setNewEvent({
            title: event.title,
            description: event.description || '',
            category: event.category,
            dueDate: event.dueDate,
            priority: event.priority,
        });
        setEditingId(event.id);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        openModal('CONFIRMATION', {
            title: 'Delete Compliance Event',
            message: 'Are you sure you want to delete this compliance event? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                await ComplianceService.deleteEvent(id);
                await loadEvents();
            }
        });
    };

    const handleComplete = async (id: string) => {
        await ComplianceService.completeEvent(id);
        await loadEvents();
    };

    const filteredEvents = events.filter((e) => {
        if (filter === 'ALL') return true;
        return e.status === filter;
    });

    const upcomingCount = events.filter(e => e.status === 'UPCOMING').length;
    const dueSoonCount = events.filter(e => e.status === 'DUE_SOON').length;
    const overdueCount = events.filter(e => e.status === 'OVERDUE').length;

    const getCategoryColor = (category: string) => {
        const colors = {
            TAX: 'text-blue-400 bg-blue-500/20',
            AUDIT: 'text-purple-400 bg-purple-500/20',
            REGULATORY: 'text-orange-400 bg-orange-500/20',
            INTERNAL: 'text-gray-400 bg-gray-500/20',
        };
        return colors[category as keyof typeof colors] || 'text-gray-400 bg-gray-500/20';
    };

    const canEdit = user?.role === 'ADMIN' || user?.role === 'MASTER_ADMIN' || user?.role === 'MANAGER';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">Compliance Calendar</h1>
                    <p className="text-sm text-gray-400">Track tax and audit deadlines</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setNewEvent({
                                title: '',
                                description: '',
                                category: 'TAX',
                                dueDate: '',
                                priority: 'MEDIUM',
                            });
                            setIsModalOpen(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg flex items-center transition-all hover:scale-105"
                    >
                        <Plus size={16} className="mr-2" /> Add Event
                    </button>
                )}
            </div>

            {/* Next Deadline Timer */}
            {(() => {
                const upcomingEvents = events.filter(e => e.status === 'UPCOMING' || e.status === 'DUE_SOON');
                if (upcomingEvents.length === 0) return null;

                // Find nearest event
                const nearestEvent = upcomingEvents.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                const dueDate = new Date(nearestEvent.dueDate);
                const now = new Date();
                const diffTime = dueDate.getTime() - now.getTime();

                // If overdue or today, handle differently? For now, standard countdown
                const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

                return (
                    <div className="glass-panel p-6 rounded-xl border-l-4 border-l-blue-500 relative overflow-hidden">
                        <div className="absolute right-0 top-0 opacity-10">
                            <CalIcon size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-lg text-gray-400 font-medium mb-1">Next Compliance Deadline</h3>
                                <div className="text-2xl font-bold text-white flex items-center gap-2">
                                    {nearestEvent.title}
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(nearestEvent.category)}`}>
                                        {nearestEvent.category}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Due: {dueDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white bg-white/5 rounded-lg px-4 py-2 backdrop-blur-md border border-white/10">
                                        {Math.max(0, days)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">Days</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white bg-white/5 rounded-lg px-4 py-2 backdrop-blur-md border border-white/10">
                                        {Math.max(0, hours)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">Hours</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white bg-white/5 rounded-lg px-4 py-2 backdrop-blur-md border border-white/10">
                                        {Math.max(0, minutes)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">Mins</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Upcoming</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{upcomingCount}</h3>
                        </div>
                        <CalIcon className="text-blue-400" size={24} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Due Soon</p>
                            <h3 className="text-2xl font-bold text-amber-400 mt-1">{dueSoonCount}</h3>
                        </div>
                        <Bell className="text-amber-400" size={24} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Overdue</p>
                            <h3 className="text-2xl font-bold text-red-400 mt-1">{overdueCount}</h3>
                        </div>
                        <AlertTriangle className="text-red-400" size={24} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Completed</p>
                            <h3 className="text-2xl font-bold text-green-400 mt-1">
                                {events.filter(e => e.status === 'COMPLETED').length}
                            </h3>
                        </div>
                        <CheckCircle className="text-green-400" size={24} />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['ALL', 'UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {f.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Events List */}
            <div className="space-y-3">
                {filteredEvents.map((event) => (
                    <div
                        key={event.id}
                        className="glass-panel p-5 rounded-xl hover:bg-white/5 transition-all group"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
                                    <h3 className="font-bold text-white mr-2">{event.title}</h3>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(event.category)}`}>
                                        {event.category}
                                    </span>
                                    {event.priority === 'CRITICAL' && (
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                                            CRITICAL
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{event.description}</p>
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                    <span>Due: {new Date(event.dueDate).toLocaleDateString()}</span>
                                    {event.clientName && <span>Client: {event.clientName}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {event.status !== 'COMPLETED' && (
                                    <button
                                        onClick={() => handleComplete(event.id)}
                                        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-sm border border-green-500/30 transition-colors"
                                    >
                                        Mark Complete
                                    </button>
                                )}
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() => handleEdit(event)}
                                            className="bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg text-sm border border-white/10 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-sm border border-red-500/20 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {filteredEvents.length === 0 && (
                    <div className="glass-panel p-12 rounded-xl text-center text-gray-500">
                        <CalIcon size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No compliance events found</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center rounded-t-2xl">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                {editingId ? 'Edit Event' : 'New Compliance Event'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Title <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                                    value={newEvent.title}
                                    placeholder="e.g. Q3 VAT Return"
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <textarea
                                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                                    rows={3}
                                    placeholder="Add details..."
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                                        value={newEvent.category}
                                        onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                                    >
                                        <option value="TAX">Tax</option>
                                        <option value="AUDIT">Audit</option>
                                        <option value="REGULATORY">Regulatory</option>
                                        <option value="INTERNAL">Internal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Priority</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                                        value={newEvent.priority}
                                        onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Due Date <span className="text-red-400">*</span></label>
                                <input
                                    type="date"
                                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                                    value={newEvent.dueDate}
                                    onChange={(e) => setNewEvent({ ...newEvent, dueDate: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleSaveEvent}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                            >
                                {editingId ? 'Update Event' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompliancePage;
