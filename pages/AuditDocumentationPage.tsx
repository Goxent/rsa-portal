import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FolderArchive, FolderOpen, FolderPlus, ChevronRight,
    Trash2, Download, Eye, FileText, BookOpen, Shield,
    FileOutput, Wifi, Lock, RefreshCw, X, Save, Building2,
    CalendarDays, ServerCrash, Loader2, Edit2, Home,
    File, Image, FileSpreadsheet, Monitor, MoreVertical,
    CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,
    List, CheckCircle2, Info, ChevronDown,
    ClipboardCheck, CheckCircle, Clock, AlertTriangle, ShieldCheck, Search, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import {
    AuditDocService,
    AuditDocFile,
    AuditDocFolder,
    formatBytes,
    getMimeLabel,
} from '../services/auditDocs';
import {
    Client,
    UserRole,
    UserProfile,
    AUDIT_FOLDER_STRUCTURE,
    AuditFolderKey,
    Task,
} from '../types';
import { toast } from 'react-hot-toast';
import { useOfficeWifiCheck } from '../hooks/useOfficeWifiCheck';
import { AuditWorkspace, NEPALI_FISCAL_YEARS, NavLevel, WifiGate } from '../components/audit/AuditWorkspace';

// ─── Main Page ────────────────────────────────────────────────────────────────

