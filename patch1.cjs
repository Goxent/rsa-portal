const fs = require('fs');
let code = fs.readFileSync('pages/AuditDocumentationPage.tsx', 'utf8');

code = code.replace(
    'CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,\n    List, CheckCircle2, Info, ChevronDown,\n    ClipboardCheck, CheckCircle, Clock, AlertTriangle, ShieldCheck',
    'CloudUpload, FolderX, FilePlus2, ArrowLeft, LayoutGrid,\n    List, CheckCircle2, Info, ChevronDown,\n    ClipboardCheck, CheckCircle, Clock, AlertTriangle, ShieldCheck, Search'
);

code = code.replace(
    'import {\n    Client,\n    UserRole,\n    AUDIT_FOLDER_STRUCTURE,',
    'import {\n    Client,\n    UserRole,\n    UserProfile,\n    AUDIT_FOLDER_STRUCTURE,'
);

const oldStateBlock = `    const currentLevel = navStack[navStack.length - 1];

    // Load clients
    useEffect(() => {
        (async () => {
            try {
                const list = await AuthService.getAllClients();
                const active = list.filter(c => c.status === 'Active');
                setClients(active);
                if (active.length > 0) setSelectedClientId(active[0].id);
            } catch {
                toast.error('Failed to load clients');
            } finally {
                setLoadingClients(false);
            }
        })();
    }, []);`;

const newStateBlock = `    const currentLevel = navStack[navStack.length - 1];

    // Staff Permissions
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
    
    const isReadOnly = user?.role === UserRole.STAFF;

    const [searchQuery, setSearchQuery] = useState('');

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
                // DO NOT auto select. Force user to choose from list view.
            } catch {
                toast.error('Failed to load clients');
            } finally {
                setLoadingClients(false);
            }
        })();
    }, [user?.uid, user?.role]);`;

code = code.replace(oldStateBlock, newStateBlock);

const oldHandlers = `    const selectedClient = clients.find(c => c.id === selectedClientId);

    // ── Guards ─────────────────────────────────────────────────────────────────`;

const newHandlers = `    const selectedClient = clients.find(c => c.id === selectedClientId);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setSearchQuery('');
    };

    // ── Guards ─────────────────────────────────────────────────────────────────`;

code = code.replace(oldHandlers, newHandlers);

const oldGuards = `    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN)) {
        return (
            <div className="flex items-center justify-center min-h-full">
                <p style={{ color: 'var(--text-muted)' }}>Access restricted to administrators.</p>
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
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} />;`;

const newGuards = `    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.STAFF)) {
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
    }`;

code = code.replace(oldGuards, newGuards);

fs.writeFileSync('pages/AuditDocumentationPage.tsx', code);
console.log('Part 1 basic patch applied successfully.');
