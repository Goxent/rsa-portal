import React, { useState, useEffect } from 'react';
import {
    Bell,
    Clock,
    AlertTriangle,
    CheckCircle,
    Users,
    X,
    Plus,
    RefreshCw,
    ChevronDown,
    Zap,
    Calendar,
    Timer,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { SmartRemindersService, SmartReminder, ReminderType, ReminderPriority } from '../../services/smart-reminders';
import { useAuth } from '../../context/AuthContext';

const PRIORITY_COLORS: Record<ReminderPriority, string> = {
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TYPE_ICONS: Record<ReminderType, React.ElementType> = {
    task_due: Clock,
    task_overdue: AlertTriangle,
    follow_up: Bell,
    client_check_in: Users,
    attendance_reminder: Timer,
    billing_reminder: Calendar,
    custom: Zap,
};

const TYPE_LABELS: Record<ReminderType, string> = {
    task_due: 'Task Due',
    task_overdue: 'Overdue',
    follow_up: 'Follow Up',
    client_check_in: 'Client Check-in',
    attendance_reminder: 'Attendance',
    billing_reminder: 'Billing',
    custom: 'Custom',
};

const SNOOZE_OPTIONS = [
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '4 hours', value: 240 },
    { label: 'Tomorrow', value: 24 * 60 },
];

interface SmartRemindersWidgetProps {
    compact?: boolean;
    maxItems?: number;
}

const SmartRemindersWidget: React.FC<SmartRemindersWidgetProps> = ({
    compact = false,
    maxItems = 5,
}) => {
    const { user } = useAuth();
    const [reminders, setReminders] = useState<SmartReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [snoozeMenu, setSnoozeMenu] = useState<string | null>(null);

    // Create form state
    const [newReminder, setNewReminder] = useState({
        title: '',
        message: '',
        scheduledFor: '',
        priority: 'medium' as ReminderPriority,
    });

    useEffect(() => {
        if (user) {
            loadReminders();
            // Generate smart reminders on load
            SmartRemindersService.runAllGenerators(user.uid);
        }
    }, [user]);

    const loadReminders = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await SmartRemindersService.getPendingReminders(user.uid);
            setReminders(data);
        } catch (error) {
            console.error('Failed to load reminders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async (reminderId: string) => {
        await SmartRemindersService.dismissReminder(reminderId);
        setReminders(reminders.filter(r => r.id !== reminderId));
    };

    const handleSnooze = async (reminderId: string, minutes: number) => {
        await SmartRemindersService.snoozeReminder(reminderId, minutes);
        setReminders(reminders.filter(r => r.id !== reminderId));
        setSnoozeMenu(null);
    };

    const handleCreate = async () => {
        if (!user || !newReminder.title || !newReminder.scheduledFor) return;

        try {
            await SmartRemindersService.createCustomReminder(
                user.uid,
                newReminder.title,
                newReminder.message,
                new Date(newReminder.scheduledFor),
                newReminder.priority
            );
            setShowCreateModal(false);
            setNewReminder({ title: '', message: '', scheduledFor: '', priority: 'medium' });
            loadReminders();
        } catch (error) {
            console.error('Failed to create reminder:', error);
        }
    };

    if (loading) {
        return (
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-center h-32">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
            </div>
        );
    }

    // Compact mode for dashboard widget
    if (compact) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Bell size={16} className="text-brand-500" />
                        Reminders
                        {reminders.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded-full">
                                {reminders.length}
                            </span>
                        )}
                    </h3>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Plus size={14} className="text-gray-400" />
                    </button>
                </div>

                {reminders.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No pending reminders</p>
                ) : (
                    <div className="space-y-2">
                        {reminders.slice(0, maxItems).map(reminder => (
                            <ReminderCard
                                key={reminder.id}
                                reminder={reminder}
                                compact
                                onDismiss={() => handleDismiss(reminder.id!)}
                                onSnooze={(mins) => handleSnooze(reminder.id!, mins)}
                                snoozeOpen={snoozeMenu === reminder.id}
                                onSnoozeToggle={() => setSnoozeMenu(snoozeMenu === reminder.id ? null : reminder.id!)}
                            />
                        ))}
                    </div>
                )}

                {showCreateModal && (
                    <CreateReminderModal
                        newReminder={newReminder}
                        setNewReminder={setNewReminder}
                        onCreate={handleCreate}
                        onClose={() => setShowCreateModal(false)}
                    />
                )}
            </div>
        );
    }

    // Full page view
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Bell className="text-brand-500" />
                        Smart Reminders
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Intelligent notifications for tasks and follow-ups
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadReminders}
                        className="p-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-white transition-colors"
                    >
                        <Plus size={16} />
                        New Reminder
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-white">{reminders.length}</p>
                </div>
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs text-gray-400">Urgent</p>
                    <p className="text-2xl font-bold text-red-400">
                        {reminders.filter(r => r.priority === 'urgent').length}
                    </p>
                </div>
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs text-gray-400">Task Related</p>
                    <p className="text-2xl font-bold text-amber-400">
                        {reminders.filter(r => r.type.includes('task')).length}
                    </p>
                </div>
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs text-gray-400">Client Related</p>
                    <p className="text-2xl font-bold text-green-400">
                        {reminders.filter(r => r.type === 'client_check_in').length}
                    </p>
                </div>
            </div>

            {/* Reminders List */}
            {reminders.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
                    <p className="text-lg font-medium text-white">All caught up!</p>
                    <p className="text-gray-400">No pending reminders at the moment</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reminders.map(reminder => (
                        <ReminderCard
                            key={reminder.id}
                            reminder={reminder}
                            onDismiss={() => handleDismiss(reminder.id!)}
                            onSnooze={(mins) => handleSnooze(reminder.id!, mins)}
                            snoozeOpen={snoozeMenu === reminder.id}
                            onSnoozeToggle={() => setSnoozeMenu(snoozeMenu === reminder.id ? null : reminder.id!)}
                        />
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreateReminderModal
                    newReminder={newReminder}
                    setNewReminder={setNewReminder}
                    onCreate={handleCreate}
                    onClose={() => setShowCreateModal(false)}
                />
            )}
        </div>
    );
};

