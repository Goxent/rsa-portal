import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNotification } from '../../types';
import { AuthService } from '../../services/firebase';
import { X, CheckCheck, Bell, MessageSquare, AlertTriangle, Info } from 'lucide-react';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: AppNotification[];
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications }) => {
    const navigate = useNavigate();

    // Close on Escape key
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length > 0) {
            await AuthService.markAllAsRead(unreadIds);
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
            case 'TASK': return <CheckCheck size={16} className="text-blue-400" />;
            case 'MESSAGE': return <MessageSquare size={16} className="text-purple-400" />;
            default: return <Info size={16} className="text-gray-400" />;
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel - Fixed positioning to avoid viewport clipping issues */}
            <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-[#0F172A] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center space-x-2">
                        <Bell size={18} className="text-blue-400" />
                        <h2 className="text-lg font-bold text-white">Notifications</h2>
                        {notifications.filter(n => !n.read).length > 0 && (
                            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {notifications.filter(n => !n.read).length} New
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Action Bar */}
                {notifications.length > 0 && (
                    <div className="px-6 py-2 border-b border-white/5 bg-white/[0.02] flex justify-end">
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center transition-colors"
                        >
                            <CheckCheck size={14} className="mr-1" /> Mark all as read
                        </button>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 p-8 text-center">
                            <Bell size={48} className="mb-4 text-gray-700" />
                            <p className="text-sm font-medium">You're all caught up!</p>
                            <p className="text-xs mt-1">No new notifications.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 hover:bg-white/5 transition-colors cursor-pointer group relative ${!notification.read ? 'bg-blue-500/5' : ''}`}
                                >
                                    {!notification.read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                    )}
                                    <div className="flex gap-3">
                                        <div className={`mt-1 p-2 rounded-lg bg-white/5 shrink-0 h-fit border border-white/5 ${!notification.read ? 'bg-blue-500/10 border-blue-500/20' : ''}`}>
                                            {getIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-sm font-bold leading-tight ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                                                    {notification.title}
                                                </h4>
                                                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                                                    {/* Ideally use date-fns relative time */}
                                                    {new Date(notification.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className={`text-xs leading-relaxed line-clamp-2 ${!notification.read ? 'text-gray-300' : 'text-gray-500'}`}>
                                                {notification.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationPanel;
