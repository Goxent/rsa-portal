import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ShieldCheck, Users, Search, ChevronDown, Check,
    AlertTriangle, Clock, Building2, Award, ArrowRight,
    ExternalLink, Sparkles, CheckCircle2, Shield, HeartHandshake,
    Compass, FileText, ChevronRight, Edit3, Save, RotateCcw, X,
    Plus, Trash2, Lock, CheckSquare, GraduationCap, Coffee,
    Smartphone, Zap, AlertCircle, UserPlus, ArrowLeftRight,
    Crown, Loader2, UserCheck, UserX, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
    HandbookSection,
    HandbookMetadata,
    WorkstationTable,
    TableSeat,
    DEFAULT_HANDBOOK_METADATA,
    DEFAULT_HANDBOOK_SECTIONS,
    DEFAULT_WORKSTATION_TABLES,
    DEFAULT_ESCALATION_STEPS,
    DEFAULT_ROLE_RESPONSIBILITIES,
} from '../constants/handbook';
import { PolicyService, CompleteHandbookData } from '../services/PolicyService';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';

const VALUE_ICONS: Record<string, React.ElementType> = {
    '01': CheckCircle2,
    '02': Clock,
    '03': Lock,
    '04': Users,
    '05': GraduationCap,
};

const getInitials = (name: string) => {
    if (!name || name === 'VACANT') return '--';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getRolePill = (role: string, isVacant?: boolean) => {
    if (isVacant) {
        return {
            bg: 'bg-secondary text-muted border-border/60',
            dot: 'bg-muted/40',
            label: 'Vacant Desk',
        };
    }
    const r = (role || '').toLowerCase();
    if (r.includes('associate') || r.includes('lead')) {
        return {
            bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            dot: 'bg-emerald-400',
            label: role,
        };
    }
    if (r.includes('third') || r.includes('3rd')) {
        return {
            bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            dot: 'bg-amber-400',
            label: role,
        };
    }
    if (r.includes('second') || r.includes('2nd')) {
        return {
            bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
            dot: 'bg-cyan-400',
            label: role,
        };
    }
    if (r.includes('first') || r.includes('1st')) {
        return {
            bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
            dot: 'bg-indigo-400',
            label: role,
        };
    }
    if (r.includes('trainee') || r.includes('intern')) {
        return {
            bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            dot: 'bg-purple-400',
            label: role,
        };
    }
    return {
        bg: 'bg-secondary text-heading border-border',
        dot: 'bg-accent',
        label: role,
    };
};

const getSeatBadgeStyle = (role: string, isVacant?: boolean, isLeader?: boolean) => {
    if (isVacant) {
        return {
            container: 'bg-secondary/30 border-dashed border-border/60 opacity-60 hover:opacity-100',
            title: 'text-muted italic',
            roleText: 'text-muted/70',
        };
    }
    if (isLeader) {
        return {
            container: 'bg-accent/10 border-accent/40 shadow-xs hover:border-accent',
            title: 'font-bold text-accent',
            roleText: 'text-accent/90',
        };
    }
    const r = (role || '').toLowerCase();
    if (r.includes('senior') || r.includes('lead')) {
        return {
            container: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
            title: 'font-semibold text-emerald-400',
            roleText: 'text-emerald-300/80',
        };
    }
    if (r.includes('associate') || r.includes('tax')) {
        return {
            container: 'bg-sky-500/10 border-sky-500/30 hover:border-sky-500/60',
            title: 'font-semibold text-sky-400',
            roleText: 'text-sky-300/80',
        };
    }
    if (r.includes('trainee') || r.includes('intern')) {
        return {
            container: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60',
            title: 'font-semibold text-amber-400',
            roleText: 'text-amber-300/80',
        };
    }
    return {
        container: 'bg-surface border-border hover:border-accent/40',
        title: 'font-medium text-heading',
        roleText: 'text-muted',
    };
};

const PolicyPage: React.FC = () => {
    const { user } = useAuth();
    const isMasterAdmin = user?.role === UserRole.MASTER_ADMIN;
    const isAdmin = user?.role === UserRole.ADMIN || isMasterAdmin;

    // Restrict view: Admin and Master Admin only for now
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Lock size={28} />
                </div>
                <div className="space-y-1">
                    <h2 className="text-base font-bold text-heading">Restricted Access</h2>
                    <p className="text-xs text-muted max-w-sm">
                        The firm office policy and employee handbook is currently in internal review and available only to firm administrators.
                    </p>
                </div>
            </div>
        );
    }

    // ── Handbook State (Real-time synced from Firestore) ───────────────────
    const [handbookData, setHandbookData] = useState<CompleteHandbookData>({
        metadata: DEFAULT_HANDBOOK_METADATA,
        sections: DEFAULT_HANDBOOK_SECTIONS,
        workstationTables: DEFAULT_WORKSTATION_TABLES,
        escalationSteps: DEFAULT_ESCALATION_STEPS,
        roleResponsibilities: DEFAULT_ROLE_RESPONSIBILITIES,
    });
    const [isLoading, setIsLoading] = useState(true);

    // ── UI States ──────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'ALL' | 'WORKSTATION' | 'HIERARCHY' | 'VALUES'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>('01-purpose-and-culture');
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [acknowledgedLocal, setAcknowledgedLocal] = useState<boolean>(() => {
        return user?.handbookVersionAcknowledged === DEFAULT_HANDBOOK_METADATA.version;
    });

    // ── Master Admin Editing State ─────────────────────────────────────────
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editedMetadata, setEditedMetadata] = useState<HandbookMetadata>(DEFAULT_HANDBOOK_METADATA);
    const [editedSections, setEditedSections] = useState<HandbookSection[]>(DEFAULT_HANDBOOK_SECTIONS);
    const [selectedEditSectionId, setSelectedEditSectionId] = useState<string>('01-purpose-and-culture');

    // ── Workstation Seating States (Editable Desk Blocks) ───────────────────
    const [staffUsers, setStaffUsers] = useState<{ uid: string; displayName: string; role: string; email?: string }[]>([]);
    const [editingSeat, setEditingSeat] = useState<{
        tableNumber: number;
        seatIndex: number;
        seat: TableSeat;
    } | null>(null);
    const [swapTargetKey, setSwapTargetKey] = useState<string>(''); // format: "${tableNumber}-${seatIndex}"
    const [inspectingSeat, setInspectingSeat] = useState<{
        tableNumber: number;
        seat: TableSeat;
        tableTitle: string;
    } | null>(null);

    // Fetch active firm staff for seat assignment dropdown
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const snap = await getDocs(collection(db, 'users'));
                const list = snap.docs.map((d) => {
                    const data = d.data();
                    return {
                        uid: d.id,
                        displayName: data.displayName || data.name || 'Unnamed Staff',
                        role: data.role || 'STAFF',
                        email: data.email || '',
                    };
                });
                list.sort((a, b) => a.displayName.localeCompare(b.displayName));
                setStaffUsers(list);
            } catch (err) {
                console.warn('Failed to load staff list for seat assignment:', err);
            }
        };
        fetchStaff();
    }, []);

    // Save individual workstation seat (or execute seat swap)
    const handleSaveSeat = async (updatedSeat: TableSeat, targetSwapIndexStr?: string) => {
        if (!user || user.role !== UserRole.MASTER_ADMIN) {
            toast.error('Only Master Admin can modify seating arrangement.');
            return;
        }
        if (!editingSeat) return;

        setIsSaving(true);
        try {
            const newTables: WorkstationTable[] = JSON.parse(JSON.stringify(handbookData.workstationTables));
            const currentTable = newTables.find((t) => t.tableNumber === editingSeat.tableNumber);
            if (!currentTable) return;

            if (targetSwapIndexStr) {
                const [targetTblNum, targetSeatIdx] = targetSwapIndexStr.split('-').map(Number);
                const targetTable = newTables.find((t) => t.tableNumber === targetTblNum);
                if (targetTable && targetTable.seats[targetSeatIdx]) {
                    const originalTargetSeat = { ...targetTable.seats[targetSeatIdx] };
                    const currentSeatNumber = updatedSeat.seatNumber;
                    const targetSeatNumber = originalTargetSeat.seatNumber;

                    // Swap occupant data while preserving physical desk IDs
                    targetTable.seats[targetSeatIdx] = {
                        seatNumber: targetSeatNumber,
                        personName: updatedSeat.personName,
                        role: updatedSeat.role,
                        isVacant: updatedSeat.isVacant,
                        isTableLeader: updatedSeat.isTableLeader,
                        notes: updatedSeat.notes,
                    };

                    currentTable.seats[editingSeat.seatIndex] = {
                        seatNumber: currentSeatNumber,
                        personName: originalTargetSeat.personName,
                        role: originalTargetSeat.role,
                        isVacant: originalTargetSeat.isVacant,
                        isTableLeader: originalTargetSeat.isTableLeader,
                        notes: originalTargetSeat.notes,
                    };

                    toast.success(`Swapped ${currentSeatNumber} with ${targetSeatNumber}!`);
                }
            } else {
                currentTable.seats[editingSeat.seatIndex] = {
                    ...updatedSeat,
                    seatNumber: currentTable.seats[editingSeat.seatIndex].seatNumber,
                };
                toast.success(`Updated ${updatedSeat.seatNumber} (${updatedSeat.isVacant ? 'Vacant Desk' : updatedSeat.personName})`);
            }

            await PolicyService.saveHandbook(user, {
                metadata: handbookData.metadata,
                sections: handbookData.sections,
                workstationTables: newTables,
            });

            setEditingSeat(null);
            setSwapTargetKey('');
        } catch (err: any) {
            console.error('Failed to save workstation seat:', err);
            toast.error(err.message || 'Failed to update seat.');
        } finally {
            setIsSaving(false);
        }
    };

    // Reset workstation floor plan to firm baseline
    const handleResetSeating = async () => {
        if (!user || user.role !== UserRole.MASTER_ADMIN) return;
        if (!window.confirm('Reset the workstation floor plan to official firm defaults (Sabina, Parbati, Deepankar, Amrit, etc.)?')) return;

        setIsSaving(true);
        try {
            await PolicyService.saveHandbook(user, {
                metadata: handbookData.metadata,
                sections: handbookData.sections,
                workstationTables: DEFAULT_WORKSTATION_TABLES,
            });
            toast.success('Workstation seating reset to official baseline defaults.');
        } catch (err: any) {
            console.error('Failed to reset seating:', err);
            toast.error(err.message || 'Failed to reset seating.');
        } finally {
            setIsSaving(false);
        }
    };

    // Real-time synchronization
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = PolicyService.subscribeHandbook(
            (data) => {
                setHandbookData(data);
                setEditedMetadata(data.metadata);
                setEditedSections(data.sections);
                setIsLoading(false);
            },
            (error) => {
                console.warn('Handbook sync fallback to default:', error);
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const metadata = handbookData.metadata;
    const sections = handbookData.sections;

    const hasAcknowledged = acknowledgedLocal || user?.handbookVersionAcknowledged === metadata.version;

    // Filter sections based on search query
    const filteredSections = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return sections;

        return sections.filter((sec) => {
            const inTitle = sec.title.toLowerCase().includes(q);
            const inNumber = sec.sectionNumber.toLowerCase().includes(q);
            const inTagline = (sec.tagline || '').toLowerCase().includes(q);
            const inParagraphs = sec.paragraphs.some((p) => p.toLowerCase().includes(q));
            const inRules = (sec.rules || []).some((r) => r.toLowerCase().includes(q));
            const inCallout = (sec.calloutRule?.text || '').toLowerCase().includes(q);
            return inTitle || inNumber || inTagline || inParagraphs || inRules || inCallout;
        });
    }, [sections, searchQuery]);

    // Handle policy acknowledgment
    const handleAcknowledge = async () => {
        if (!user?.uid) return;
        setIsAcknowledging(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const now = new Date().toISOString();
            await updateDoc(userRef, {
                handbookVersionAcknowledged: metadata.version,
                handbookAcknowledgedAt: now,
            });
            setAcknowledgedLocal(true);
            toast.success('Handbook policies acknowledged successfully.');
        } catch (err: any) {
            console.error('Failed to acknowledge policies:', err);
            toast.error('Failed to record acknowledgment. Please try again.');
        } finally {
            setIsAcknowledging(false);
        }
    };

    // Master Admin: Save all changes to Firestore
    const handleSaveHandbook = async () => {
        if (!user || !isMasterAdmin) return;
        setIsSaving(true);
        try {
            await PolicyService.saveHandbook(user, {
                metadata: editedMetadata,
                sections: editedSections,
                workstationTables: handbookData.workstationTables,
            });
            toast.success('Handbook updated successfully in Firestore!');
            setIsEditMode(false);
        } catch (err: any) {
            console.error('Failed to save handbook:', err);
            toast.error(err.message || 'Failed to save handbook');
        } finally {
            setIsSaving(false);
        }
    };

    // Master Admin: Reset to default handbook
    const handleResetToDefault = async () => {
        if (!user || !isMasterAdmin) return;
        if (!window.confirm('Are you sure you want to reset all handbook policies to the firm official baseline?')) return;
        setIsSaving(true);
        try {
            await PolicyService.resetToDefault(user);
            setEditedMetadata(DEFAULT_HANDBOOK_METADATA);
            setEditedSections(DEFAULT_HANDBOOK_SECTIONS);
            toast.success('Handbook reset to default firm baseline.');
            setIsEditMode(false);
        } catch (err: any) {
            console.error('Failed to reset handbook:', err);
            toast.error(err.message || 'Failed to reset handbook');
        } finally {
            setIsSaving(false);
        }
    };

    // Section currently being edited in Edit Mode
    const currentEditingSection = useMemo(() => {
        return editedSections.find((s) => s.id === selectedEditSectionId) || editedSections[0];
    }, [editedSections, selectedEditSectionId]);

    const updateEditingSectionField = (field: keyof HandbookSection, value: any) => {
        setEditedSections((prev) =>
            prev.map((s) => (s.id === selectedEditSectionId ? { ...s, [field]: value } : s))
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
            {/* ── Top Executive Header ─────────────────────────────────────────── */}
            <header className="flex-none bg-surface/90 backdrop-blur-md border-b border-border px-6 py-4 z-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-xs flex-shrink-0">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-heading tracking-tight">
                                    {metadata.firmName} — {metadata.title}
                                </h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                                    {metadata.version}
                                </span>
                                {isEditMode && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                                        Admin Edit Mode
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                                {metadata.firmAffiliation} &middot; Effective {metadata.effectiveDate} &middot; {metadata.tagline}
                            </p>
                        </div>
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Master Admin Edit Mode Toggle */}
                        {isMasterAdmin && (
                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                    isEditMode
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                        : 'bg-secondary border-border text-muted hover:text-heading hover:bg-secondary/80'
                                }`}
                                title="Master Admin: Edit employee handbook and operational policies"
                            >
                                <Edit3 size={13} />
                                <span>{isEditMode ? 'Exit Editor' : 'Edit Policy'}</span>
                            </button>
                        )}

                        {/* Google Form Link */}
                        {metadata.googleFormLink && (
                            <a
                                href={metadata.googleFormLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-muted hover:text-heading border border-border flex items-center gap-1.5 transition-colors"
                            >
                                <span>Declaration Form</span>
                                <ExternalLink size={12} />
                            </a>
                        )}

                        {/* Acknowledgment Badge or Button */}
                        {hasAcknowledged ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                <span>Acknowledged</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleAcknowledge}
                                disabled={isAcknowledging}
                                className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Check size={13} />
                                <span>{isAcknowledging ? 'Recording...' : 'Acknowledge Policy'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Switcher & Navigation */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                    <div className="inline-flex items-center p-0.5 rounded-lg border border-border bg-secondary/80 overflow-x-auto max-w-full">
                        {([
                            { id: 'ALL', label: 'All 17 Handbook Sections', icon: FileText },
                            { id: 'VALUES', label: 'Our Values (02)', icon: Award },
                            { id: 'WORKSTATION', label: 'Workstation & Seating (08)', icon: Building2 },
                            { id: 'HIERARCHY', label: 'Organisation Structure (10)', icon: Users },
                        ] as const).map(({ id, label, icon: Icon }) => {
                            const isActive = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'bg-surface text-heading font-bold shadow-xs border border-border/80'
                                            : 'text-muted hover:text-heading hover:bg-surface/50'
                                    }`}
                                >
                                    <Icon size={13} className={isActive ? 'text-accent' : 'text-muted'} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {isEditMode && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleResetToDefault}
                                disabled={isSaving}
                                className="px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-md flex items-center gap-1 transition-colors"
                            >
                                <RotateCcw size={12} />
                                <span>Reset Baseline</span>
                            </button>
                            <button
                                onClick={handleSaveHandbook}
                                disabled={isSaving}
                                className="px-3.5 py-1 text-xs font-bold bg-accent text-white hover:opacity-90 rounded-md flex items-center gap-1.5 shadow-sm transition-all"
                            >
                                <Save size={12} />
                                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* ── Master Admin Edit Panel (Visible when isEditMode = true) ── */}
                    {isEditMode && isMasterAdmin && (
                        <div className="bg-secondary/90 border-2 border-amber-500/30 rounded-2xl p-6 shadow-card space-y-6 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between pb-4 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                                        <Edit3 size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-heading">Master Admin: Handbook Policy Editor</h2>
                                        <p className="text-xs text-muted">Directly modify firm policies, version numbers, or rules. Changes sync in real-time to all employees.</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-1 rounded bg-surface border border-border text-muted">
                                    17 Sections Configured
                                </span>
                            </div>

                            {/* Metadata Editor */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface p-4 rounded-xl border border-border">
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase">Version String</label>
                                    <input
                                        type="text"
                                        value={editedMetadata.version}
                                        onChange={(e) => setEditedMetadata({ ...editedMetadata, version: e.target.value })}
                                        className="w-full mt-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-heading focus:border-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase">Effective Date</label>
                                    <input
                                        type="text"
                                        value={editedMetadata.effectiveDate}
                                        onChange={(e) => setEditedMetadata({ ...editedMetadata, effectiveDate: e.target.value })}
                                        className="w-full mt-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-heading focus:border-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase">Google Form Declaration URL</label>
                                    <input
                                        type="text"
                                        value={editedMetadata.googleFormLink}
                                        onChange={(e) => setEditedMetadata({ ...editedMetadata, googleFormLink: e.target.value })}
                                        className="w-full mt-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-heading focus:border-accent"
                                    />
                                </div>
                            </div>

                            {/* Section Chooser for Editing */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-heading uppercase tracking-wider">Choose Section to Edit</label>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {editedSections.map((sec) => (
                                        <button
                                            key={sec.id}
                                            onClick={() => setSelectedEditSectionId(sec.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                                                selectedEditSectionId === sec.id
                                                    ? 'bg-accent text-white border-accent shadow-xs'
                                                    : 'bg-surface border-border text-muted hover:text-heading'
                                            }`}
                                        >
                                            {sec.sectionNumber}. {sec.title}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active Section Edit Form */}
                            {currentEditingSection && (
                                <div className="space-y-4 bg-surface p-5 rounded-xl border border-border">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-bold text-muted uppercase">Section Title</label>
                                            <input
                                                type="text"
                                                value={currentEditingSection.title}
                                                onChange={(e) => updateEditingSectionField('title', e.target.value)}
                                                className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-heading focus:border-accent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-muted uppercase">Tagline / Subtitle</label>
                                            <input
                                                type="text"
                                                value={currentEditingSection.tagline || ''}
                                                onChange={(e) => updateEditingSectionField('tagline', e.target.value)}
                                                className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-heading focus:border-accent"
                                                placeholder="Section summary or motto..."
                                            />
                                        </div>
                                    </div>

                                    {/* Callout Rule */}
                                    <div className="p-3 bg-secondary/50 rounded-lg border border-border space-y-2">
                                        <label className="text-[11px] font-bold text-accent uppercase">Callout Rule Banner</label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                value={currentEditingSection.calloutRule?.label || ''}
                                                onChange={(e) =>
                                                    updateEditingSectionField('calloutRule', {
                                                        label: e.target.value,
                                                        text: currentEditingSection.calloutRule?.text || '',
                                                    })
                                                }
                                                placeholder="Label (e.g. THE RULE)"
                                                className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-heading"
                                            />
                                            <input
                                                type="text"
                                                value={currentEditingSection.calloutRule?.text || ''}
                                                onChange={(e) =>
                                                    updateEditingSectionField('calloutRule', {
                                                        label: currentEditingSection.calloutRule?.label || 'THE RULE',
                                                        text: e.target.value,
                                                    })
                                                }
                                                placeholder="Rule text (e.g. 15 minutes grace...)"
                                                className="md:col-span-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-heading"
                                            />
                                        </div>
                                    </div>

                                    {/* Paragraphs Editor */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-muted uppercase">Section Paragraphs & Content</label>
                                        <textarea
                                            rows={6}
                                            value={currentEditingSection.paragraphs.join('\n\n')}
                                            onChange={(e) =>
                                                updateEditingSectionField(
                                                    'paragraphs',
                                                    e.target.value.split('\n\n').filter((p) => p.trim())
                                                )
                                            }
                                            className="w-full p-3 bg-secondary border border-border rounded-lg text-xs text-heading leading-relaxed focus:border-accent font-sans"
                                            placeholder="Separate paragraphs with double newlines..."
                                        />
                                    </div>

                                    {/* Rules Bullet List */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-muted uppercase">Key Bullet Rules (One per line)</label>
                                        <textarea
                                            rows={3}
                                            value={(currentEditingSection.rules || []).join('\n')}
                                            onChange={(e) =>
                                                updateEditingSectionField(
                                                    'rules',
                                                    e.target.value.split('\n').filter((r) => r.trim())
                                                )
                                            }
                                            className="w-full p-3 bg-secondary border border-border rounded-lg text-xs text-heading leading-relaxed focus:border-accent font-sans"
                                            placeholder="Add key rule bullets..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB 1: ALL 17 HANDBOOK SECTIONS ────────────────────────── */}
                    {activeTab === 'ALL' && (
                        <div className="space-y-6">
                            {/* Search Filter Bar */}
                            <div className="flex items-center gap-3 bg-secondary/60 border border-border p-3 rounded-xl">
                                <Search size={14} className="text-muted ml-1" />
                                <input
                                    type="text"
                                    placeholder="Search any handbook topic (e.g. grace period, late mark, dress code, handover, tea breaks, clean desk)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-transparent text-xs text-heading placeholder:text-muted focus:outline-none"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="text-muted hover:text-heading p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Section Cards */}
                            <div className="space-y-4">
                                {filteredSections.length === 0 ? (
                                    <div className="text-center py-12 bg-secondary/40 border border-border rounded-xl">
                                        <BookOpen size={32} className="mx-auto text-muted/40 mb-2" />
                                        <p className="text-sm font-semibold text-heading">No matching policy sections found</p>
                                        <p className="text-xs text-muted mt-1">Try searching for other terms like attendance, punctuality, or dress code.</p>
                                    </div>
                                ) : (
                                    filteredSections.map((sec) => {
                                        const isExpanded = expandedSectionId === sec.id;

                                        return (
                                            <div
                                                key={sec.id}
                                                className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                                                    isExpanded
                                                        ? 'bg-secondary/70 border-accent/40 shadow-xs'
                                                        : 'bg-secondary/30 border-border hover:border-border-mid'
                                                }`}
                                            >
                                                {/* Header Row */}
                                                <button
                                                    onClick={() => setExpandedSectionId(isExpanded ? null : sec.id)}
                                                    className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 cursor-pointer"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-accent/15 text-accent border border-accent/30 tracking-wider">
                                                                SECTION {sec.sectionNumber}
                                                            </span>
                                                            {sec.category && (
                                                                <span className="text-[10px] font-bold text-muted uppercase">
                                                                    {sec.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="text-sm font-bold text-heading mt-0.5">{sec.title}</h3>
                                                        {sec.tagline && (
                                                            <p className="text-xs text-muted italic line-clamp-1">{sec.tagline}</p>
                                                        )}
                                                    </div>

                                                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted">
                                                        <ChevronDown
                                                            size={14}
                                                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </div>
                                                </button>

                                                {/* Expanded Section Details */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="border-t border-border px-5 py-5 space-y-4 bg-surface/50"
                                                        >
                                                            {/* Callout Rule Banner */}
                                                            {sec.calloutRule && (
                                                                <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 flex items-start gap-3">
                                                                    <div className="p-1 rounded bg-accent text-white mt-0.5">
                                                                        <Sparkles size={12} />
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[10px] font-black uppercase tracking-wider text-accent block">
                                                                            {sec.calloutRule.label}
                                                                        </span>
                                                                        <p className="text-xs font-bold text-heading mt-0.5">
                                                                            {sec.calloutRule.text}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Who this applies to (Section 01) */}
                                                            {sec.whoThisAppliesTo && (
                                                                <div className="p-3.5 rounded-xl border border-border bg-secondary/40 space-y-1">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                                                                        WHO THIS APPLIES TO
                                                                    </span>
                                                                    <p className="text-xs text-heading leading-relaxed">
                                                                        {sec.whoThisAppliesTo}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Paragraphs */}
                                                            <div className="space-y-2.5 text-xs text-heading leading-relaxed">
                                                                {sec.paragraphs.map((para, i) => (
                                                                    <p key={i} className="whitespace-pre-line">
                                                                        {para}
                                                                    </p>
                                                                ))}
                                                            </div>

                                                            {/* Tables (e.g. Section 03 & 04 & 11) */}
                                                            {sec.tables && sec.tables.length > 0 && (
                                                                <div className="space-y-3 pt-2">
                                                                    {sec.tables.map((t, tidx) => (
                                                                        <div key={tidx} className="overflow-x-auto rounded-xl border border-border">
                                                                            {t.title && (
                                                                                <div className="px-3 py-2 bg-secondary/80 border-b border-border text-[11px] font-bold text-heading">
                                                                                    {t.title}
                                                                                </div>
                                                                            )}
                                                                            <table className="w-full text-left text-xs">
                                                                                <thead className="bg-secondary/40 border-b border-border">
                                                                                    <tr>
                                                                                        {t.headers.map((h, hidx) => (
                                                                                            <th key={hidx} className="px-3 py-2 font-bold text-muted uppercase text-[10px]">
                                                                                                {h}
                                                                                            </th>
                                                                                        ))}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-border">
                                                                                    {t.rows.map((row, ridx) => (
                                                                                        <tr key={ridx} className="hover:bg-surface/60 transition-colors">
                                                                                            {row.map((cell, cidx) => (
                                                                                                <td key={cidx} className={`px-3 py-2.5 ${cidx === 0 ? 'font-bold text-heading' : 'text-muted'}`}>
                                                                                                    {cell}
                                                                                                </td>
                                                                                            ))}
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Subsections (e.g. 8.1, 8.2, 8.3, 15.1, etc.) */}
                                                            {sec.subsections && sec.subsections.length > 0 && (
                                                                <div className="space-y-4 pt-3 border-t border-border">
                                                                    {sec.subsections.map((sub) => (
                                                                        <div key={sub.id} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                                                                            <h4 className="text-xs font-bold text-heading uppercase tracking-wide">
                                                                                {sub.title}
                                                                            </h4>
                                                                            {sub.subtitle && (
                                                                                <p className="text-[11px] text-muted italic">{sub.subtitle}</p>
                                                                            )}
                                                                            <div className="space-y-2 text-xs text-heading leading-relaxed pt-1">
                                                                                {sub.paragraphs.map((sp, sidx) => (
                                                                                    <p key={sidx} className="whitespace-pre-line">
                                                                                        {sp}
                                                                                    </p>
                                                                                ))}
                                                                            </div>
                                                                            {sub.rules && sub.rules.length > 0 && (
                                                                                <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                                                                                    {sub.rules.map((sr, sridx) => (
                                                                                        <div key={sridx} className="flex items-start gap-2 text-xs text-muted">
                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                                                                                            <span>{sr}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Bullet Rules */}
                                                            {sec.rules && sec.rules.length > 0 && (
                                                                <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1.5">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">
                                                                        ESSENTIAL RULES & PROCEDURES
                                                                    </span>
                                                                    {sec.rules.map((rule, idx) => (
                                                                        <div key={idx} className="flex items-start gap-2 text-xs text-heading">
                                                                            <CheckCircle2 size={13} className="text-accent flex-shrink-0 mt-0.5" />
                                                                            <span>{rule}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Section 08 Workstation Jump Button */}
                                                            {sec.sectionNumber === '08' && (
                                                                <div className="pt-2">
                                                                    <button
                                                                        onClick={() => setActiveTab('WORKSTATION')}
                                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent font-bold text-xs rounded-xl border border-accent/30 transition-all cursor-pointer"
                                                                    >
                                                                        <Users size={14} />
                                                                        <span>Open Visual Seating Floor Plan (2×2, 6×2, 7×1 Tables)</span>
                                                                        <ChevronRight size={14} />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Section 10 Hierarchy Jump Button */}
                                                            {sec.sectionNumber === '10' && (
                                                                <div className="pt-2">
                                                                    <button
                                                                        onClick={() => setActiveTab('HIERARCHY')}
                                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent font-bold text-xs rounded-xl border border-accent/30 transition-all cursor-pointer"
                                                                    >
                                                                        <Building2 size={14} />
                                                                        <span>Open Firm Hierarchy & 5-Step Escalation Ladder</span>
                                                                        <ChevronRight size={14} />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Section 17 Google Form Button */}
                                                            {sec.sectionNumber === '17' && metadata.googleFormLink && (
                                                                <div className="pt-2">
                                                                    <a
                                                                        href={metadata.googleFormLink}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                                                                    >
                                                                        <span>Open Official Google Form Declaration</span>
                                                                        <ExternalLink size={14} />
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── TAB 2: OUR VALUES (SECTION 02) ─────────────────────────── */}
                    {activeTab === 'VALUES' && (
                        <div className="space-y-6">
                            <div className="p-5 rounded-2xl bg-secondary/40 border border-border">
                                <h3 className="text-sm font-bold text-heading">02. Our Core Values</h3>
                                <p className="text-xs text-muted mt-1">
                                    These are the everyday habits behind how we work, how we support each other and how we serve our clients.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {DEFAULT_HANDBOOK_SECTIONS.find((s) => s.sectionNumber === '02')?.values?.map((v) => {
                                    const IconComponent = VALUE_ICONS[v.number] || Award;
                                    return (
                                        <div
                                            key={v.id}
                                            className="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-accent/40 transition-all space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                                                        <IconComponent size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-accent">
                                                            VALUE {v.number}
                                                        </span>
                                                        <h4 className="text-sm font-bold text-heading">{v.title}</h4>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-[10px] font-mono font-bold text-muted bg-secondary px-2.5 py-1 rounded-md border border-border inline-block">
                                                {v.pillars}
                                            </div>

                                            <p className="text-xs text-heading leading-relaxed">{v.description}</p>

                                            <div className="pt-2 border-t border-border flex items-center gap-1.5 text-accent text-xs font-semibold italic">
                                                <Sparkles size={12} />
                                                <span>"{v.motto}"</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── TAB 3: WORKSTATION & SEATING (SECTION 08) ──────────────── */}
                    {activeTab === 'WORKSTATION' && (
                        <div className="space-y-6">
                            {/* Workstation Header & Live Statistics */}
                            <div className="p-6 rounded-2xl bg-secondary/40 border border-border space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-heading">
                                                08.1 RSA Workstation Seating Plan
                                            </h3>
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
                                                Interactive Floor Plan
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted mt-1 max-w-2xl">
                                            The RSA Workstation is structured into three experience-based tables. Table 1 leads Table 2 and Table 3. Table 2 leads Table 3. Table 3 is where we invest most in training.
                                        </p>
                                    </div>

                                    {/* Master Admin Controls */}
                                    {isMasterAdmin && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleResetSeating}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                                                title="Reset workstation seating arrangement to firm baseline"
                                            >
                                                <RotateCcw size={13} />
                                                <span>Reset Seating to Baseline</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Desk Quick Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                    <div className="p-3 rounded-xl bg-surface border border-border">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-muted">Total Desks</p>
                                        <p className="text-lg font-black text-heading mt-0.5">
                                            {handbookData.workstationTables.reduce((acc, t) => acc + t.seats.length, 0)} Desks
                                        </p>
                                        <p className="text-[10px] text-muted font-medium">Table 1 (4) • Table 2 (12) • Table 3 (7)</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-surface border border-border">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Occupied Desks</p>
                                        <p className="text-lg font-black text-emerald-400 mt-0.5">
                                            {handbookData.workstationTables.reduce(
                                                (acc, t) => acc + t.seats.filter((s) => !s.isVacant && s.personName !== 'VACANT').length,
                                                0
                                            )}{' '}
                                            Staff
                                        </p>
                                        <p className="text-[10px] text-muted font-medium">Active seat assignments</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-surface border border-border">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-muted">Available Desks</p>
                                        <p className="text-lg font-black text-heading mt-0.5">
                                            {handbookData.workstationTables.reduce(
                                                (acc, t) => acc + t.seats.filter((s) => s.isVacant || s.personName === 'VACANT').length,
                                                0
                                            )}{' '}
                                            Vacant
                                        </p>
                                        <p className="text-[10px] text-muted font-medium">Ready for allocation</p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-surface border border-border">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Table Leaders</p>
                                        <p className="text-lg font-black text-amber-400 mt-0.5">
                                            {handbookData.workstationTables.reduce((acc, t) => acc + t.seats.filter((s) => s.isTableLeader).length, 0)} Leads
                                        </p>
                                        <p className="text-[10px] text-muted font-medium">Supervisory & review points</p>
                                    </div>
                                </div>

                                {isMasterAdmin ? (
                                    <div className="p-3 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-between text-xs text-accent">
                                        <div className="flex items-center gap-2">
                                            <Edit3 size={14} className="flex-shrink-0" />
                                            <span>
                                                <strong>Master Admin Live Mode:</strong> Click any desk block below to reassign staff, change role, designate table leader, or swap seats.
                                            </span>
                                        </div>
                                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-accent/20">Click to Edit</span>
                                    </div>
                                ) : (
                                    <div className="p-2.5 rounded-xl bg-secondary/50 border border-border text-[11px] text-muted flex items-center gap-2">
                                        <Users size={13} className="text-accent flex-shrink-0" />
                                        <span>Click on any desk block to view member responsibilities and table guidance flow.</span>
                                    </div>
                                )}
                            </div>

                            {/* Tables Floor Visualizer: Table 1 (2*2), Table 2 (6*2), Table 3 (7*1) */}
                            <div className="space-y-6">
                                {handbookData.workstationTables.map((tbl, tidx) => {
                                    // Dimension specification based on table number
                                    const gridClass =
                                        tbl.tableNumber === 1
                                            ? 'grid grid-cols-2 gap-3.5 max-w-lg mx-auto' // 2*2
                                            : tbl.tableNumber === 2
                                            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5' // 6*2
                                            : 'grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-2.5'; // 7*1

                                    const dimBadge =
                                        tbl.tableNumber === 1
                                            ? '2 × 2 Grid (4 Seats)'
                                            : tbl.tableNumber === 2
                                            ? '6 × 2 Grid (12 Seats)'
                                            : '7 × 1 Grid (7 Seats)';

                                    return (
                                        <React.Fragment key={tbl.tableNumber}>
                                            <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
                                                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-bold text-heading">{tbl.title}</h4>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent/15 text-accent border border-accent/30">
                                                                {dimBadge}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-accent font-semibold mt-0.5">{tbl.subtitle}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-secondary border border-border text-muted">
                                                        {tbl.leaderTitle}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-muted">{tbl.description}</p>

                                                {/* Physical Desk Blocks Grid */}
                                                <div className={gridClass}>
                                                    {tbl.seats.map((seat, sidx) => {
                                                        const style = getSeatBadgeStyle(seat.role, seat.isVacant, seat.isTableLeader);
                                                        const pill = getRolePill(seat.role, seat.isVacant);

                                                        return (
                                                            <div
                                                                key={sidx}
                                                                onClick={() => {
                                                                    if (isMasterAdmin) {
                                                                        setEditingSeat({
                                                                            tableNumber: tbl.tableNumber,
                                                                            seatIndex: sidx,
                                                                            seat: { ...seat },
                                                                        });
                                                                        setSwapTargetKey('');
                                                                    } else {
                                                                        setInspectingSeat({
                                                                            tableNumber: tbl.tableNumber,
                                                                            seat: { ...seat },
                                                                            tableTitle: tbl.title,
                                                                        });
                                                                    }
                                                                }}
                                                                className={`group relative p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between min-h-[110px] cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-md ${style.container}`}
                                                                title={isMasterAdmin ? `Click to edit ${seat.seatNumber}` : `Click to view ${seat.seatNumber}`}
                                                            >
                                                                {/* Desk Block Header */}
                                                                <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-border/40">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-secondary/80 border border-border/60 text-heading">
                                                                            {seat.seatNumber}
                                                                        </span>
                                                                        {seat.isVacant ? (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" title="Vacant" />
                                                                        ) : (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Occupied" />
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-1">
                                                                        {seat.isTableLeader && (
                                                                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5 shadow-2xs">
                                                                                <Crown size={9} />
                                                                                <span>Leader</span>
                                                                            </span>
                                                                        )}
                                                                        {isMasterAdmin && (
                                                                            <span className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-accent/20 text-accent transition-opacity">
                                                                                <Edit3 size={11} />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Desk Block Body */}
                                                                <div className="my-1.5 flex items-center gap-2">
                                                                    <div
                                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-transform group-hover:scale-105 ${
                                                                            seat.isVacant
                                                                                ? 'bg-secondary/60 border border-dashed border-border text-muted'
                                                                                : 'bg-accent/15 text-accent border border-accent/30'
                                                                        }`}
                                                                    >
                                                                        {seat.isVacant ? <UserPlus size={13} className="text-muted/60" /> : getInitials(seat.personName)}
                                                                    </div>

                                                                    <div className="min-w-0 flex-1">
                                                                        <p className={`text-xs leading-tight font-bold truncate ${style.title}`}>
                                                                            {seat.isVacant ? 'Vacant Desk' : seat.personName}
                                                                        </p>
                                                                        <p className={`text-[9px] mt-0.5 font-semibold truncate px-1 py-0.5 rounded inline-block max-w-full ${pill.bg}`}>
                                                                            {seat.isVacant ? 'Available' : seat.role}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Desk Block Footer (Assignment Notes) */}
                                                                <div className="pt-1 border-t border-border/30 flex items-center justify-between text-[9px] text-muted">
                                                                    <span className="truncate max-w-[85%] font-medium">
                                                                        {seat.notes || (seat.isVacant ? (isMasterAdmin ? '+ Assign Staff' : 'Unallocated') : 'General Audit')}
                                                                    </span>
                                                                    {isMasterAdmin && (
                                                                        <span className="text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            Edit
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Flow Connector Arrow between tables */}
                                            {tidx === 0 && (
                                                <div className="flex flex-col items-center justify-center my-1 text-muted">
                                                    <div className="w-px h-5 bg-border-mid" />
                                                    <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-secondary border border-border text-accent flex items-center gap-1.5 shadow-xs">
                                                        <span>▼</span>
                                                        <span>Table 1 leads Table 2 and Table 3</span>
                                                    </div>
                                                    <div className="w-px h-5 bg-border-mid" />
                                                </div>
                                            )}

                                            {tidx === 1 && (
                                                <div className="flex flex-col items-center justify-center my-1 text-muted">
                                                    <div className="w-px h-5 bg-border-mid" />
                                                    <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-secondary border border-border text-accent flex items-center gap-1.5 shadow-xs">
                                                        <span>▼</span>
                                                        <span>Table 2 leads Table 3 (Training Priority)</span>
                                                    </div>
                                                    <div className="w-px h-5 bg-border-mid" />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Visual Role Color Legend */}
                                <div className="p-4 rounded-xl bg-secondary/40 border border-border flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="text-heading font-medium">Audit Associate</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                        <span className="text-heading font-medium">Third-Year Article</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                                        <span className="text-heading font-medium">Second-Year Article</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                        <span className="text-heading font-medium">First-Year Article</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                        <span className="text-heading font-medium">Intern / Trainee</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-500 bg-white/10" />
                                        <span className="italic">Vacant Desk</span>
                                    </div>
                                </div>
                            </div>

                            {/* 5-Step Issue Escalation Ladder */}
                            <div className="p-6 rounded-2xl bg-secondary/50 border border-border space-y-4">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-heading">
                                        Seat Leaders & 5-Step Issue Escalation Ladder
                                    </h4>
                                    <p className="text-xs text-muted mt-0.5">
                                        No Skipping: Discuss with tablemates first in order of experience. Move up only when the table cannot solve it.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {handbookData.escalationSteps.map((step) => (
                                        <div
                                            key={step.step}
                                            className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5 relative overflow-hidden"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-black flex items-center justify-center">
                                                    {step.step}
                                                </span>
                                                <span className="text-xs font-bold text-heading uppercase">{step.title}</span>
                                            </div>
                                            <p className="text-[10px] font-semibold text-accent">{step.subtitle}</p>
                                            <p className="text-[11px] text-muted leading-relaxed">{step.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB 4: ORGANISATIONAL STRUCTURE (SECTION 10) ───────────── */}
                    {activeTab === 'HIERARCHY' && (
                        <div className="space-y-6">
                            <div className="p-5 rounded-2xl bg-secondary/40 border border-border">
                                <h3 className="text-sm font-bold text-heading">10. Organisational Structure & Reporting Hierarchy</h3>
                                <p className="text-xs text-muted mt-1">
                                    Clear communication keeps work moving and keeps everyone informed. The hierarchy is for clarity, quality and learning, not for status.
                                </p>
                            </div>

                            {/* Roles & Responsibilities Matrix */}
                            <div className="overflow-x-auto rounded-2xl border border-border">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-secondary/70 border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 font-bold text-muted uppercase text-[10px]">Role / Level</th>
                                            <th className="px-4 py-3 font-bold text-muted uppercase text-[10px]">Key Responsibilities</th>
                                            <th className="px-4 py-3 font-bold text-muted uppercase text-[10px]">Trains & Reviews</th>
                                            <th className="px-4 py-3 font-bold text-muted uppercase text-[10px]">Reports To</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-surface">
                                        {handbookData.roleResponsibilities.map((r, ridx) => (
                                            <tr key={ridx} className="hover:bg-secondary/20 transition-colors">
                                                <td className="px-4 py-3 font-bold text-heading align-top">
                                                    <div>{r.role}</div>
                                                    {r.tableOrLevel && (
                                                        <span className="text-[10px] text-accent font-semibold block mt-0.5">
                                                            {r.tableOrLevel}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted align-top space-y-1">
                                                    {r.keyResponsibilities.map((item, i) => (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </td>
                                                <td className="px-4 py-3 text-muted align-top space-y-1">
                                                    {r.trainsAndReviews.map((item, i) => (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-muted mt-1.5 flex-shrink-0" />
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-accent align-top whitespace-nowrap">
                                                    {r.reportsTo}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ── SEAT CONFIGURATION MODAL (MASTER ADMIN LIVE EDIT) ── */}
            <AnimatePresence>
                {editingSeat && isMasterAdmin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-5 py-4 border-b border-border bg-secondary/50 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                                            {editingSeat.seat.seatNumber}
                                        </span>
                                        <h3 className="text-sm font-bold text-heading">
                                            Configure Desk — Table {editingSeat.tableNumber}
                                        </h3>
                                    </div>
                                    <p className="text-[11px] text-muted mt-0.5">
                                        Update desk assignment, title, table leadership, or execute a seat swap.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setEditingSeat(null)}
                                    className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-secondary transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                                {/* Occupancy Toggle */}
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Desk Occupancy Status
                                    </label>
                                    <div className="flex items-center gap-2 p-1 bg-secondary rounded-xl border border-border">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditingSeat((prev) =>
                                                    prev
                                                        ? {
                                                              ...prev,
                                                              seat: {
                                                                  ...prev.seat,
                                                                  isVacant: false,
                                                                  personName: prev.seat.personName === 'VACANT' ? '' : prev.seat.personName,
                                                              },
                                                          }
                                                        : null
                                                )
                                            }
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                !editingSeat.seat.isVacant
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
                                                    : 'text-muted hover:text-heading'
                                            }`}
                                        >
                                            <UserCheck size={14} />
                                            <span>Occupied Desk</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditingSeat((prev) =>
                                                    prev
                                                        ? {
                                                              ...prev,
                                                              seat: {
                                                                  ...prev.seat,
                                                                  isVacant: true,
                                                                  personName: 'VACANT',
                                                                  isTableLeader: false,
                                                              },
                                                          }
                                                        : null
                                                )
                                            }
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                editingSeat.seat.isVacant
                                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-xs'
                                                    : 'text-muted hover:text-heading'
                                            }`}
                                        >
                                            <UserX size={14} />
                                            <span>Mark as Vacant</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Quick Assign from Registered Staff */}
                                {!editingSeat.seat.isVacant && (
                                    <div>
                                        <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                            Assign Registered Firm Staff
                                        </label>
                                        <select
                                            onChange={(e) => {
                                                const uid = e.target.value;
                                                if (!uid) return;
                                                const selected = staffUsers.find((s) => s.uid === uid);
                                                if (selected) {
                                                    setEditingSeat((prev) =>
                                                        prev
                                                            ? {
                                                                  ...prev,
                                                                  seat: {
                                                                      ...prev.seat,
                                                                      personName: selected.displayName,
                                                                      role: selected.role || prev.seat.role,
                                                                      isVacant: false,
                                                                  },
                                                              }
                                                            : null
                                                    );
                                                }
                                            }}
                                            className="w-full px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-heading focus:border-accent focus:outline-none cursor-pointer"
                                            defaultValue=""
                                        >
                                            <option value="">-- Choose from active staff directory ({staffUsers.length}) --</option>
                                            {staffUsers.map((st) => (
                                                <option key={st.uid} value={st.uid}>
                                                    {st.displayName} ({st.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Occupant Name */}
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Occupant Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSeat.seat.isVacant ? '' : editingSeat.seat.personName}
                                        disabled={editingSeat.seat.isVacant}
                                        onChange={(e) =>
                                            setEditingSeat((prev) =>
                                                prev ? { ...prev, seat: { ...prev.seat, personName: e.target.value } } : null
                                            )
                                        }
                                        placeholder={editingSeat.seat.isVacant ? 'Desk is Vacant' : 'Full Name of Employee'}
                                        className="w-full px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-heading focus:border-accent focus:outline-none disabled:opacity-50"
                                    />
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Assigned Role / Level
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {['Audit Associate', 'Third-Year Article', 'Second-Year Article', 'First-Year Article', 'Intern / Trainee'].map(
                                            (r) => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    disabled={editingSeat.seat.isVacant}
                                                    onClick={() =>
                                                        setEditingSeat((prev) =>
                                                            prev ? { ...prev, seat: { ...prev.seat, role: r } } : null
                                                        )
                                                    }
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer disabled:opacity-40 ${
                                                        editingSeat.seat.role === r
                                                            ? 'bg-accent text-white border-accent'
                                                            : 'bg-secondary border-border text-muted hover:text-heading'
                                                    }`}
                                                >
                                                    {r}
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={editingSeat.seat.isVacant ? '' : editingSeat.seat.role}
                                        disabled={editingSeat.seat.isVacant}
                                        onChange={(e) =>
                                            setEditingSeat((prev) =>
                                                prev ? { ...prev, seat: { ...prev.seat, role: e.target.value } } : null
                                            )
                                        }
                                        placeholder="Role Title (e.g. Audit Associate, Field Lead)"
                                        className="w-full px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-heading focus:border-accent focus:outline-none disabled:opacity-50"
                                    />
                                </div>

                                {/* Table Leader Designation */}
                                <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                                            <Crown size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-heading">Designate as Table Leader</p>
                                            <p className="text-[10px] text-muted">First-level review and day-to-day guidance for this table</p>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editingSeat.seat.isTableLeader)}
                                        disabled={editingSeat.seat.isVacant}
                                        onChange={(e) =>
                                            setEditingSeat((prev) =>
                                                prev ? { ...prev, seat: { ...prev.seat, isTableLeader: e.target.checked } } : null
                                            )
                                        }
                                        className="w-4 h-4 rounded text-accent focus:ring-accent accent-accent cursor-pointer disabled:opacity-40"
                                    />
                                </div>

                                {/* Specialization & Assignment Notes */}
                                <div>
                                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Specialization / Focus Note
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSeat.seat.notes || ''}
                                        disabled={editingSeat.seat.isVacant}
                                        onChange={(e) =>
                                            setEditingSeat((prev) =>
                                                prev ? { ...prev, seat: { ...prev.seat, notes: e.target.value } } : null
                                            )
                                        }
                                        placeholder="e.g. Fieldwork Lead, Commercial Audit, Statutory Verification"
                                        className="w-full px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-heading focus:border-accent focus:outline-none disabled:opacity-50"
                                    />
                                </div>

                                {/* Desk Swap Utility */}
                                <div className="pt-3 border-t border-border space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                                        <ArrowLeftRight size={14} />
                                        <span>Swap Desk with Another Seat</span>
                                    </div>
                                    <p className="text-[10px] text-muted">
                                        Instantly swap this desk's occupant and role with any other desk across Tables 1, 2, or 3.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={swapTargetKey}
                                            onChange={(e) => setSwapTargetKey(e.target.value)}
                                            className="flex-1 px-3 py-2 text-xs bg-secondary border border-border rounded-xl text-heading focus:border-accent focus:outline-none cursor-pointer"
                                        >
                                            <option value="">-- Select target desk to swap with --</option>
                                            {handbookData.workstationTables.map((t) => (
                                                <optgroup key={t.tableNumber} label={`Table ${t.tableNumber} - ${t.title}`}>
                                                    {t.seats.map((s, idx) => {
                                                        if (t.tableNumber === editingSeat.tableNumber && idx === editingSeat.seatIndex) {
                                                            return null;
                                                        }
                                                        return (
                                                            <option key={`${t.tableNumber}-${idx}`} value={`${t.tableNumber}-${idx}`}>
                                                                {s.seatNumber}: {s.isVacant ? 'VACANT' : s.personName} ({s.role})
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            disabled={!swapTargetKey || isSaving}
                                            onClick={() => handleSaveSeat(editingSeat.seat, swapTargetKey)}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                                        >
                                            Swap Now
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-3 border-t border-border bg-secondary/50 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setEditingSeat(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-heading hover:bg-secondary transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleSaveSeat(editingSeat.seat)}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-accent hover:opacity-90 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span>Save Desk Changes</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── SEAT INSPECTION MODAL (READ-ONLY FOR STAFF) ── */}
            <AnimatePresence>
                {inspectingSeat && !isMasterAdmin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-xl overflow-hidden p-5 space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                                    {inspectingSeat.seat.seatNumber}
                                </span>
                                <button
                                    onClick={() => setInspectingSeat(null)}
                                    className="p-1 rounded-lg text-muted hover:text-heading hover:bg-secondary transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="text-center py-2 space-y-2">
                                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-base font-black bg-accent/15 text-accent border border-accent/30 shadow-xs">
                                    {inspectingSeat.seat.isVacant ? (
                                        <UserPlus size={22} className="text-muted" />
                                    ) : (
                                        getInitials(inspectingSeat.seat.personName)
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-heading">
                                        {inspectingSeat.seat.isVacant ? 'Available Workstation Desk' : inspectingSeat.seat.personName}
                                    </h4>
                                    <p className="text-xs text-accent font-medium mt-0.5">{inspectingSeat.seat.role}</p>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-muted">
                                    <span>Workstation Table:</span>
                                    <span className="font-semibold text-heading">Table {inspectingSeat.tableNumber}</span>
                                </div>
                                {inspectingSeat.seat.isTableLeader && (
                                    <div className="flex items-center justify-between text-amber-400 font-semibold">
                                        <span>Authority:</span>
                                        <span className="flex items-center gap-1">
                                            <Crown size={12} /> Table Leader
                                        </span>
                                    </div>
                                )}
                                {inspectingSeat.seat.notes && (
                                    <div className="flex items-center justify-between text-muted">
                                        <span>Specialization:</span>
                                        <span className="font-semibold text-heading">{inspectingSeat.seat.notes}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setInspectingSeat(null)}
                                className="w-full py-2 rounded-xl text-xs font-bold bg-secondary border border-border text-heading hover:bg-secondary/80 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PolicyPage;
