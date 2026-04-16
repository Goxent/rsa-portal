import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Smartphone, LogOut, Shield, AlertTriangle, Loader2, Globe, MapPin, Wifi } from 'lucide-react';
import { AuthService } from '../services/firebase';
import { SessionMetadata } from '../services/sessionService';

interface DeviceChooserModalProps {
    isOpen: boolean;
    sessions: SessionMetadata[];
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

const formatDate = (ts: number): string => {
    return new Date(ts).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const DeviceChooserModal: React.FC<DeviceChooserModalProps> = ({
    isOpen, sessions, uid, onSuccess, onCancel
}) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleDisconnect = async (sessionId: string) => {
        setLoadingId(sessionId);
        try {
            await AuthService.removeSession(uid, sessionId);
            onSuccess();
        } catch {
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
                        className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Shield size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-base">Active Session Limit Reached</h2>
                                    <p className="text-gray-500 text-[11px] font-medium">Max 2 concurrent active sessions allowed</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-amber-300/80 text-[11px] leading-relaxed">
                                    Your account has <strong className="text-amber-300">{sessions.length} open browser tabs</strong>. 
                                    Only active tabs count. Disconnect one to continue.
                                </p>
                            </div>
                        </div>

                        {/* Sessions */}
                        <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-1">
                                Active Sessions — {sessions.length} device{sessions.length !== 1 ? 's' : ''}
                            </p>
                            {sessions.map((session) => {
                                const isMobile = session.deviceType === 'MOBILE';
                                const isLoading = loadingId === session.sessionId;
                                const isCurrentDevice = session.deviceId === localStorage.getItem('rsa_device_id');
                                const locationStr = [session.city, session.country].filter(Boolean).join(', ');

                                return (
                                    <motion.div
                                        key={session.sessionId}
                                        layout
                                        className={`flex items-start gap-3 p-4 rounded-xl transition-all border ${
                                            isCurrentDevice
                                                ? 'bg-brand-500/5 border-brand-500/20 ring-1 ring-brand-500/10'
                                                : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {/* Device icon */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                            isCurrentDevice ? 'bg-brand-500/10' : 'bg-white/5'
                                        }`}>
                                            {isMobile
                                                ? <Smartphone size={18} className={isCurrentDevice ? 'text-brand-400' : 'text-blue-400'} />
                                                : <Monitor size={18} className={isCurrentDevice ? 'text-brand-400' : 'text-purple-400'} />
                                            }
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            {/* Device name + badge */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-white text-sm font-bold leading-tight">{session.deviceName}</p>
                                                {isCurrentDevice && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-brand-500 text-[7px] font-black text-white uppercase tracking-widest">
                                                        This Device
                                                    </span>
                                                )}
                                            </div>
                                            {/* IP + Location row */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {session.ip && session.ip !== 'Unknown' && (
                                                    <span className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                                        <Globe size={9} className="text-gray-600" />
                                                        {session.ip}
                                                    </span>
                                                )}
                                                {locationStr && locationStr !== 'Unknown' && (
                                                    <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                                        <MapPin size={9} className="text-gray-600" />
                                                        {locationStr}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Timestamps */}
                                            <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <Wifi size={9} />
                                                    Active {timeAgo(session.lastActive)}
                                                </span>
                                                <span className="opacity-30">·</span>
                                                <span>Signed in {formatDate(session.loggedInAt)}</span>
                                            </div>
                                        </div>

                                        {/* Disconnect button */}
                                        <button
                                            onClick={() => handleDisconnect(session.sessionId)}
                                            disabled={!!loadingId}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all disabled:opacity-40 ${
                                                isCurrentDevice
                                                    ? 'border-gray-500/30 text-gray-400 hover:bg-white/5 hover:text-white'
                                                    : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50'
                                            }`}
                                        >
                                            {isLoading
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <LogOut size={12} />
                                            }
                                            {isLoading ? '...' : 'Disconnect'}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer note */}
                        <div className="px-4 pb-4 space-y-2">
                            <p className="text-[9px] text-gray-700 text-center font-medium">
                                Sessions without activity for more than 5 minutes are automatically released.
                            </p>
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
