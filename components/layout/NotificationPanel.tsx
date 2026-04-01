import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNotification } from '../../types';
import { AuthService, db } from '../../services/firebase';
import { X, CheckCheck, Bell, MessageSquare, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { isToday, isYesterday, isThisWeek, differenceInDays } from 'date-fns';
import { deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: AppNotification[];
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications }) => {
    const navigate = useNavigate();
    const [visibleLimit, setVisibleLimit] = useState(50);

    // Close on Escape key
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length > 0) {
            await AuthService.markAllAsRead(unreadIds);
        }
    };

    const handleClearOldRead = async () => {
        const now = new Date();
        const oldReadIds = notifications
            .filter(n => n.read && differenceInDays(now, new Date(n.createdAt)) > 30)
            .map(n => n.id);

        if (oldReadIds.length === 0) {
            toast.success("No old read notifications found.");
            return;
        }

        try {
            await Promise.all(oldReadIds.map(id => deleteDoc(doc(db, 'notifications', id))));
            toast.success(`Cleared ${oldReadIds.length} old read notifications.`);
        } catch (error) {
            toast.error("Failed to clear old notifications.");
        }
    };

    const handleNotificationClick = async (n: AppNotification) => {
        if (!n.read) await AuthService.markAsRead(n.id);
        if (n.link) {
            navigate(n.link);
            onClose();
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'WARNING': return <AlertTriangle size={16} className="text-red-400" />;
            case 'TASK': return <CheckCheck size={16} className="text-amber-400" />;
            case 'MESSAGE': return <MessageSquare size={16} className="text-purple-400" />;
            default: return <Info size={16} className="text-gray-400" />;
        }
    };

    const groupedNotifications = useMemo(() => {
        const groups = {
            today: [] as AppNotification[],
            yesterday: [] as AppNotification[],
            thisWeek: [] as AppNotification[],
            older: [] as AppNotification[]
        };

        const sorted = [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const visible = sorted.slice(0, visibleLimit);

        visible.forEach(n => {
            const date = new Date(n.createdAt);
            if (isToday(date)) groups.today.push(n);
            else if (isYesterday(date)) groups.yesterday.push(n);
            else if (isThisWeek(date)) groups.thisWeek.push(n);
            else groups.older.push(n);
        });

        return groups;
    }, [notifications, visibleLimit]);

    const renderNotificationItem = (notification: AppNotification) => (
        <div
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`p-4 hover:bg-white/5 transition-colors cursor-pointer group relative ${!notification.read ? 'bg-amber-500/5' : ''}`}
        >
            {!notification.read && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
            )}
            <div className="flex gap-3">
                <div className={`mt-1 p-2 rounded-lg bg-white/5 shrink-0 h-fit border border-white/5 ${!notification.read ? 'bg-amber-500/10 border-amber-500/20' : ''}`}>
                    {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm font-bold leading-tight ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                            {notification.title}
                        </h4>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                            {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p className={`text-xs leading-relaxed line-clamp-2 ${!notification.read ? 'text-gray-300' : 'text-gray-500'}`}>
                        {notification.message}
                    </p>
                </div>
            </div>
        </div>
    );

    const renderGroup = (title: string, items: AppNotification[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-2">
                <div
                    className="px-6 py-2 sticky top-0 backdrop-blur-sm z-10"
                    style={{
                        background: 'var(--bg-main)',
                        borderTop: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)'
                    }}
                >
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}
                    >{title}</span>
                </div>
                <div style={{ borderColor: 'var(--border)' }} className="divide-y">
                    {items.map(renderNotificationItem)}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="fixed inset-y-0 right-0 w-80 md:w-96 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right"
                style={{
                    background: 'var(--bg-secondary)',
                    borderLeft: '1px solid var(--border)',
                    transition: 'transform 300ms ease-out'
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4"
                    style={{
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-surface)'
                    }}
                >
                    <div className="flex items-center space-x-2">
                        <Bell size={18} style={{ color: 'var(--accent)' }} />
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Notifications</h2>
                        {notifications.filter(n => !n.read).length > 0 && (
                            <span
                                className="text-white text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: 'var(--accent)' }}
                            >
                                {notifications.filter(n => !n.read).length} New
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="transition-colors rounded-lg p-1"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-heading)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Action Bar */}
                {notifications.length > 0 && (
                    <div
                        className="px-6 py-2 flex justify-between items-center"
                        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                    >
                        <button
                            onClick={handleClearOldRead}
                            className="text-xs font-medium flex items-center transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                            title="Delete read notifications older than 30 days"
                        >
                            <Trash2 size={14} className="mr-1" /> Clear old read
                        </button>
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs font-medium flex items-center transition-colors"
                            style={{ color: 'var(--accent)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent-secondary)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                        >
                            <CheckCheck size={14} className="mr-1" /> Mark all as read
                        </button>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    {notifications.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center h-full p-8 text-center"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <Bell size={48} className="mb-4" style={{ color: 'var(--border-mid)' }} />
                            <p className="text-sm font-medium">You're all caught up!</p>
                            <p className="text-xs mt-1">No new notifications.</p>
                        </div>
                    ) : (
                        <div className="pb-6">
                            {renderGroup('Today', groupedNotifications.today)}
                            {renderGroup('Yesterday', groupedNotifications.yesterday)}
                            {renderGroup('This Week', groupedNotifications.thisWeek)}
                            {renderGroup('Older', groupedNotifications.older)}

                            {notifications.length > visibleLimit && (
                                <div
                                    className="p-4 flex justify-center"
                                    style={{ borderTop: '1px solid var(--border)' }}
                                >
                                    <button
                                        onClick={() => setVisibleLimit(prev => prev + 50)}
                                        className="text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                                        style={{
                                            color: 'var(--text-body)',
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-mid)'
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-mid)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-body)';
                                        }}
                                    >
                                        Load More
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationPanel;
