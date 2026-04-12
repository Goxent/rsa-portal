import React, { useState, useEffect } from 'react';
import {
    Calendar as CalIcon,
    RefreshCw,
    Plus,
    Zap,
    Bell,
    AlertTriangle,
    CheckCircle,
    Filter,
    ShieldCheck,
    Search
} from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { ComplianceEvent } from '../types/advanced';
import { ComplianceService } from '../services/advanced';
import { Client, UserProfile, TaskStatus, TaskPriority, Task, UserRole } from '../types';
import { AuthService } from '../services/firebase';
import { nepaliMonths } from '../utils/nepaliDate';
import { toast } from 'react-hot-toast';
import NepaliDate from 'nepali-date-converter';

const formatDateWithBS = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const np = new NepaliDate(date);
    return `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} (BS: ${np.getYear()}-${np.getMonth() + 1}-${np.getDate()})`;
};

const CompliancePage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const [events, setEvents] = useState<ComplianceEvent[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [useNepali, setUseNepali] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statutoryFilter, setStatutoryFilter] = useState<'ALL' | 'VAT' | 'ITR'>('ALL');
    const [activeTab, setActiveTab] = useState<'calendar' | 'clients'>('calendar');
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        category: 'TAX',
        dueDate: '',
        priority: 'MEDIUM',
    });

    useEffect(() => {
        if (user) {
            loadEvents();
            loadExtraData();
        }
    }, [user]);

    const loadEvents = async () => {
        const data = await ComplianceService.getEvents();
        setEvents(data);
    };

    const loadExtraData = async () => {
        try {
            const [clientsData, staffData] = await Promise.all([
                AuthService.getAllClients(),
                AuthService.getAllStaff()
            ]);
            setClients(clientsData);
            setStaffList(staffData);
        } catch (error) {
            console.error('Failed to load extra data:', error);
        }
    };

    const handleSaveEvent = async () => {
        if (!user || !newEvent.title || !newEvent.dueDate) return;

        const eventData = {
            ...newEvent,
            category: newEvent.category as ComplianceEvent['category'],
            priority: newEvent.priority as ComplianceEvent['priority'],
        };

        if (editingId) {
            await ComplianceService.updateEvent(editingId, eventData);
        } else {
            await ComplianceService.createEvent({
                ...eventData,
                status: 'UPCOMING',
                assignedTo: [user.uid],
                isRecurring: false,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
            });
        }

        setNewEvent({
            title: '',
            description: '',
            category: 'TAX',
            dueDate: '',
            priority: 'MEDIUM',
        });
        setEditingId(null);
        setIsModalOpen(false);
        await loadEvents();
    };

    const handleEdit = (event: ComplianceEvent) => {
        setNewEvent({
            title: event.title,
            description: event.description || '',
            category: event.category,
            dueDate: event.dueDate,
            priority: event.priority,
        });
        setEditingId(event.id);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        openModal('CONFIRMATION', {
            title: 'Delete Compliance Event',
            message: 'Are you sure you want to delete this compliance event? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                await ComplianceService.deleteEvent(id);
                await loadEvents();
            }
        });
    };

    const handleComplete = async (id: string) => {
        await ComplianceService.completeEvent(id);
        await loadEvents();
    };

    const syncCompliance = async () => {
        if (!user || isSyncing) return;
        setIsSyncing(true);

        try {
            const npNow = new NepaliDate();
            const year = npNow.getYear();
            const monthIdx = npNow.getMonth(); // 0-11
            const day = npNow.getDate();

            const monthNames = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

            const targetMonthName = monthIdx === 0 ? monthNames[11] : monthNames[monthIdx - 1];
            const targetYear = monthIdx === 0 ? year - 1 : year;
            const periodLabel = `${targetMonthName} ${targetYear}`;

            const vatClients = clients.filter(c => c.vatReturn);
            const existingTasks = await AuthService.getAllTasks();

            let createdCount = 0;

            for (const client of vatClients) {
                const taskTitle = `VAT Return Filing - ${periodLabel} - ${client.name}`;

                const alreadyExists = existingTasks.find(t => t.title === taskTitle);

                if (!alreadyExists) {
                    const auditorId = client.auditorId || user.uid;
                    const auditorName = staffList.find(s => s.uid === auditorId)?.displayName || 'Focal Person';

                    const newTask: Task = {
                        id: `t_vac_${Date.now()}_${client.id}`,
                        title: taskTitle,
                        description: `Statutory VAT return filing for ${client.name} for the month of ${periodLabel}. Due by 25th ${monthNames[monthIdx]} ${year}.`,
                        status: TaskStatus.NOT_STARTED,
                        priority: TaskPriority.HIGH,
                        dueDate: new Date().toISOString().split('T')[0], // ASAP
                        assignedTo: [auditorId],
                        assignedToNames: [auditorName],
                        clientIds: [client.id],
                        clientName: client.name,
                        createdAt: new Date().toISOString(),
                        createdBy: 'system',
                        subtasks: [
                            { id: '1', title: 'Collect Invoices/Sales Register', isCompleted: false, createdAt: new Date().toISOString(), createdBy: 'system' },
                            { id: '2', title: 'Prepare VAT Return', isCompleted: false, createdAt: new Date().toISOString(), createdBy: 'system' },
                            { id: '3', title: 'Client Approval', isCompleted: false, createdAt: new Date().toISOString(), createdBy: 'system' },
                            { id: '4', title: 'File on IRD Portal', isCompleted: false, createdAt: new Date().toISOString(), createdBy: 'system' }
                        ]
                    };

                    await AuthService.saveTask(newTask, true);
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                toast.success(`Created ${createdCount} automated compliance tasks!`);
            } else {
                toast.success('Compliance tasks are already up-to-date.');
            }
        } catch (error) {
            console.error('Compliance sync failed:', error);
            toast.error('Failed to sync compliance tasks');
        } finally {
            setIsSyncing(false);
        }
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
            TAX: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
            AUDIT: 'text-indigo-400 bg-indigo-500/10',
            REGULATORY: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20',
            INTERNAL: 'text-[var(--muted)] bg-[var(--bg-surface)] border-[var(--border)]',
        };
        return colors[category as keyof typeof colors] || 'text-[var(--muted)] bg-[var(--bg-surface)]';
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'COMPLETED': // Compliant
                return { color: 'var(--accent)', background: 'rgba(101,154,43,0.1)' };
            case 'DUE_SOON': // At risk
                return { color: 'var(--color-warning)', background: 'rgba(201,138,42,0.1)' };
            case 'OVERDUE': // Non-compliant
                return { color: 'var(--color-danger)', background: 'rgba(196,68,90,0.1)' };
            default: // Pending / Upcoming
                return { color: 'var(--color-info)', background: 'rgba(61,130,201,0.1)' };
        }
    };

    const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER || user?.complianceCreationAuthorized;

    // VAT Filing Restriction & Countdown Logic
    const npNow = new NepaliDate();
    const currentNPDay = npNow.getDate();
    const isSyncDay = currentNPDay === 24 || currentNPDay === 25;

    const getNextVatDeadline = () => {
        const now = new NepaliDate();
        let year = now.getYear();
        let month = now.getMonth();
        let day = 25;

        if (now.getDate() > 25) {
            if (month === 11) {
                month = 0;
                year++;
            } else {
                month++;
            }
        }

        const deadline = new NepaliDate(year, month, day);
        const adDate = deadline.toJsDate();
        return {
            ad: adDate,
            bsStr: `${day} ${nepaliMonths[month]} ${year}`
        };
    };

    const vatDeadline = getNextVatDeadline();

    const filteredClients = clients.filter(c => (c.vatReturn || c.itrReturn)).filter(c => {
        const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.pan?.includes(searchTerm) ||
            c.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = statutoryFilter === 'ALL' ||
            (statutoryFilter === 'VAT' && c.vatReturn) ||
            (statutoryFilter === 'ITR' && c.itrReturn);
        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-full p-4 md:p-6 bg-transparent">
            <div className="space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border)] pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--heading)] flex items-center gap-2">
                        <CalIcon className="text-[var(--accent)]" />
                        Compliance Calendar
                    </h1>
                    <p className="text-sm text-[var(--muted)]">Track statutory deadlines, tax filings, and audit schedules.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <button
                            onClick={syncCompliance}
                            disabled={isSyncing || !isSyncDay}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-bold transition-all border ${
                                isSyncing || !isSyncDay 
                                    ? 'bg-[var(--bg-secondary)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed' 
                                    : 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/20'
                            }`}
                        >
                            {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                            Sync Compliance
                        </button>
                        {!isSyncDay && (
                            <span className="text-[9px] text-[var(--color-warning)] font-bold mt-1 uppercase tracking-tighter">Available on 24th & 25th BS Only</span>
                        )}
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setNewEvent({
                                    title: '',
                                    description: '',
                                    category: 'TAX',
                                    dueDate: '',
                                    priority: 'MEDIUM',
                                });
                                setIsModalOpen(true);
                            }}
                            className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-bold hover:brightness-110 shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={16} className="mr-2" /> Add Event
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-[var(--radius-md)] border border-[var(--border)] w-fit">
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`px-4 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${activeTab === 'calendar' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:text-[var(--text-main)]'}`}
                >
                    Calendar & Events
                </button>
                {canEdit && (
                    <button
                        onClick={() => setActiveTab('clients')}
                        className={`px-4 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${activeTab === 'clients' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:text-[var(--text-main)]'}`}
                    >
                        Client Statutory Status
                    </button>
                )}
            </div>

            {/* Main Content */}
            {activeTab === 'calendar' ? (
                <>
                    {/* VAT Filing Countdown Panel */}
                    <div className="p-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                                        VAT Filing Deadline
                                    </span>
                                    <span className="text-[var(--muted)] text-xs font-medium">Monthly Requirement</span>
                                </div>
                                <h3 className="text-3xl font-bold text-[var(--heading)] mb-2">Monthly VAT Submission</h3>
                                <p className="text-[var(--muted)] text-lg">
                                    Due Date: <span className="text-[var(--heading)] font-semibold">{vatDeadline.bsStr}</span>
                                </p>
                            </div>

                            <div className="flex gap-4">
                                {(() => {
                                    const diff = vatDeadline.ad.getTime() - new Date().getTime();
                                    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
                                    const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
                                    const mins = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));

                                    const getColorForDays = (d: number) => {
                                        if (d > 30) return 'var(--accent)';
                                        if (d >= 7) return 'var(--color-warning)';
                                        return 'var(--color-danger)';
                                    };

                                    return [
                                        { val: days, label: 'Days' },
                                        { val: hours, label: 'Hours' },
                                        { val: mins, label: 'Mins' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="text-center group min-w-[80px]">
                                            <div 
                                                className="text-4xl md:text-5xl font-bold mb-1 group-hover:scale-110 transition-transform duration-300"
                                                style={{ 
                                                    color: idx === 0 ? getColorForDays(days) : 'var(--heading)',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {item.val}
                                            </div>
                                            <div className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest">{item.label}</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Next Deadline Timer (Other Compliance Events) */}
                    {(() => {
                        const upcomingEvents = events.filter(e => e.status === 'UPCOMING' || e.status === 'DUE_SOON');
                        if (upcomingEvents.length === 0) return null;

                        const nearestEvent = upcomingEvents.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                        const dueDate = new Date(nearestEvent.dueDate);
                        const now = new Date();
                        const diffTime = dueDate.getTime() - now.getTime();

                        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

                        return (
                            <div className="p-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] relative overflow-hidden">
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                                                Next Deadline
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(nearestEvent.category)}`}>
                                                {nearestEvent.category}
                                            </span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-[var(--heading)] mb-2">{nearestEvent.title}</h3>
                                        <p className="text-[var(--muted)] text-lg">
                                            Due: <span className="text-[var(--heading)] font-semibold">{formatDateWithBS(nearestEvent.dueDate)}</span>
                                        </p>
                                    </div>

                                    <div className="flex gap-4">
                                        {(() => {
                                            const getColorForDays = (d: number) => {
                                                if (d > 30) return 'var(--accent)';
                                                if (d >= 7) return 'var(--color-warning)';
                                                return 'var(--color-danger)';
                                            };
                                            return [{ val: days, label: 'Days' }, { val: hours, label: 'Hours' }, { val: minutes, label: 'Mins' }].map((item, idx) => (
                                                <div key={idx} className="text-center group min-w-[80px]">
                                                    <div 
                                                        className="text-4xl md:text-5xl font-bold mb-1 group-hover:scale-110 transition-transform duration-300"
                                                        style={{ 
                                                            color: idx === 0 ? getColorForDays(days) : 'var(--heading)',
                                                            fontVariantNumeric: 'tabular-nums'
                                                        }}
                                                    >
                                                        {Math.max(0, item.val)}
                                                    </div>
                                                    <div className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest">{item.label}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Upcoming', count: upcomingCount, icon: CalIcon, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
                            { label: 'Due Soon', count: dueSoonCount, icon: Bell, color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning)]/10' },
                            { label: 'Overdue', count: overdueCount, icon: AlertTriangle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/10' },
                            { label: 'Completed', count: events.filter(e => e.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-[var(--bg-secondary)] border border-[var(--border)] p-5 rounded-[var(--radius-md)] flex items-center justify-between group hover:border-[var(--accent)]/30 hover:bg-[var(--bg-surface)] transition-all">
                                <div>
                                    <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider">{stat.label}</p>
                                    <h3 className={`text-3xl font-bold mt-1 ${stat.color} group-hover:scale-105 transition-transform`}>{stat.count}</h3>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={24} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded-[var(--radius-md)] flex overflow-x-auto gap-2">
                        {['ALL', 'UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all whitespace-nowrap ${filter === f
                                    ? 'bg-[var(--accent)] text-white shadow-lg'
                                    : 'text-[var(--muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
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
                                className="bg-[var(--bg-secondary)] border border-[var(--border)] p-[0.875rem_1rem] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface)] transition-all group relative overflow-hidden"
                            >
                                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <h3 className="text-lg font-bold text-[var(--heading)]">{event.title}</h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(event.category)}`}>
                                                {event.category}
                                            </span>
                                            {event.priority === 'CRITICAL' && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20">
                                                    <AlertTriangle size={10} /> CRITICAL
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[var(--muted)] text-sm mb-3 max-w-2xl">{event.description}</p>
                                        <div className="flex items-center gap-6 text-xs text-[var(--muted)] font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <CalIcon size={14} className="text-[var(--accent)]" />
                                                Due: <span className="text-[var(--muted)]">{formatDateWithBS(event.dueDate)}</span>
                                            </span>
                                            {event.clientName && (
                                                <span className="flex items-center gap-1.5">
                                                    <Filter size={14} className="text-indigo-400" />
                                                    Client: <span className="text-[var(--muted)]">{event.clientName}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {event.status !== 'COMPLETED' && (
                                            <>
                                                <button
                                                    onClick={async () => {
                                                        if (!user) return;
                                                        const taskTitle = `Compliance: ${event.title}`;
                                                        const existingTasks = await AuthService.getAllTasks();
                                                        if (existingTasks.some(t => t.title === taskTitle)) {
                                                            toast.error('Task already exists for this event');
                                                            return;
                                                        }
                                                        const newTask: Task = {
                                                            id: `t_evt_${Date.now()}`,
                                                            title: taskTitle,
                                                            description: event.description || `Ensure compliance for ${event.title}.`,
                                                            status: TaskStatus.NOT_STARTED,
                                                            priority: event.priority as TaskPriority || TaskPriority.MEDIUM,
                                                            dueDate: event.dueDate,
                                                            assignedTo: [user.uid],
                                                            assignedToNames: [user.displayName || ''],
                                                            createdAt: new Date().toISOString(),
                                                            createdBy: user.uid,
                                                            subtasks: []
                                                        };
                                                        await AuthService.saveTask(newTask, true);
                                                        toast.success('Task created successfully from this event!');
                                                    }}
                                                    className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 px-4 py-2 rounded-lg text-sm font-medium border border-brand-500/20 transition-all flex items-center gap-2"
                                                >
                                                    <Plus size={16} /> Create Task
                                                </button>
                                                <button
                                                    onClick={() => handleComplete(event.id)}
                                                    className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 px-4 py-2 rounded-lg text-sm font-medium border border-brand-500/20 transition-all flex items-center gap-2"
                                                >
                                                    <CheckCircle size={16} /> Mark Complete
                                                </button>
                                            </>
                                        )}
                                        {canEdit && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(event)}
                                                    className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(event.id)}
                                                    className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredEvents.length === 0 && (
                            <div className="glass-panel p-16 rounded-xl">
                                <EmptyState
                                    icon={CalIcon}
                                    title="No events found"
                                    description="Try adjusting your filters or create a new event."
                                    className="p-0"
                                />
                            </div>
                        )}
                    </div>
                </>
            ) : canEdit ? (
                <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] p-6 bg-[var(--bg-surface)]/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--heading)]">Client Statutory Status</h2>
                                <p className="text-xs text-[var(--muted)]">Track VAT and Income Tax filing obligations.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search client name, PAN or code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] pl-9 pr-4 py-2 text-sm text-[var(--text-main)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                                />
                            </div>
                            <div className="flex bg-[var(--bg-secondary)] rounded-[var(--radius-md)] p-1 border border-[var(--border)] shrink-0">
                                {(['ALL', 'VAT', 'ITR'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setStatutoryFilter(t)}
                                        className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-bold transition-all ${statutoryFilter === t ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:text-[var(--text-main)]'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--text-main)]">
                            <thead>
                                <tr className="text-[var(--muted)] border-b border-[var(--border)] uppercase text-[10px] tracking-wider bg-[var(--bg-secondary)] font-black">
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">PAN / Code</th>
                                    <th className="px-6 py-4">Focal Person</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-[var(--bg-surface)] transition-colors">
                                        <td className="px-6 py-4 font-bold text-[var(--heading)] uppercase text-xs">{client.name}</td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="flex gap-1 items-center font-mono">
                                                <span className="text-[var(--muted)] font-bold uppercase text-[10px]">PAN:</span>
                                                <span className="text-[var(--text-main)] font-semibold">{client.pan || 'N/A'}</span>
                                            </div>
                                            <div className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-1 py-0.5 rounded w-fit mt-1 uppercase font-bold tracking-wider">{client.code || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={client.auditorId || ''}
                                                onChange={async (e) => {
                                                    const newAuditorId = e.target.value;
                                                    try {
                                                        await AuthService.updateClient({ ...client, auditorId: newAuditorId });
                                                        setClients(clients.map(c => c.id === client.id ? { ...c, auditorId: newAuditorId } : c));
                                                        toast.success(`Assigned ${staffList.find(s => s.uid === newAuditorId)?.displayName || 'Focal Person'} to ${client.name}`);
                                                    } catch (error) {
                                                        toast.error('Failed to update assignee');
                                                    }
                                                }}
                                                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--accent)] cursor-pointer outline-none w-full max-w-[200px]"
                                            >
                                                <option value="" className="text-[var(--muted)]">Unassigned Focal</option>
                                                {staffList.map(staff => (
                                                    <option key={staff.uid} value={staff.uid}>{staff.displayName}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {client.vatReturn && <span className="text-[10px] font-black px-2 py-1 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">VAT Return</span>}
                                                {client.itrReturn && <span className="text-[10px] font-black px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">ITR Return</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toast(`Viewing tasks for ${client.name}`, { icon: '🔍' })}
                                                className="text-[10px] font-bold bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] text-[var(--text-main)] px-4 py-2 rounded-[var(--radius-md)] transition-colors border border-[var(--border)]"
                                            >
                                                VIEW TASKS
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredClients.length === 0 && (
                            <EmptyState
                                icon={ShieldCheck}
                                title="No clients found"
                                description="No clients match your search or filters."
                                className="py-12"
                                iconSize={40}
                            />
                        )}
                    </div>
                </div>
            ) : null}

            {/* Create/Edit Modal - Premium Style */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] w-full max-w-lg border border-[var(--border)] shadow-2xl relative overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[var(--heading)] flex items-center gap-2">
                                {editingId ? <Filter size={20} className="text-[var(--accent)]" /> : <Plus size={20} className="text-[var(--accent)]" />}
                                {editingId ? 'Edit Event' : 'New Compliance Event'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)] transition-all">
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Title <span className="text-[var(--color-danger)]">*</span></label>
                                <input
                                    type="text"
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-main)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all"
                                    value={newEvent.title}
                                    placeholder="e.g. Q3 VAT Return"
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                />
                            </div>                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Category</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-main)] appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all font-semibold"
                                            value={newEvent.category}
                                            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                                        >
                                            <option value="TAX">Tax</option>
                                            <option value="AUDIT">Audit</option>
                                            <option value="REGULATORY">Regulatory</option>
                                            <option value="INTERNAL">Internal</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-[var(--muted)]">
                                            <Filter size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Priority</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-main)] appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all font-semibold"
                                            value={newEvent.priority}
                                            onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-[var(--muted)]">
                                            <AlertTriangle size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Due Date <span className="text-[var(--color-danger)]">*</span></label>
                                    <button
                                        type="button"
                                        onClick={() => setUseNepali(!useNepali)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${useNepali ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--muted)]'}`}
                                    >
                                        {useNepali ? 'SWITCH TO AD' : 'SWITCH TO BS (NEPALI)'}
                                    </button>
                                </div>
                                {useNepali ? (
                                    <NepaliDatePicker
                                        value={newEvent.dueDate}
                                        onChange={(ad) => setNewEvent({ ...newEvent, dueDate: ad })}
                                        className="w-full"
                                    />
                                ) : (
                                    <input
                                        type="date"
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all"
                                        value={newEvent.dueDate}
                                        onChange={(e) => setNewEvent({ ...newEvent, dueDate: e.target.value })}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Description</label>
                                <textarea
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-main)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all resize-none"
                                    rows={3}
                                    placeholder="Add notes or required documents..."
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleSaveEvent}
                                className="w-full bg-[var(--accent)] hover:brightness-110 text-white py-4 rounded-[var(--radius-md)] font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                            >
                                <CheckCircle size={20} />
                                {editingId ? 'Save Changes' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};

export default CompliancePage;
