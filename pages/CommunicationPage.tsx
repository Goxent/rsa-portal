import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Send, Clock, ShieldAlert, Mail, Bell, FileText, Trash2, Edit3, X, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useStaff';
import { NoticeService } from '../services/NoticeService';
import { Notice, UserRole } from '../types';
import { RecipientSelector } from '../components/communication/RecipientSelector';
import toast from 'react-hot-toast';
import { formatTimeAgo } from '../utils/dates';

export default function CommunicationPage() {
    const { user } = useAuth();
    const { data: users = [] } = useUsers();

    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Compose Form State
    const [isComposing, setIsComposing] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'GENERAL' | 'URGENT' | 'POLICY' | 'EVENT'>('GENERAL');
    const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [sendEmail, setSendEmail] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadNotices();
    }, []);

    const loadNotices = async () => {
        setIsLoading(true);
        try {
            // Admins see all notices
            const data = await NoticeService.getNotices();
            setNotices(data);
        } catch (error) {
            console.error('Failed to load notices:', error);
            // We don't toast here to avoid spamming the user if it's a recurring permission issue
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setIsComposing(false);
        setTitle('');
        setContent('');
        setType('GENERAL');
        setPriority('LOW');
        setSelectedRecipients([]);
        setSendEmail(true);
    };

    const handleSend = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error("Please provide both a title and message content.");
            return;
        }
        if (selectedRecipients.length === 0) {
            toast.error("Please select at least one recipient.");
            return;
        }

        setIsSubmitting(true);
        try {
            let emails: string[] = [];
            const isAll = selectedRecipients.length === 1 && selectedRecipients[0] === 'ALL';

            if (sendEmail) {
                if (isAll) {
                    emails = users.filter(u => u.role !== UserRole.MASTER_ADMIN).map(u => u.email).filter(Boolean);
                } else {
                    emails = users
                        .filter(u => selectedRecipients.includes(u.uid) && u.role !== UserRole.MASTER_ADMIN)
                        .map(u => u.email)
                        .filter(Boolean);
                }
            }

            // Exclude Master Admins from the actual recipient list if 'ALL' is selected
            const finalRecipients = isAll 
                ? users.filter(u => u.role !== UserRole.MASTER_ADMIN).map(u => u.uid)
                : selectedRecipients.filter(id => {
                    const u = users.find(user => user.uid === id);
                    return u && u.role !== UserRole.MASTER_ADMIN;
                });

            const noticeData: Omit<Notice, 'id'> = {
                title,
                content,
                type,
                priority,
                createdBy: user!.uid,
                createdByName: user!.displayName || 'Admin',
                createdAt: new Date().toISOString(),
                recipients: finalRecipients,
                sendEmail,
                readBy: [user!.uid]
            };

            await NoticeService.createNotice(noticeData, emails);

            toast.success("Notice has been broadcast successfully!");
            resetForm();

            loadNotices();
        } catch (error: any) {
            console.error("Failed to send notice:", error);
            toast.error(error.message || "Failed to broadcast notice.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPriorityColor = (p: string) => {
        if (p === 'HIGH') return 'text-red-600 bg-red-100 border-red-200';
        if (p === 'MEDIUM') return 'text-yellow-600 bg-yellow-100 border-yellow-200';
        return 'text-green-600 bg-green-100 border-green-200';
    };

    const getRecipientCount = (recipients: string[] | 'ALL') => {
        if (recipients === 'ALL') return users.length;
        return recipients.length;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">

            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2 flex items-center gap-2">
                        <Megaphone className="text-[var(--accent)]" /> Communication Center
                    </h1>
                    <p className="text-[var(--text-muted)]">Official firm-wide broadcasts and notices</p>
                </div>
                {!isComposing && (
                    <button
                        onClick={() => setIsComposing(true)}
                        className="btn-primary flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20"
                    >
                        <Edit3 size={18} /> Compose New Notice
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isComposing ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-[var(--bg-elevated)] border border-[var(--border-mid)] rounded-[var(--radius-lg)] shadow-xl overflow-hidden mb-8"
                    >
                        <div className="p-5 border-b border-[var(--border-mid)] bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-elevated)] flex items-center justify-between">
                            <h2 className="font-bold text-[var(--text-heading)] flex items-center gap-2">
                                <Send className="text-[var(--accent)]" size={18} /> Draft Broadcast
                            </h2>
                            <button onClick={resetForm} className="p-2 -mr-2 text-[var(--text-muted)] hover:text-[#c4445a] transition-colors rounded-full hover:bg-black/5">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* Editor Column */}
                            <div className="lg:col-span-2 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-[var(--text-body)] mb-1.5 focus-within:text-[var(--accent)] transition-colors">Notice Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g., Office Closure on Friday, New Tax Guidelines..."
                                        className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-[var(--radius-md)] text-[var(--text-heading)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[var(--text-body)] mb-1.5 focus-within:text-[var(--accent)] transition-colors">Message Content</label>
                                    <textarea
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        placeholder="Write your official notice here..."
                                        className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-[var(--radius-md)] text-[var(--text-body)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all min-h-[250px] resize-y custom-scrollbar"
                                    />
                                </div>
                            </div>

                            {/* Settings Column */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">Recipients</label>
                                    <RecipientSelector selectedIds={selectedRecipients} onChange={setSelectedRecipients} />
                                    <p className="text-xs text-[var(--text-muted)] mt-2">
                                        Tags individuals, teams, or broadcast to everyone.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Category</label>
                                        <select
                                            value={type}
                                            onChange={(e: any) => setType(e.target.value)}
                                            className="w-full p-2.5 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-[var(--radius-md)] text-sm text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="GENERAL">General Notice</option>
                                            <option value="POLICY">Firm Policy Update</option>
                                            <option value="EVENT">Event / Holiday</option>
                                            <option value="URGENT">Urgent Alert</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Priority</label>
                                        <select
                                            value={priority}
                                            onChange={(e: any) => setPriority(e.target.value)}
                                            className="w-full p-2.5 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-[var(--radius-md)] text-sm text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="LOW">Normal Priority</option>
                                            <option value="MEDIUM">Important</option>
                                            <option value="HIGH">High Priority</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-[var(--radius-md)] flex items-start gap-3">
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            id="sendEmail"
                                            checked={sendEmail}
                                            onChange={e => setSendEmail(e.target.checked)}
                                            className="w-4 h-4 text-[var(--accent)] rounded border-[var(--border-mid)] focus:ring-[var(--accent)] cursor-pointer"
                                        />
                                    </div>
                                    <label htmlFor="sendEmail" className="cursor-pointer">
                                        <p className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-1.5">
                                            <Mail size={14} className="text-[var(--accent)]" /> Deliver via Email
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
                                            Recipients will receive a branded HTML email via the firm's official SMTP gateway.
                                        </p>
                                    </label>
                                </div>

                                <button
                                    onClick={handleSend}
                                    disabled={isSubmitting}
                                    className={`w-full btn-primary py-3 flex items-center justify-center gap-2 text-[15px] shadow-lg ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
                                    style={{ background: isSubmitting ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent), var(--accent-secondary))' }}
                                >
                                    {isSubmitting ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Broadcasting...</>
                                    ) : (
                                        <><Send size={18} /> Publish & Broadcast</>
                                    )}
                                </button>
                            </div>

                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {isLoading ? (
                            <div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center gap-4">
                                <div className="w-8 h-8 border-4 border-[var(--border-mid)] border-t-[var(--accent)] rounded-full animate-spin" />
                                Loading broadcast history...
                            </div>
                        ) : notices.length === 0 ? (
                            <div className="text-center bg-[var(--bg-elevated)] border border-[var(--border-mid)] rounded-2xl p-16">
                                <div className="w-20 h-20 mx-auto mb-6 bg-[var(--bg-surface)] rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                    <Megaphone size={32} className="text-[var(--text-muted)] opacity-50" />
                                </div>
                                <h3 className="text-xl font-bold text-[var(--text-heading)] mb-2">No Notices Yet</h3>
                                <p className="text-[var(--text-muted)] max-w-md mx-auto mb-6">
                                    You haven't broadcast any official notices. Use the Communication Center to keep the firm aligned.
                                </p>
                                <button onClick={() => setIsComposing(true)} className="btn-secondary">
                                    Compose First Notice
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {notices.map(notice => (
                                    <div key={notice.id} className="bg-[var(--bg-elevated)] border border-[var(--border-mid)] rounded-[var(--radius-lg)] p-5 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:border-[var(--accent-dim)] transition-colors group">

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityColor(notice.priority)}`}>
                                                    {notice.priority}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] text-[var(--text-body)] border-[var(--border-mid)]">
                                                    {notice.type}
                                                </span>
                                                {notice.sendEmail && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--border-accent)] flex items-center gap-1">
                                                        <Mail size={10} /> Email Sent
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-lg font-bold text-[var(--text-heading)] mb-2">{notice.title}</h3>
                                            <p className="text-sm text-[var(--text-body)] line-clamp-2 md:line-clamp-1 mb-3">{notice.content}</p>

                                            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                                                <span className="flex items-center gap-1"><Clock size={12} /> {formatTimeAgo(notice.createdAt)}</span>
                                                <span className="flex items-center gap-1"><Users size={12} /> {getRecipientCount(notice.recipients)} Recipients</span>
                                                <span className="flex items-center gap-1"><ShieldAlert size={12} /> by {notice.createdByName}</span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center md:items-end flex-row md:flex-col justify-between md:justify-center gap-2 md:gap-4 w-full md:w-auto h-full border-t md:border-t-0 md:border-l border-[var(--border-mid)] pt-4 md:pt-0 md:pl-6">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-[var(--accent)]">{notice.readBy?.length || 0}</p>
                                                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Views</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {/* In a real app we might want Edit/Delete for recent notices */}
                                                <span className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity italic">Broadcasted</span>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
