import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Plus, Calendar as CalIcon, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ComplianceEvent } from '../types/advanced';
import { ComplianceService } from '../services/advanced';

const CompliancePage: React.FC = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState<ComplianceEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        category: 'TAX' as const,
        dueDate: '',
        priority: 'MEDIUM' as const,
    });

    useEffect(() => {
        if (user) loadEvents();
    }, [user]);

    const loadEvents = async () => {
        const data = await ComplianceService.getEvents();
        setEvents(data);
    };

    const handleCreateEvent = async () => {
        if (!user || !newEvent.title || !newEvent.dueDate) return;

        await ComplianceService.createEvent({
            ...newEvent,
            status: 'UPCOMING',
            assignedTo: [user.uid],
            isRecurring: false,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        });

        setNewEvent({
            title: '',
            description: '',
            category: 'TAX',
            dueDate: '',
            priority: 'MEDIUM',
        });
        setIsModalOpen(false);
        await loadEvents();
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">Compliance Calendar</h1>
                    <p className="text-sm text-gray-400">Track tax and audit deadlines</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg flex items-center"
                >
                    <Plus size={16} className="mr-2" /> Add Event
                </button>
            </div>

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
            <div className="flex gap-2">
                {['ALL', 'UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f
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
                        className="glass-panel p-5 rounded-xl hover:bg-white/5 transition-all"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                    <h3 className="font-bold text-white">{event.title}</h3>
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
                            {event.status !== 'COMPLETED' && (
                                <button
                                    onClick={() => handleComplete(event.id)}
                                    className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1.5 rounded-lg text-sm border border-green-500/30"
                                >
                                    Mark Complete
                                </button>
                            )}
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

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-md border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between">
                            <h3 className="text-lg font-bold text-white">New Compliance Event</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg px-3 py-2"
                                    value={newEvent.title}
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <textarea
                                    className="w-full rounded-lg px-3 py-2"
                                    rows={3}
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                                    <select
                                        className="w-full rounded-lg px-3 py-2"
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
                                        className="w-full rounded-lg px-3 py-2"
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
                                <label className="block text-sm font-medium text-gray-400 mb-2">Due Date</label>
                                <input
                                    type="date"
                                    className="w-full rounded-lg px-3 py-2"
                                    value={newEvent.dueDate}
                                    onChange={(e) => setNewEvent({ ...newEvent, dueDate: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleCreateEvent}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold"
                            >
                                Create Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompliancePage;
