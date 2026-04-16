import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Smartphone, LogOut, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { AuthService } from '../services/firebase';

interface SessionInfo {
    sessionId: string;
    deviceName: string;
    deviceType: string;
    loggedInAt: number;
    lastActive: number;
}

interface DeviceChooserModalProps {
    isOpen: boolean;
    sessions: SessionInfo[];
    uid: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const timeAgo = (ts: number): string => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const DeviceChooserModal: React.FC<DeviceChooserModalProps> = ({
    isOpen, sessions, uid, email, password, onSuccess, onCancel
}) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleDisconnect = async (sessionId: string) => {
        setLoadingId(sessionId);
        try {
            // Remove the chosen session, then tell the parent to retry login
            await AuthService.removeSession(uid, sessionId);
            onSuccess();
        } catch (err: any) {
            onSuccess(); // Even on error, let parent retry
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="relative w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Shield size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-base">Device Limit Reached</h2>
                                    <p className="text-gray-500 text-[11px] font-medium">Max 2 devices allowed per account</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-amber-300/80 text-[11px] leading-relaxed">
                                    Your account is already signed in on 2 devices. Choose which device to disconnect to continue.
                                </p>
                            </div>
                        </div>

                        {/* Sessions */}
                        <div className="p-4 space-y-3">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-1">Active Sessions</p>
                            {sessions.map((session) => {
                                const isMobile = session.deviceType === 'MOBILE' || /Android|iPhone|iPad/.test(session.deviceName);
                                const isLoading = loadingId === session.sessionId;
                                return (
                                    <motion.div
                                        key={session.sessionId}
                                        layout
                                        className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                                    >
                                        {/* Device icon */}
                                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                            {isMobile
                                                ? <Smartphone size={18} className="text-blue-400" />
                                                : <Monitor size={18} className="text-purple-400" />
                                            }
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-bold truncate">{session.deviceName}</p>
                                            <p className="text-gray-500 text-[11px] mt-0.5">
                                                Last active {timeAgo(session.lastActive)}
                                                <span className="mx-1 opacity-40">·</span>
                                                Signed in {timeAgo(session.loggedInAt)}
                                            </p>
                                        </div>

                                        {/* Disconnect button */}
                                        <button
                                            onClick={() => handleDisconnect(session.sessionId)}
                                            disabled={!!loadingId}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all disabled:opacity-40"
                                        >
                                            {isLoading
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <LogOut size={12} />
                                            }
                                            {isLoading ? 'Removing...' : 'Disconnect'}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-4 pb-4">
                            <button
                                onClick={onCancel}
                                className="w-full py-3 text-[11px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DeviceChooserModal;
