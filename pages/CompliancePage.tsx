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
            TAX: 'text-amber-400 bg-amber-500/20',
            AUDIT: 'text-purple-400 bg-purple-500/20',
            REGULATORY: 'text-orange-400 bg-orange-500/20',
            INTERNAL: 'text-gray-400 bg-gray-500/20',
        };
        return colors[category as keyof typeof colors] || 'text-gray-400 bg-gray-500/20';
    };

    const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.MANAGER;

    // VAT Filing Restriction & Countdown Logic
    const npNow = new NepaliDate();
    const currentNPDay = npNow.getDate();
    const isSyncDay = currentNPDay === 25;

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
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CalIcon className="text-amber-400" />
                        Compliance Calendar
                    </h1>
                    <p className="text-sm text-gray-400">Track statutory deadlines, tax filings, and audit schedules.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <button
                            onClick={syncCompliance}
                            disabled={isSyncing || !isSyncDay}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${isSyncing || !isSyncDay ? 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed' : 'bg-brand-500/10 text-brand-400 border-brand-500/20 hover:bg-brand-500/20'}`}
                        >
                            {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                            Sync Compliance
                        </button>
                        {!isSyncDay && (
                            <span className="text-[9px] text-amber-500/60 font-bold mt-1 uppercase tracking-tighter">Available on 25th BS Only</span>
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
                            className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-700 shadow-lg flex items-center transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={16} className="mr-2" /> Add Event
                        </button>
                    )}
                </div>
            </div>

            {/* VAT Filing Countdown Panel */}
            <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-emerald-500 relative overflow-hidden bg-gradient-to-r from-emerald-900/20 to-navy-900/40">
                <div className="absolute right-0 top-0 opacity-10">
                    <ShieldCheck size={180} className="text-white" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                                VAT Filing Deadline
                            </span>
                            <span className="text-gray-400 text-xs font-medium">Monthly Requirement</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">Monthly VAT Submission</h3>
                        <p className="text-gray-300 text-lg">
                            Due Date: <span className="text-white font-semibold">{vatDeadline.bsStr}</span>
                        </p>
                    </div>

                    <div className="flex gap-4">
                        {(() => {
                            const diff = vatDeadline.ad.getTime() - new Date().getTime();
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                            return [
                                { val: days, label: 'Days' },
                                { val: hours, label: 'Hours' },
                                { val: mins, label: 'Mins' }
                            ].map((item, idx) => (
                                <div key={idx} className="text-center group">
                                    <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-1 group-hover:scale-110 transition-transform duration-300">
                                        {Math.max(0, item.val)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest">{item.label}</div>
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
                    <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-brand-500 relative overflow-hidden bg-gradient-to-r from-brand-900/40 to-navy-900/40">
                        <div className="absolute right-0 top-0 opacity-10">
                            <CalIcon size={180} className="text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                                        Next Deadline
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(nearestEvent.category)}`}>
                                        {nearestEvent.category}
                                    </span>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-2">{nearestEvent.title}</h3>
                                <p className="text-gray-300 text-lg">
                                    Due: <span className="text-white font-semibold">{formatDateWithBS(nearestEvent.dueDate)}</span>
                                </p>
                            </div>

                            <div className="flex gap-4">
                                {[{ val: days, label: 'Days' }, { val: hours, label: 'Hours' }, { val: minutes, label: 'Mins' }].map((item, idx) => (
                                    <div key={idx} className="text-center group">
                                        <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-1 group-hover:scale-110 transition-transform duration-300">
                                            {Math.max(0, item.val)}
                                        </div>
                                        <div className="text-[10px] uppercase font-bold text-brand-400 tracking-widest">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Client Statutory Compliance Section */}
            {canEdit && (
                <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-navy-900/40 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Client Statutory Status</h2>
                                <p className="text-xs text-gray-500">Track VAT and Income Tax filing obligations.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search client name, PAN or code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                />
                            </div>
                            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                                {(['ALL', 'VAT', 'ITR'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setStatutoryFilter(t)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${statutoryFilter === t ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredClients.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredClients.map((client) => (
                                    <div key={client.id} className="glass-card p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-amber-400 font-bold text-xs">
                                                    {client.code?.substring(0, 3) || 'CL'}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h4 className="font-bold text-white text-xs group-hover:text-brand-300 transition-colors uppercase truncate">{client.name}</h4>
                                                    <p className="text-[10px] text-gray-500 font-medium truncate">PAN: {client.pan || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {client.vatReturn && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">VAT</span>
                                                )}
                                                {client.itrReturn && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">ITR</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                    <div className="w-5 h-5 shrink-0 rounded-full bg-navy-800 flex items-center justify-center text-[7px] font-bold text-gray-300 uppercase">
                                                        {staffList.find(s => s.uid === client.auditorId)?.displayName?.substring(0, 2) || '??'}
                                                    </div>
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
                                                        className="bg-transparent text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer outline-none w-full truncate appearance-none"
                                                    >
                                                        <option value="" className="bg-navy-900 text-gray-400">Unassigned Focal</option>
                                                        {staffList.map(staff => (
                                                            <option key={staff.uid} value={staff.uid} className="bg-navy-900 text-white">
                                                                {staff.displayName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        toast(`Viewing tasks for ${client.name}`, { icon: '🔍', duration: 1000 });
                                                    }}
                                                    className="text-[9px] font-bold text-brand-400 hover:text-brand-300 transition-colors shrink-0 ml-2"
                                                >
                                                    VIEW TASKS
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
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
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Upcoming', count: upcomingCount, icon: CalIcon, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Due Soon', count: dueSoonCount, icon: Bell, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Overdue', count: overdueCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: 'Completed', count: events.filter(e => e.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
                ].map((stat, idx) => (
                    <div key={idx} className="glass-card p-5 rounded-xl flex items-center justify-between group hover:border-brand-500/30 transition-all">
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{stat.label}</p>
                            <h3 className={`text-3xl font-bold mt-1 ${stat.color} group-hover:scale-105 transition-transform`}>{stat.count}</h3>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                            <stat.icon size={24} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="glass-panel p-2 rounded-xl flex overflow-x-auto gap-2">
                {['ALL', 'UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filter === f
                            ? 'bg-amber-600 text-white shadow-lg shadow-blue-900/20'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
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
                        className="glass-panel p-6 rounded-xl hover:border-brand-500/30 transition-all group relative overflow-hidden"
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-white/10 to-transparent group-hover:from-brand-500 group-hover:to-brand-600 transition-colors"></div>
                        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <h3 className="text-lg font-bold text-white">{event.title}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(event.category)}`}>
                                        {event.category}
                                    </span>
                                    {event.priority === 'CRITICAL' && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                                            <AlertTriangle size={10} /> CRITICAL
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm mb-3 max-w-2xl">{event.description}</p>
                                <div className="flex items-center gap-6 text-xs text-gray-500 font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <CalIcon size={14} className="text-brand-400" />
                                        Due: <span className="text-gray-300">{formatDateWithBS(event.dueDate)}</span>
                                    </span>
                                    {event.clientName && (
                                        <span className="flex items-center gap-1.5">
                                            <Filter size={14} className="text-purple-400" />
                                            Client: <span className="text-gray-300">{event.clientName}</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {event.status !== 'COMPLETED' && (
                                    <button
                                        onClick={() => handleComplete(event.id)}
                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-500/20 transition-all flex items-center gap-2"
                                    >
                                        <CheckCircle size={16} /> Mark Complete
                                    </button>
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

            {/* Create/Edit Modal - Premium Style */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl relative overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-amber-900/50 to-amber-900/50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingId ? <Filter size={20} className="text-amber-400" /> : <Plus size={20} className="text-amber-400" />}
                                {editingId ? 'Edit Event' : 'New Compliance Event'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/20 hover:text-white transition-all">
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Title <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                    value={newEvent.title}
                                    placeholder="e.g. Q3 VAT Return"
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            value={newEvent.category}
                                            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                                        >
                                            <option value="TAX">Tax</option>
                                            <option value="AUDIT">Audit</option>
                                            <option value="REGULATORY">Regulatory</option>
                                            <option value="INTERNAL">Internal</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                                            <Filter size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            value={newEvent.priority}
                                            onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                                            <AlertTriangle size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date <span className="text-red-400">*</span></label>
                                    <button
                                        type="button"
                                        onClick={() => setUseNepali(!useNepali)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${useNepali ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-400'}`}
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
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                        value={newEvent.dueDate}
                                        onChange={(e) => setNewEvent({ ...newEvent, dueDate: e.target.value })}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                                <textarea
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none"
                                    rows={3}
                                    placeholder="Add notes or required documents..."
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleSaveEvent}
                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 mt-4"
                            >
                                <CheckCircle size={20} />
                                {editingId ? 'Save Changes' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompliancePage;
