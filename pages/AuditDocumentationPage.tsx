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
import { motion, AnimatePresence } from 'framer-motion';
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
    const { status: wifiStatus, retry: retryWifi, publicIp, lastChecked } = useOfficeWifiCheck();

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
    
    // Initialize Workspace Modal
    const [isInitModalOpen, setIsInitModalOpen] = useState(false);
    const [initClientId, setInitClientId] = useState('');
    const [initFY, setInitFY] = useState(NEPALI_FISCAL_YEARS[0]);
    const [savingInit, setSavingInit] = useState(false);
    const [clientSearchText, setClientSearchText] = useState('');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const clientDropdownRef = useRef<HTMLDivElement>(null);
    
    const isReadOnly = user?.role === UserRole.STAFF;
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    // Derive workspace entries: one per (client, FY) pair that has been initialized
    const workspaces = React.useMemo(() => {
        const entries: { client: Client; fy: string }[] = [];
        clients.forEach(client => {
            const years = client.activeAuditYears || [];
            years.forEach(fy => entries.push({ client, fy }));
        });
        return entries;
    }, [clients]);
    
    const filteredWorkspaces = workspaces.filter(w =>
        w.client.name.toLowerCase().includes(filterText.toLowerCase()) ||
        w.fy.toLowerCase().includes(filterText.toLowerCase())
    );

    const handleInitWorkspace = async () => {
        if (!initClientId || !initFY) return;
        const client = clients.find(c => c.id === initClientId);
        if (!client) return;
        const existing = client.activeAuditYears || [];
        if (existing.includes(initFY)) {
            toast.error(`Workspace for ${client.name} / ${initFY} already exists.`);
            return;
        }
        setSavingInit(true);
        try {
            const updated = [...existing, initFY];
            await AuthService.updateClient(initClientId, { activeAuditYears: updated });
            setClients(prev => prev.map(c => c.id === initClientId ? { ...c, activeAuditYears: updated } : c));
            toast.success(`Workspace initialized: ${client.name} / ${initFY}`);
            setIsInitModalOpen(false);
            setClientSearchText('');
            setIsClientDropdownOpen(false);
        } catch (e: any) {
            toast.error(`Failed: ${e.message}`);
        } finally {
            setSavingInit(false);
        }
    };

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

    // Click-outside for client search dropdown
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
                setIsClientDropdownOpen(false);
            }
        };
        if (isClientDropdownOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isClientDropdownOpen]);

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

    const handleClientSelect = (clientId: string, fy: string) => {
        setSelectedClientId(clientId);
        setSelectedFY(fy);
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
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} publicIp={publicIp} />;

    // Staff with no permitted clients
    if (!loadingClients && clients.length === 0 && user?.role === UserRole.STAFF) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <Lock size={36} style={{ color: 'var(--color-warning)' }} />
                </div>
                <h2 className="text-xl font-bold mb-2 font-display" style={{ color: 'var(--text-heading)' }}>No client access assigned</h2>
                <p className="text-sm max-w-md leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                    You don't have permission to view any client's audit documentation yet.
                </p>
                <p className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Ask your <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Admin</span> to grant you access.
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                        >
                            <ArrowLeft size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>Change client</span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                            style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' }}>
                            <Building2 size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{selectedClient?.name}</span>
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors group"
                        title="Manage staff access"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                        <Users size={13} style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-medium hidden md:inline" style={{ color: 'var(--text-heading)' }}>Access</span>
                        {selectedClient?.permittedStaff && selectedClient.permittedStaff.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium tabular-nums"
                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-accent)' }}>
                                {selectedClient.permittedStaff.length}
                            </span>
                        )}
                    </button>
                )}

                {/* Read-only badge for Staff */}
                {user.role === UserRole.STAFF && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(106,163,217,0.10)', color: 'var(--color-info)', border: '1px solid rgba(106,163,217,0.25)' }}>
                        <Eye size={12} /> View only
                    </div>
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
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--accent)' }}
                        >
                            <Users size={14} style={{ color: 'var(--accent)' }} />
                            <span className="text-xs font-medium">Manage access</span>
                        </button>
                    )}
                    
                    <div className="flex items-center rounded-lg overflow-hidden border"
                        style={{ borderColor: 'var(--border)' }}>
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

            {/* ── Workspace Selection Grid (Shown if no client selected) ── */}
            {!selectedClientId ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-heading)' }}>Audit workspaces</h1>
                                <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                    {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? 's' : ''} across {clients.length} client{clients.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search client or year…"
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                        className="pl-9 pr-4 py-2 rounded-lg text-sm transition-colors focus:outline-none w-56"
                                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                                    />
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => { setInitClientId(''); setClientSearchText(''); setIsClientDropdownOpen(false); setIsInitModalOpen(true); }}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                                    >
                                        <FolderPlus size={14} /> New workspace
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Workspace Cards */}
                        {loadingClients ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            </div>
                        ) : filteredWorkspaces.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-dashed"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                    <FolderOpen size={22} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
                                        {filterText ? 'No matches' : 'No workspaces yet'}
                                    </p>
                                    <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                                        {filterText ? 'Try a different search term.' : isAdmin
                                            ? 'Use "New workspace" to create one.'
                                            : 'No workspaces have been set up for you yet.'}
                                    </p>
                                </div>
                            </div>
                        ) : isGrid ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                <AnimatePresence>
                                {filteredWorkspaces.map(({ client, fy }, i) => (
                                    <button
                                        key={`${client.id}-${fy}`}
                                        onClick={() => handleClientSelect(client.id, fy)}
                                        className="group text-left p-4 rounded-xl flex flex-col h-40 relative overflow-hidden border transition-colors"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        <div className="flex items-start justify-between mb-auto">
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center border"
                                                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                                <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded border tabular-nums"
                                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)' }}>
                                                {fy.replace('-', '/')}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold leading-snug mb-1 line-clamp-2" style={{ color: 'var(--text-heading)' }}>
                                                {client.name}
                                            </p>
                                            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                Open workspace <ChevronRight size={12} />
                                            </p>
                                        </div>
                                    </button>
                                ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <AnimatePresence>
                                {filteredWorkspaces.map(({ client, fy }, i) => (
                                    <button
                                        key={`${client.id}-${fy}`}
                                        onClick={() => handleClientSelect(client.id, fy)}
                                        className="group w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border"
                                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                            <Building2 size={15} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
                                                {client.name}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Audit documentation vault</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded border tabular-nums"
                                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)' }}>
                                                {fy.replace('-', '/')}
                                            </span>
                                            {!isReadOnly && (client.permittedStaff?.length ?? 0) > 0 && (
                                                <span className="text-xs hidden md:block tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                    {client.permittedStaff!.length} staff
                                                </span>
                                            )}
                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    </button>
                                ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
) : (
                <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 w-full h-full max-w-7xl mx-auto">
                    <AuditWorkspace clientId={selectedClientId} clientName={selectedClient?.name || 'Unknown Client'} initialFY={selectedFY} />
                </div>
            )}

            {/* ── Initialize Workspace Modal ── */}
            <AnimatePresence>
            {isInitModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsInitModalOpen(false)} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                        {/* Header */}
                        <div className="p-5 border-b flex items-center gap-3.5" style={{ borderColor: 'var(--border)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                                style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' }}>
                                <FolderPlus size={18} style={{ color: 'var(--accent)' }} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Initialize workspace</h2>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Create an audit documentation workspace for a client and fiscal year.</p>
                            </div>
                            <button onClick={() => setIsInitModalOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors" style={{ color: 'var(--text-muted)' }} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Client</label>
                                <select
                                    value={initClientId}
                                    onChange={e => setInitClientId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                                >
                                    <option value="">— Select a client —</option>
                                    {clients
                                        .slice()
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fiscal year</label>
                                <select
                                    value={initFY}
                                    onChange={e => setInitFY(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors font-mono"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                                >
                                    {NEPALI_FISCAL_YEARS.map(fy => (
                                        <option key={fy} value={fy}>{fy.replace('-', '/')}</option>
                                    ))}
                                </select>
                            </div>

                            {initClientId && (() => {
                                const c = clients.find(x => x.id === initClientId);
                                const already = c?.activeAuditYears?.includes(initFY);
                                return already ? (
                                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-medium"
                                        style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.25)', color: 'var(--color-warning)' }}>
                                        <AlertTriangle size={14} /> This workspace already exists.
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="px-5 pb-5 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => setIsInitModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors border"
                                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInitWorkspace}
                                disabled={!initClientId || savingInit}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            >
                                {savingInit ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><CheckCircle2 size={13} /> Create workspace</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            </AnimatePresence>
            
            {/* ── Client Permission Modal ── */}
            {isPermissionModalOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setIsPermissionModalOpen(false)}
                    />
                    <div 
                        className="relative w-full max-w-md rounded-xl overflow-hidden flex flex-col"
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
                                className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-elevated)]"
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
                                                >
                                                    <div 
                                                        className="w-11 h-6 rounded-full relative transition-colors duration-300 flex items-center px-0.5 shrink-0"
                                                        style={{
                                                            background: isPermitted ? '#10b981' : 'var(--border-mid, rgba(125,125,125,0.3))'
                                                        }}
                                                    >
                                                        <div 
                                                            className="w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-md"
                                                            style={{
                                                                transform: isPermitted ? 'translateX(20px)' : 'translateX(0px)'
                                                            }}
                                                        />
                                                    </div>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/60 animate-in fade-in duration-300">
                    <div className="w-full max-w-5xl h-full max-h-[85vh] rounded-2xl overflow-hidden flex flex-col border"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                        
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                                    style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' }}>
                                    <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Global Staff Access Manager</h2>
                                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage client permissions staff-wise</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsGlobalAccessModalOpen(false); setGlobalSelectedStaffId(null); }}
                                className="p-2 rounded-xl transition-colors hover:bg-[var(--bg-elevated)]"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Layout */}
                        <div className="flex-1 flex min-h-0">
                            
                            {/* Staff List Sidebar */}
                            <div className="w-72 border-r flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                                <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                        <input 
                                            type="text"
                                            placeholder="Find staff..."
                                            value={staffFilter}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none transition-all"
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
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
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group`}
                                            style={{
                                                background: globalSelectedStaffId === s.uid ? 'var(--accent-dim)' : 'transparent',
                                                color: globalSelectedStaffId === s.uid ? 'var(--accent)' : 'var(--text-heading)'
                                            }}
                                            onMouseEnter={e => { if (globalSelectedStaffId !== s.uid) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)'; }}
                                            onMouseLeave={e => { if (globalSelectedStaffId !== s.uid) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-colors"
                                                style={{
                                                    background: globalSelectedStaffId === s.uid ? 'var(--accent)' : 'var(--bg-elevated)',
                                                    borderColor: globalSelectedStaffId === s.uid ? 'var(--border-accent)' : 'var(--border)',
                                                    color: globalSelectedStaffId === s.uid ? 'var(--on-accent)' : 'var(--text-muted)'
                                                }}>
                                                {(s.displayName || 'U').charAt(0)}
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-bold truncate">{s.displayName}</p>
                                                <p className="text-[9px] opacity-70">
                                                    {s.role || 'Staff'}
                                                </p>
                                            </div>
                                            {globalSelectedStaffId === s.uid && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client Access Content */}
                            <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-elevated)' }}>
                                {globalSelectedStaffId ? (
                                    <>
                                        {/* Staff Header */}
                                        <div className="px-8 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                                                    Permissions for <span style={{ color: 'var(--accent)' }}>{allStaff.find(s => s.uid === globalSelectedStaffId)?.displayName}</span>
                                                </h3>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        Allowed: {clients.filter(c => c.permittedStaff?.includes(globalSelectedStaffId)).length}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                                                        <div className="w-2 h-2 rounded-full bg-gray-400 opacity-40" />
                                                        Total: {clients.length}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Client Search within Permission List */}
                                            <div className="relative w-64">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                                <input 
                                                    type="text"
                                                    placeholder="Search clients..."
                                                    value={globalClientFilter}
                                                    onChange={(e) => setGlobalClientFilter(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none transition-all"
                                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Client List */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
                                                                className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 group text-left"
                                                                style={{
                                                                    background: isPermitted ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface)',
                                                                    borderColor: isPermitted ? 'rgba(16,185,129,0.35)' : 'var(--border)'
                                                                }}
                                                            >
                                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                                                                    style={{
                                                                        background: isPermitted ? 'rgba(16,185,129,0.2)' : 'var(--bg-elevated)',
                                                                        color: isPermitted ? '#10b981' : 'var(--text-muted)'
                                                                    }}>
                                                                    <Building2 size={20} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold truncate" style={{ color: 'var(--text-heading)' }}>
                                                                        {client.name}
                                                                    </p>
                                                                    <p className="text-[9px] font-semibold mt-0.5"
                                                                        style={{ color: isPermitted ? '#10b981' : 'var(--text-muted)' }}>
                                                                        {isPermitted ? 'Granted' : 'No access'}
                                                                    </p>
                                                                </div>
                                                                {/* Toggle Switch */}
                                                                <div 
                                                                    className="w-11 h-6 rounded-full relative transition-colors duration-300 flex items-center px-0.5 shrink-0"
                                                                    style={{
                                                                        background: isPermitted ? '#10b981' : 'var(--border-mid, rgba(125,125,125,0.3))'
                                                                    }}
                                                                >
                                                                    <div 
                                                                        className="w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-md"
                                                                        style={{
                                                                            transform: isPermitted ? 'translateX(20px)' : 'translateX(0px)'
                                                                        }}
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
                                        <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center mb-6" style={{ borderColor: 'var(--text-muted)' }}>
                                            <Users size={32} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>Select a Staff Member</h3>
                                        <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Choose a staff member from the left sidebar to manage their client permissions.</p>
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