const AuditDocumentationPage: React.FC = () => {
    const { user } = useAuth();
    const { status: wifiStatus, retry: retryWifi } = useOfficeWifiCheck();

    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedFY, setSelectedFY] = useState(NEPALI_FISCAL_YEARS[0]);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');

    // Navigation stack — each step is a NavLevel
    const [navStack, setNavStack] = useState<NavLevel[]>([{ kind: 'root' }]);

    // View mode — list by default (more file-manager-like)
    const [isGrid, setIsGrid] = useState(false);

    // Aggregate counts for root view and B-folder view
    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});

    const currentLevel = navStack[navStack.length - 1];

    // Staff Permissions & Search (HMR Force Refresh 1.1)
    const [filterText, setFilterText] = useState('');
    const [staffFilter, setStaffFilter] = useState('');
    const [globalClientFilter, setGlobalClientFilter] = useState('');
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [isGlobalAccessModalOpen, setIsGlobalAccessModalOpen] = useState(false);
    const [globalSelectedStaffId, setGlobalSelectedStaffId] = useState<string | null>(null);
    const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
    
    const isReadOnly = user?.role === UserRole.STAFF;

    // Load clients
    useEffect(() => {
        (async () => {
            try {
                const list = await AuthService.getAllClients();
                let filtered = list.filter(c => c.status === 'Active');
                
                // If STAFF, filter by permittedStaff
                if (user?.role === UserRole.STAFF) {
                    filtered = filtered.filter(c => c.permittedStaff?.includes(user.uid));
                }
                
                setClients(filtered);
                // We no longer auto-select the first client here. 
                // The landing grid logic will handle selection via handleClientSelect.
            } catch {
                toast.error('Failed to load clients');
            } finally {
                setLoadingClients(false);
            }
        })();
    }, [user?.uid, user?.role]);

    // Reload aggregate counts when client/FY changes
    useEffect(() => {
        if (!selectedClientId) return;
        // Reset task selection on client/FY change
        setSelectedTaskId('ALL');
        setNavStack([{ kind: 'root' }]);
        
        // Fetch tasks for this client/FY for Engagement Selector
        setLoadingTasks(true);
        AuthService.getAllTasks().then(allTasks => {
            const matching = allTasks.filter(t =>
                (t.clientIds?.includes(selectedClientId) || t.clientId === selectedClientId) &&
                (!t.fiscalYear || t.fiscalYear === selectedFY)
            );
            setClientTasks(matching);
        }).catch(() => { /* silent */ }).finally(() => setLoadingTasks(false));

        (async () => {
            try {
                const [allFiles, allFolders] = await Promise.all([
                    AuditDocService.getAllFiles(selectedClientId, selectedFY, selectedTaskId !== 'ALL' ? selectedTaskId : undefined),
                    // We'll count sub-folders per main folder
                    Promise.all(
                        (['A', 'B', 'C', 'D', 'E'] as AuditFolderKey[]).map(k =>
                            AuditDocService.getFolders(selectedClientId, selectedFY, k)
                        )
                    ),
                ]);
                const fc: Record<string, number> = {};
                allFiles.forEach(f => {
                    // Count per main folder
                    fc[f.folderKey] = (fc[f.folderKey] || 0) + 1;
                    // Count per line item (for B)
                    if (f.lineItem) {
                        const k = `${f.folderKey}-${f.lineItem}`;
                        fc[k] = (fc[k] || 0) + 1;
                    }
                });
                setFileCounts(fc);

                const folderKeys: AuditFolderKey[] = ['A', 'B', 'C', 'D', 'E'];
                const foc: Record<string, number> = {};
                allFolders.forEach((folders, i) => {
                    foc[folderKeys[i]] = folders.length;
                });
                setFolderCounts(foc);
            } catch {
                // silently skip
            }
        })();
    }, [selectedClientId, selectedFY, selectedTaskId]);

    const navigate = (index: number) => {
        setNavStack(prev => prev.slice(0, index + 1));
    };

    const enterMainFolder = (key: AuditFolderKey) => {
        setNavStack(prev => [...prev, { kind: 'main-folder', folderKey: key }]);
    };

    const enterLineItem = (lineItem: string, lineItemLabel: string) => {
        setNavStack(prev => [...prev, { kind: 'line-item', folderKey: 'B', lineItem, lineItemLabel }]);
    };

    const enterSubFolder = (sf: AuditDocFolder) => {
        const parent = currentLevel as ({ kind: 'main-folder'; folderKey: AuditFolderKey } | { kind: 'line-item'; folderKey: 'B'; lineItem: string; lineItemLabel: string });
        setNavStack(prev => [...prev, {
            kind: 'custom-folder',
            folderKey: parent.folderKey,
            lineItem: 'lineItem' in parent ? parent.lineItem : undefined,
            folderId: sf.id,
            folderName: sf.name,
        }]);
    };

    const selectedClient = clients.find(c => c.id === selectedClientId);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setFilterText('');
    };

    // ── Guards ─────────────────────────────────────────────────────────────────

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.STAFF)) {
        return (
            <div className="flex items-center justify-center min-h-full">
                <p style={{ color: 'var(--text-muted)' }}>Access restricted.</p>
            </div>
        );
    }

    if (wifiStatus === 'CHECKING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifying office network…</p>
            </div>
        );
    }
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} />;

    // Staff with no permitted clients
    if (!loadingClients && clients.length === 0 && user?.role === UserRole.STAFF) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
                    style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Lock size={40} style={{ color: '#f59e0b' }} />
                </div>
                <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-heading)' }}>No Client Access Assigned</h2>
                <p className="text-sm max-w-md leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                    You don't have permission to view any client's audit documentation yet.
                </p>
                <p className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Ask your <span className="font-bold" style={{ color: 'var(--text-heading)' }}>Admin</span> to grant you access.
                </p>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    const canGoBack = navStack.length > 1;

    return (
        <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column' }}>

            {/* ── Top bar ── */}
            <div className="shrink-0 px-5 py-3 flex flex-wrap items-center gap-3"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>

                {/* Logo + Title */}
                <div className="flex items-center gap-2.5 mr-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
                        <FolderArchive size={16} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-bold leading-none" style={{ color: 'var(--text-heading)' }}>Audit Documentation</p>
                        <p className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>R. Sapkota & Associates</p>
                    </div>
                </div>

                <div className="w-px h-7 hidden sm:block" style={{ background: 'var(--border)' }} />

                {/* Selected Client Name & Navigation */}
                {selectedClientId ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSelectedClientId(''); setNavStack([{ kind: 'root' }]); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:bg-white/5"
                            style={{ border: '1px solid var(--border)' }}
                        >
                            <ArrowLeft size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Change Client</span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-accent)' }}>
                            <Building2 size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{selectedClient?.name}</span>
                        </div>
                    </div>
                ) : null}

                {/* Permissions (Admin only) */}
                {(user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) && selectedClientId && (
                    <button
                        onClick={async () => {
                            setIsPermissionModalOpen(true);
                            if (allStaff.length === 0) {
                                try {
                                    const staff = await AuthService.getAllStaff();
                                    setAllStaff(staff);
                                } catch { /* silent */ }
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:scale-105 group"
                        title="Manage Staff Access"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                        <Users size={13} className="group-hover:text-amber-400 transition-colors" />
                        <span className="text-[11px] font-semibold hidden md:inline group-hover:text-amber-400 transition-colors">Access</span>
                        {selectedClient?.permittedStaff && selectedClient.permittedStaff.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center"
                                style={{ boxShadow: '0 0 0 2px var(--bg-elevated)' }}>
                                {selectedClient.permittedStaff.length}
                            </span>
                        )}
                    </button>
                )}

                {/* Read-only badge for Staff */}
                {user.role === UserRole.STAFF && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(59,130,246,0.10)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                        <Eye size={11} /> View Only
                    </div>
                )}

                {/* Fiscal Year & Tasks only shown if client selected */}
                {selectedClientId && (
                    <>
                        {/* Fiscal Year */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <CalendarDays size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <select
                                value={selectedFY}
                                onChange={e => setSelectedFY(e.target.value)}
                                className="text-sm font-semibold outline-none bg-transparent cursor-pointer"
                                style={{ color: 'var(--text-heading)' }}
                            >
                                {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                            </select>
                        </div>

                        {/* Engagement / Task Selector */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <ClipboardCheck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <select
                                value={selectedTaskId}
                                onChange={e => { setSelectedTaskId(e.target.value); setNavStack([{ kind: 'root' }]); }}
                                className="text-sm font-semibold outline-none max-w-[200px] bg-transparent cursor-pointer"
                                style={{ color: 'var(--text-heading)' }}
                                disabled={loadingTasks}
                            >
                                <option value="ALL">All Engagements</option>
                                {clientTasks.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.taskType ? `[${t.taskType}] ` : ''}{t.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                <div className="flex-1" />

                {/* WiFi */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>
                    <Wifi size={12} /> Office
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-2">
                    {/* Global Access Button (Landing Page only) */}
                    {!selectedClientId && (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) && (
                        <button
                            onClick={async () => {
                                setIsGlobalAccessModalOpen(true);
                                if (allStaff.length === 0) {
                                    try {
                                        const staff = await AuthService.getAllStaff();
                                        setAllStaff(staff);
                                    } catch { /* silent */ }
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:bg-amber-500/10 border"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                            <Users size={14} className="text-amber-500" />
                            <span className="text-xs font-bold text-amber-500">Manage Access</span>
                        </button>
                    )}
                    
                    <div className="flex items-center rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--border)' }}>
                        <button onClick={() => setIsGrid(false)}
                            className="p-2 transition-colors"
                            style={{ background: !isGrid ? 'var(--accent-dim)' : 'transparent', color: !isGrid ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <List size={14} />
                        </button>
                        <button onClick={() => setIsGrid(true)}
                            className="p-2 transition-colors"
                            style={{ background: isGrid ? 'var(--accent-dim)' : 'transparent', color: isGrid ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Client Selection Grid (Shown if no client selected) ── */}
            {!selectedClientId ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        
                        {/* Header & Search */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
                                    Select Client
                                </h1>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Choose a client to view or manage their audit documentation.
                                </p>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search clients..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                                    style={{ 
                                        background: 'var(--bg-surface)', 
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-heading)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Client Grid/List */}
                        <div className={isGrid 
                            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                            : "space-y-3 w-full"
                        }>
                            {clients
                                .filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
                                .map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className={`group text-left rounded-2xl transition-all duration-300 active:scale-[0.99] border relative overflow-hidden ${
                                        isGrid ? "p-5 flex flex-col h-full hover:-translate-y-1 hover:shadow-xl" : "p-4 flex items-center gap-6 hover:bg-white/[0.03] hover:border-white/10"
                                    }`}
                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: isGrid ? 'radial-gradient(circle at 50% 0%, var(--accent-dim) 0%, transparent 70%)' : 'linear-gradient(to right, var(--accent-dim), transparent)' }} />
                                    
                                    <div className={`relative z-10 flex gap-4 ${isGrid ? "flex-col h-full" : "items-center flex-1"}`}>
                                        <div className={`${isGrid ? "w-12 h-12" : "w-14 h-14"} rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-3`}
                                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                            <Building2 size={isGrid ? 24 : 28} style={{ color: 'var(--accent)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className={`${isGrid ? "text-base" : "text-lg"} font-bold line-clamp-2 leading-snug`} style={{ color: 'var(--text-heading)' }}>
                                                    {client.name}
                                                </h3>
                                                {!isGrid && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACTIVE</span>}
                                            </div>
                                            {!isGrid && (
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        <FolderOpen size={12} className="text-amber-500" />
                                                        <span>Documentation Repository</span>
                                                    </div>
                                                    {!isReadOnly && (
                                                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <Shield size={12} className="text-brand-500" />
                                                            <span>{client.permittedStaff?.length || 0} Staff with access</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {isGrid ? (
                                            <div className="mt-auto pt-4 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                                <span>View Documents</span>
                                                <ArrowLeft size={14} className="rotate-180 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: 'var(--accent)' }} />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <div className="hidden md:flex flex-col items-end mr-4">
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter">Engagement Vault</p>
                                                    <p className="text-xs font-bold text-white/60">OPEN REPOSITORY</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                                                    <ChevronRight size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {clients.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase())).length === 0 && (
                                <div className="col-span-full py-12 text-center">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No clients found matching "{filterText}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 w-full h-full max-w-7xl mx-auto">
             <AuditWorkspace clientId={selectedClientId} clientName={selectedClient?.name || 'Unknown Client'} />
         </div>
            )}
    {/* ── Client Permission Modal ── */}
            {isPermissionModalOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsPermissionModalOpen(false)}
                    />
                    <div 
                        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', maxHeight: '85vh' }}
                    >
                        <div className="shrink-0 p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--accent-dim)' }}>
                                    <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                                        Client Access
                                    </h2>
                                    <p className="text-[11px] font-semibold mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                                        {selectedClient.name}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsPermissionModalOpen(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <FolderX size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {allStaff.length === 0 ? (
                                <div className="p-10 flex flex-col items-center justify-center text-center">
                                    <Loader2 size={24} className="animate-spin mb-4" style={{ color: 'var(--accent)' }} />
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading staff...</p>
                                </div>
                            ) : (
                                <div className="space-y-1 p-2">
                                    {allStaff.map(staff => {
                                        const isPermitted = selectedClient.permittedStaff?.includes(staff.uid) || false;
                                        return (
                                            <div key={staff.uid} 
                                                className="flex items-center justify-between p-3 rounded-xl transition-all"
                                                style={{ background: isPermitted ? 'var(--bg-surface)' : 'transparent' }}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{staff.displayName || 'Unknown Staff'}</span>
                                                    <span className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{staff.email}</span>
                                                </div>
                                                
                                                <button
                                                    onClick={async () => {
                                                        const current = selectedClient.permittedStaff || [];
                                                        const newPermitted = isPermitted 
                                                            ? current.filter(id => id !== staff.uid)
                                                            : [...current, staff.uid];
                                                            
                                                        try {
                                                            await AuthService.updateClientPermissions(selectedClient.id, newPermitted);
                                                            // update local state
                                                            setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, permittedStaff: newPermitted } : c));
                                                        } catch (error) {
                                                            toast.error('Failed to update permissions');
                                                        }
                                                    }}
                                                    className="shrink-0 w-12 h-6 rounded-full relative transition-colors duration-300"
                                                    style={{ background: isPermitted ? 'var(--accent)' : 'var(--bg-surface)', border: isPermitted ? 'none' : '1px solid var(--border)' }}
                                                >
                                                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300 shadow-sm"
                                                        style={{ left: isPermitted ? 'calc(100% - 20px)' : '4px' }}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Global Staff-wise Access Modal ── */}
            {isGlobalAccessModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-5xl h-full max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
                        style={{ background: 'var(--bg-elevated)' }}>
                        
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                                    <ShieldCheck size={20} className="text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Global Staff Access Manager</h2>
                                    <p className="text-[11px] text-white/50 uppercase tracking-widest font-bold">Manage client permissions staff-wise</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsGlobalAccessModalOpen(false); setGlobalSelectedStaffId(null); }}
                                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Layout */}
                        <div className="flex-1 flex min-h-0">
                            
                            {/* Staff List Sidebar */}
                            <div className="w-72 border-r border-white/5 flex flex-col bg-black/10">
                                <div className="p-4 border-b border-white/5">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input 
                                            type="text"
                                            placeholder="Find staff..."
                                            value={staffFilter}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                                            onChange={(e) => setStaffFilter(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {allStaff
                                        .filter(s => s.displayName?.toLowerCase().includes(staffFilter.toLowerCase()) || s.email?.toLowerCase().includes(staffFilter.toLowerCase()))
                                        .map(s => (
                                        <button
                                            key={s.uid}
                                            onClick={() => setGlobalSelectedStaffId(s.uid)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group ${
                                                globalSelectedStaffId === s.uid 
                                                    ? 'bg-amber-500 text-white shadow-lg' 
                                                    : 'hover:bg-white/5 text-white/60 hover:text-white'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-colors ${
                                                globalSelectedStaffId === s.uid ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/10'
                                            }`}>
                                                {(s.displayName || 'U').charAt(0)}
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-bold truncate">{s.displayName}</p>
                                                <p className={`text-[9px] ${globalSelectedStaffId === s.uid ? 'text-white/70' : 'text-white/30'}`}>
                                                    {s.role || 'Staff'}
                                                </p>
                                            </div>
                                            {globalSelectedStaffId === s.uid && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client Access Content */}
                            <div className="flex-1 flex flex-col min-w-0 bg-black/5">
                                {globalSelectedStaffId ? (
                                    <>
                                        {/* Staff Header */}
                                        <div className="px-8 py-5 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-white">
                                                    Permissions for <span className="text-amber-500">{allStaff.find(s => s.uid === globalSelectedStaffId)?.displayName}</span>
                                                </h3>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        Allowed: {clients.filter(c => c.permittedStaff?.includes(globalSelectedStaffId)).length}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                                        Total: {clients.length}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Client Search within Permission List */}
                                            <div className="relative w-64">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                                <input 
                                                    type="text"
                                                    placeholder="Search clients..."
                                                    value={globalClientFilter}
                                                    onChange={(e) => setGlobalClientFilter(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        {/* Client List */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {clients
                                                    .filter(c => c.name.toLowerCase().includes(globalClientFilter.toLowerCase()))
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(client => {
                                                        const isPermitted = client.permittedStaff?.includes(globalSelectedStaffId);
                                                        const handleToggle = async () => {
                                                            try {
                                                                const updatedIds = isPermitted
                                                                    ? (client.permittedStaff || []).filter(id => id !== globalSelectedStaffId)
                                                                    : [...(client.permittedStaff || []), globalSelectedStaffId];
                                                                
                                                                await AuthService.updateClientPermissions(client.id, updatedIds);
                                                                
                                                                // Local state update
                                                                setClients(prev => prev.map(c => 
                                                                    c.id === client.id ? { ...c, permittedStaff: updatedIds } : c
                                                                ));
                                                                toast.success(`${isPermitted ? 'Removed' : 'Granted'} access to ${client.name}`, {
                                                                    icon: isPermitted ? '🔒' : '🔓',
                                                                    style: { background: '#1e293b', color: '#fff', fontSize: '12px' }
                                                                });
                                                            } catch {
                                                                toast.error('Failed to update permission');
                                                            }
                                                        };

                                                        return (
                                                            <button
                                                                key={client.id}
                                                                onClick={handleToggle}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${
                                                                    isPermitted 
                                                                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                                                                        : 'bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10'
                                                                }`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                                                    isPermitted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'
                                                                }`}>
                                                                    <Building2 size={20} />
                                                                </div>
                                                                <div className="flex-1 text-left min-w-0">
                                                                    <p className={`text-xs font-bold truncate ${isPermitted ? 'text-white' : 'text-white/40'}`}>
                                                                        {client.name}
                                                                    </p>
                                                                    <p className={`text-[9px] font-bold ${isPermitted ? 'text-emerald-500' : 'text-white/20'}`}>
                                                                        {isPermitted ? 'GRANTED' : 'NO ACCESS'}
                                                                    </p>
                                                                </div>
                                                                <div 
                                                                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isPermitted ? 'bg-emerald-500' : 'bg-white/10'}`}
                                                                >
                                                                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all duration-300 shadow-sm ${isPermitted ? 'right-0.75' : 'left-0.75'}`} 
                                                                        style={{ top: '3px' }}
                                                                    />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
                                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                                            <Users size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Select a Staff Member</h3>
                                        <p className="text-xs max-w-xs leading-relaxed">Choose a staff member from the left sidebar to manage their client permissions.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditDocumentationPage;