// Reminder Card Component
const ReminderCard: React.FC<{
    reminder: SmartReminder;
    compact?: boolean;
    onDismiss: () => void;
    onSnooze: (minutes: number) => void;
    snoozeOpen: boolean;
    onSnoozeToggle: () => void;
}> = ({ reminder, compact, onDismiss, onSnooze, snoozeOpen, onSnoozeToggle }) => {
    const Icon = TYPE_ICONS[reminder.type];

    if (compact) {
        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${PRIORITY_COLORS[reminder.priority]}`}>
                <Icon size={16} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{reminder.title}</p>
                    <p className="text-xs text-gray-500 truncate">{reminder.message}</p>
                </div>
                <button
                    onClick={onDismiss}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <X size={14} className="text-gray-400" />
                </button>
            </div>
        );
    }

    return (
        <div className={`glass-panel rounded-2xl p-4 border-l-4 ${reminder.priority === 'urgent' ? 'border-l-red-500' :
                reminder.priority === 'high' ? 'border-l-orange-500' :
                    reminder.priority === 'medium' ? 'border-l-blue-500' :
                        'border-l-gray-500'
            }`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${PRIORITY_COLORS[reminder.priority].split(' ').slice(0, 1).join(' ')}`}>
                    <Icon size={20} className={PRIORITY_COLORS[reminder.priority].split(' ')[1]} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[reminder.priority]}`}>
                            {reminder.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                            {TYPE_LABELS[reminder.type]}
                        </span>
                    </div>
                    <h4 className="font-medium text-white">{reminder.title}</h4>
                    <p className="text-sm text-gray-400 mt-1">{reminder.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                        Scheduled: {new Date(reminder.scheduledFor).toLocaleString()}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={onSnoozeToggle}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Clock size={16} className="text-gray-400" />
                        </button>

                        {snoozeOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
                                {SNOOZE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onSnooze(opt.value)}
                                        className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/10 whitespace-nowrap"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onDismiss}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <CheckCircle size={16} className="text-green-400" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Create Reminder Modal
const CreateReminderModal: React.FC<{
    newReminder: { title: string; message: string; scheduledFor: string; priority: ReminderPriority };
    setNewReminder: (r: { title: string; message: string; scheduledFor: string; priority: ReminderPriority }) => void;
    onCreate: () => void;
    onClose: () => void;
}> = ({ newReminder, setNewReminder, onCreate, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-white">Create Reminder</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Title *</label>
                        <input
                            type="text"
                            value={newReminder.title}
                            onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                            className="w-full glass-input px-4 py-2 rounded-xl"
                            placeholder="Reminder title..."
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Message</label>
                        <textarea
                            value={newReminder.message}
                            onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                            className="w-full glass-input px-4 py-2 rounded-xl resize-none"
                            rows={2}
                            placeholder="Additional details..."
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 block mb-1">When *</label>
                        <input
                            type="datetime-local"
                            value={newReminder.scheduledFor}
                            onChange={(e) => setNewReminder({ ...newReminder, scheduledFor: e.target.value })}
                            className="w-full glass-input px-4 py-2 rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Priority</label>
                        <select
                            value={newReminder.priority}
                            onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value as ReminderPriority })}
                            className="w-full glass-input px-4 py-2 rounded-xl"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 glass-card hover:bg-white/10 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={!newReminder.title || !newReminder.scheduledFor}
                        className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartRemindersWidget;
