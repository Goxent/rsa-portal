import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, Clock, DollarSign, Calendar, Filter, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TimeEntry } from '../types/advanced';
import { TimeTrackingService } from '../services/advanced';

const TimeTrackingPage: React.FC = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEntry, setNewEntry] = useState({
        description: '',
        projectName: '',
        billable: false,
        hourlyRate: 0,
    });

    useEffect(() => {
        if (user) loadEntries();
    }, [user]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTimer) {
            interval = setInterval(() => {
                setTimerSeconds(prev => prev + 1);
                TimeTrackingService.updateDuration(activeTimer.id, timerSeconds + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimer, timerSeconds]);

    const loadEntries = async () => {
        const data = await TimeTrackingService.getTimeEntries(user?.uid);
        setEntries(data);
        const running = data.find(e => e.status === 'RUNNING');
        if (running) {
            setActiveTimer(running);
            const elapsed = Math.floor((new Date().getTime() - new Date(running.startTime).getTime()) / 1000);
            setTimerSeconds(elapsed);
        }
    };

    const handleStart = async () => {
        if (!user) return;
        const id = await TimeTrackingService.startTimer({
            userId: user.uid,
            userName: user.displayName || 'User',
            description: newEntry.description || 'Working',
            projectName: newEntry.projectName || 'General',
            billable: newEntry.billable,
            hourlyRate: newEntry.hourlyRate || undefined,
        });

        setTimerSeconds(0);
        await loadEntries();
        setIsModalOpen(false);
        setNewEntry({ description: '', projectName: '', billable: false, hourlyRate: 0 });
    };

    const handleStop = async () => {
        if (!activeTimer) return;
        await TimeTrackingService.stopTimer(activeTimer.id);
        setActiveTimer(null);
        setTimerSeconds(0);
        await loadEntries();
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const totalHours = entries
        .filter(e => e.status === 'COMPLETED')
        .reduce((sum, e) => sum + e.duration / 3600, 0);

    const totalBillable = entries
        .filter(e => e.status === 'COMPLETED' && e.billable && e.hourlyRate)
        .reduce((sum, e) => sum + (e.duration / 3600) * (e.hourlyRate || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">Time Tracking</h1>
                    <p className="text-sm text-gray-400">Track project time and billable hours</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={!!activeTimer}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    <Play size={16} className="mr-2" /> Start Timer
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Total Hours</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{totalHours.toFixed(2)}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/20 rounded-lg">
                            <Clock size={24} className="text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-green-400 mt-1">${totalBillable.toFixed(2)}</h3>
                        </div>
                        <div className="p-3 bg-green-500/20 rounded-lg">
                            <DollarSign size={24} className="text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">This Week</p>
                            <h3 className="text-2xl font-bold text-purple-400 mt-1">
                                {entries
                                    .filter(e => new Date(e.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                                    .reduce((sum, e) => sum + e.duration / 3600, 0)
                                    .toFixed(2)}h
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-500/20 rounded-lg">
                            <Calendar size={24} className="text-purple-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Timer */}
            {activeTimer && (
                <div className="glass-panel p-6 rounded-xl border-2 border-blue-500/50 bg-blue-500/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white mb-1">{activeTimer.description}</h3>
                            <p className="text-sm text-gray-400">{activeTimer.projectName}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-3xl font-mono font-bold text-blue-400">{formatTime(timerSeconds)}</div>
                            <button
                                onClick={handleStop}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg border border-red-500/30 flex items-center"
                            >
                                <Square size={16} className="mr-2" fill="currentColor" /> Stop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Time Entries Table */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-bold text-white">Time Entries</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-white/10 bg-black/20">
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3">Project</th>
                                <th className="px-6 py-3">Duration</th>
                                <th className="px-6 py-3">Billable</th>
                                <th className="px-6 py-3">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {entries.filter(e => e.status === 'COMPLETED').map(entry => (
                                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-6 py-4">{new Date(entry.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-white">{entry.description}</td>
                                    <td className="px-6 py-4">{entry.projectName}</td>
                                    <td className="px-6 py-4">{(entry.duration / 3600).toFixed(2)}h</td>
                                    <td className="px-6 py-4">
                                        {entry.billable ? (
                                            <span className="text-green-400">✓ Yes</span>
                                        ) : (
                                            <span className="text-gray-500">No</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {entry.billable && entry.hourlyRate
                                            ? `$${((entry.duration / 3600) * entry.hourlyRate).toFixed(2)}`
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                            {entries.filter(e => e.status === 'COMPLETED').length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No completed time entries yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Start Timer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-md border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Start New Timer</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                <input
                                    type="text"
                                    placeholder="What are you working on?"
                                    className="w-full rounded-lg px-3 py-2 text-sm"
                                    value={newEntry.description}
                                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Project</label>
                                <input
                                    type="text"
                                    placeholder="Project name"
                                    className="w-full rounded-lg px-3 py-2 text-sm"
                                    value={newEntry.projectName}
                                    onChange={(e) => setNewEntry({ ...newEntry, projectName: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="billable"
                                    checked={newEntry.billable}
                                    onChange={(e) => setNewEntry({ ...newEntry, billable: e.target.checked })}
                                />
                                <label htmlFor="billable" className="text-sm text-gray-300">Billable</label>
                            </div>
                            {newEntry.billable && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Hourly Rate ($)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-lg px-3 py-2 text-sm"
                                        value={newEntry.hourlyRate}
                                        onChange={(e) => setNewEntry({ ...newEntry, hourlyRate: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                            <button
                                onClick={handleStart}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center"
                            >
                                <Play size={16} className="mr-2" /> Start Timer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTrackingPage;
