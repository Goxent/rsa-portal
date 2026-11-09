import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ShieldCheck, Users, Search, ChevronDown, Check,
    AlertTriangle, Clock, Building2, Award, ArrowRight,
    ExternalLink, Sparkles, CheckCircle2, Shield, HeartHandshake,
    Compass, FileText, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HANDBOOK_METADATA,
    HANDBOOK_POLICIES,
    OFFICE_SEATING_TABLES,
    ISSUE_ESCALATION_LADDER,
    ORG_STRUCTURE_ROLES,
    PolicySection
} from '../constants/handbook';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    ATTENDANCE: { label: 'Attendance & Hours', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    LEAVE: { label: 'Leave & Absence', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    FIELDWORK: { label: 'Fieldwork & Travel', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    WORKFLOW: { label: 'Task & Audit Quality', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    ETHICS: { label: 'Ethics & Independence', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    GROWTH: { label: 'Professional Growth', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
};

const PolicyPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'POLICIES' | 'SEATING' | 'STRUCTURE'>('POLICIES');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(HANDBOOK_POLICIES[0]?.id || null);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [acknowledgedLocal, setAcknowledgedLocal] = useState<boolean>(() => {
        return user?.handbookVersionAcknowledged === HANDBOOK_METADATA.version;
    });

    const hasAcknowledged = acknowledgedLocal || user?.handbookVersionAcknowledged === HANDBOOK_METADATA.version;

    // Filter policies by search query and category
    const filteredPolicies = useMemo(() => {
        return HANDBOOK_POLICIES.filter(policy => {
            const matchesCategory = categoryFilter === 'ALL' || policy.category === categoryFilter;
            const q = searchQuery.toLowerCase().trim();
            if (!q) return matchesCategory;

            const matchesSearch =
                policy.title.toLowerCase().includes(q) ||
                policy.subtitle.toLowerCase().includes(q) ||
                policy.highlights.some(h => h.toLowerCase().includes(q)) ||
                policy.criticalRules.some(r => r.toLowerCase().includes(q)) ||
                policy.content.some(c => c.toLowerCase().includes(q));

            return matchesCategory && matchesSearch;
        });
    }, [searchQuery, categoryFilter]);

    // Handle policy acknowledgment
    const handleAcknowledge = async () => {
        if (!user?.uid) return;
        setIsAcknowledging(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const now = new Date().toISOString();
            await updateDoc(userRef, {
                handbookVersionAcknowledged: HANDBOOK_METADATA.version,
                handbookAcknowledgedAt: now
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

    return (
        <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
            {/* Top Executive Header */}
            <header className="flex-none bg-surface/90 backdrop-blur-md border-b border-border px-6 py-4 z-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-xs flex-shrink-0">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-heading tracking-tight">Firm Handbook & Operational Policies</h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                                    {HANDBOOK_METADATA.version}
                                </span>
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                                {HANDBOOK_METADATA.firmName} &middot; {HANDBOOK_METADATA.firmAffiliation} &middot; Effective {HANDBOOK_METADATA.effectiveDate}
                            </p>
                        </div>
                    </div>

                    {/* Acknowledgment Badge or Button */}
                    <div className="flex items-center gap-3">
                        {hasAcknowledged ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                <span>Policies Acknowledged</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleAcknowledge}
                                disabled={isAcknowledging}
                                className="px-4 py-2 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Check size={14} />
                                <span>{isAcknowledging ? 'Recording...' : 'Acknowledge Handbook'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/60">
                    <div className="inline-flex items-center p-0.5 rounded-lg border border-border bg-secondary/80">
                        {([
                            { id: 'POLICIES', label: 'Firm Policies & Standards', icon: ShieldCheck },
                            { id: 'SEATING', label: 'Office Layout & Escalation', icon: Building2 },
                            { id: 'STRUCTURE', label: 'Organizational Hierarchy', icon: Users }
                        ] as const).map(({ id, label, icon: Icon }) => {
                            const isActive = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                        isActive
                                            ? 'bg-surface text-heading font-bold shadow-xs border border-border/80'
                                            : 'text-muted hover:text-heading hover:bg-surface/50'
                                    }`}
                                >
                                    <Icon size={14} className={isActive ? 'text-accent' : 'text-muted'} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* TAB 1: FIRM POLICIES */}
                    {activeTab === 'POLICIES' && (
                        <div className="space-y-6">
                            {/* Search & Category Filter Bar */}
                            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-secondary/60 border border-border p-3 rounded-xl">
                                <div className="relative flex-1 min-w-[240px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Search policy, punctuality, grace period, leave, field rules..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-[34px] bg-surface border border-border rounded-lg pl-9 pr-3 text-xs text-heading placeholder:text-muted focus:outline-none focus:border-accent/50 transition-all shadow-xs"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                                    <button
                                        onClick={() => setCategoryFilter('ALL')}
                                        className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all whitespace-nowrap ${
                                            categoryFilter === 'ALL'
                                                ? 'bg-accent/15 text-accent border border-accent/30 font-bold'
                                                : 'text-muted hover:text-heading bg-surface border border-border'
                                        }`}
                                    >
                                        All ({HANDBOOK_POLICIES.length})
                                    </button>
                                    {Object.entries(CATEGORY_LABELS).map(([catKey, { label }]) => {
                                        const count = HANDBOOK_POLICIES.filter(p => p.category === catKey).length;
                                        const isSelected = categoryFilter === catKey;
                                        return (
                                            <button
                                                key={catKey}
                                                onClick={() => setCategoryFilter(catKey)}
                                                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all whitespace-nowrap ${
                                                    isSelected
                                                        ? 'bg-accent/15 text-accent border border-accent/30 font-bold'
                                                        : 'text-muted hover:text-heading bg-surface border border-border'
                                                }`}
                                            >
                                                {label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Policies List */}
                            <div className="space-y-3">
                                {filteredPolicies.length === 0 ? (
                                    <div className="text-center py-12 bg-secondary/40 border border-border rounded-xl">
                                        <BookOpen size={32} className="mx-auto text-muted/40 mb-2" />
                                        <p className="text-sm font-semibold text-heading">No policy documents found</p>
                                        <p className="text-xs text-muted mt-1">Try adjusting your search terms or category filter.</p>
                                    </div>
                                ) : (
                                    filteredPolicies.map((policy) => {
                                        const isExpanded = expandedPolicyId === policy.id;
                                        const cat = CATEGORY_LABELS[policy.category] || { label: policy.category, color: 'bg-surface text-muted border-border' };

                                        return (
                                            <div
                                                key={policy.id}
                                                className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                                                    isExpanded
                                                        ? 'bg-secondary/70 border-accent/40 shadow-xs'
                                                        : 'bg-secondary/30 border-border hover:border-border-mid'
                                                }`}
                                            >
                                                {/* Header Row */}
                                                <button
                                                    onClick={() => setExpandedPolicyId(isExpanded ? null : policy.id)}
                                                    className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${cat.color}`}>
                                                                {cat.label}
                                                            </span>
                                                            <span className="text-xs font-semibold text-muted">Section {policy.id}</span>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-heading mt-0.5">{policy.title}</h3>
                                                        <p className="text-xs text-muted line-clamp-1">{policy.subtitle}</p>
                                                    </div>

                                                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-muted">
                                                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </button>

                                                {/* Expanded Content */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="border-t border-border px-5 py-4 space-y-4 bg-surface/40"
                                                        >
                                                            {/* Key Highlights */}
                                                            {policy.highlights.length > 0 && (
                                                                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg space-y-1.5">
                                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                                                                        <Sparkles size={13} />
                                                                        <span>Executive Highlights</span>
                                                                    </div>
                                                                    <ul className="space-y-1 pl-4 list-disc text-xs text-heading">
                                                                        {policy.highlights.map((h, i) => (
                                                                            <li key={i}>{h}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Full Content */}
                                                            <div className="space-y-2 text-xs text-muted leading-relaxed">
                                                                {policy.content.map((p, i) => (
                                                                    <p key={i}>{p}</p>
                                                                ))}
                                                            </div>

                                                            {/* Critical Compliance Rules */}
                                                            {policy.criticalRules.length > 0 && (
                                                                <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg space-y-1.5">
                                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                                                        <AlertTriangle size={13} />
                                                                        <span>Mandatory Compliance Rules (Strict Enforcement)</span>
                                                                    </div>
                                                                    <ul className="space-y-1 pl-4 list-disc text-xs text-heading font-medium">
                                                                        {policy.criticalRules.map((rule, i) => (
                                                                            <li key={i}>{rule}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Related System Routes */}
                                                            {policy.relatedForms && policy.relatedForms.length > 0 && (
                                                                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                                                                    <span className="text-[11px] text-muted font-medium">Quick Navigate:</span>
                                                                    {policy.relatedForms.map((rf, idx) => (
                                                                        <Link
                                                                            key={idx}
                                                                            to={rf.route}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-accent transition-colors"
                                                                        >
                                                                            <span>{rf.label}</span>
                                                                            <ExternalLink size={11} />
                                                                        </Link>
                                                                    ))}
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

                    {/* TAB 2: OFFICE SEATING & ESCALATION */}
                    {activeTab === 'SEATING' && (
                        <div className="space-y-8">
                            {/* Section 1: Office Floor Seating Layout */}
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-base font-bold text-heading">Office Workstation Layout (Kathmandu Office)</h2>
                                    <p className="text-xs text-muted mt-0.5">
                                        Fixed table allocations foster peer support, daily desk reviews, and structured mentorship.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {OFFICE_SEATING_TABLES.map((table) => {
                                        const isUserAtThisTable = user?.tableNumber === table.tableNumber;

                                        return (
                                            <div
                                                key={table.tableNumber}
                                                className={`border rounded-xl p-4 flex flex-col justify-between transition-all ${
                                                    isUserAtThisTable
                                                        ? 'bg-accent/5 border-accent/40 shadow-xs'
                                                        : 'bg-secondary/40 border-border hover:border-border-mid'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                                            Table {table.tableNumber}
                                                        </span>
                                                        {isUserAtThisTable && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent">
                                                                Your Desk
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-bold text-heading mt-1">{table.tableName}</h3>
                                                    <p className="text-xs text-muted mt-1">{table.description}</p>
                                                    <div className="mt-2 py-1 px-2 rounded-md bg-surface/60 border border-border text-[11px] font-medium text-heading">
                                                        <span className="text-muted">Table Lead:</span> {table.tableLeaderRole}
                                                    </div>
                                                </div>

                                                {/* Seats Grid */}
                                                <div className="mt-4 pt-3 border-t border-border space-y-2">
                                                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Assigned Seats</div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {table.seats.map((seat) => {
                                                            const isMySeat = isUserAtThisTable && user?.seatNumber === seat.seatNumber;
                                                            return (
                                                                <div
                                                                    key={seat.seatNumber}
                                                                    className={`p-2 rounded-lg border text-left transition-all ${
                                                                        isMySeat
                                                                            ? 'bg-accent/20 border-accent text-accent font-bold'
                                                                            : seat.isTableLeader
                                                                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                                                                                : 'bg-surface/80 border-border text-heading'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between text-[10px]">
                                                                        <span className="font-bold">Seat #{seat.seatNumber}</span>
                                                                        {seat.isTableLeader && <span className="text-[9px] uppercase font-bold text-purple-400">Lead</span>}
                                                                    </div>
                                                                    <div className="text-xs font-semibold mt-0.5 truncate">{seat.title}</div>
                                                                    <div className="text-[10px] text-muted truncate">{seat.role}</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 2: Issue Escalation Ladder */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <div>
                                    <h2 className="text-base font-bold text-heading">Standard 5-Step Escalation Protocol</h2>
                                    <p className="text-xs text-muted mt-0.5">
                                        Follow this sequence when facing client accounting disputes, audit blockers, technical interpretation deadlocks, or personal leave emergencies.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                    {ISSUE_ESCALATION_LADDER.map((step) => (
                                        <div
                                            key={step.level}
                                            className="bg-secondary/40 border border-border hover:border-accent/30 rounded-xl p-4 flex flex-col justify-between transition-all"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                                                        {step.level}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                                                        SLA: {step.sla}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold text-heading mt-2.5">{step.role}</h4>
                                                <p className="text-[11px] text-muted mt-1 leading-snug">{step.scope}</p>
                                            </div>
                                            <div className="mt-3 pt-2.5 border-t border-border/60 text-[10px] text-muted font-medium">
                                                <span className="font-semibold text-heading">Protocol:</span> {step.contactNote}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: ORGANIZATIONAL HIERARCHY */}
                    {activeTab === 'STRUCTURE' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-base font-bold text-heading">Firm Governance & Practice Hierarchy</h2>
                                <p className="text-xs text-muted mt-0.5">
                                    Segregation of duties, reporting lines, and accountability across R. Sapkota & Associates.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {ORG_STRUCTURE_ROLES.map((role) => (
                                    <div
                                        key={role.id}
                                        className="bg-secondary/40 border border-border hover:border-border-mid rounded-xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all"
                                    >
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent border border-accent/20">
                                                    {role.level}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-muted">
                                                    {role.department}
                                                </span>
                                                <span className="text-xs text-muted font-medium">
                                                    Reports to: <strong className="text-heading">{role.reportingTo}</strong>
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-bold text-heading mt-2">{role.title}</h3>

                                            <div className="mt-3 space-y-1">
                                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Core Responsibilities</span>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-1">
                                                    {role.responsibilities.map((resp, idx) => (
                                                        <li key={idx} className="flex items-start gap-1.5 text-xs text-heading">
                                                            <ChevronRight size={13} className="text-accent flex-shrink-0 mt-0.5" />
                                                            <span>{resp}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PolicyPage;
