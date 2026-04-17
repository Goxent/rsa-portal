const fs = require('fs');
const docPage = fs.readFileSync('pages/AuditDocumentationPage.tsx', 'utf8');
const lines = docPage.split('\n');

const helpers = lines.slice(0, 1128).join('\n');

const workspaceComponent = `
interface AuditWorkspaceProps {
    clientId: string;
    clientName: string;
    isReadOnly?: boolean;
}

export const AuditWorkspace: React.FC<AuditWorkspaceProps> = ({ clientId, clientName, isReadOnly }) => {
    const { user } = useAuth();
    const { status: wifiStatus, retry: retryWifi } = useOfficeWifiCheck();

    const [selectedFY, setSelectedFY] = useState(NEPALI_FISCAL_YEARS[0]);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');

    const [navStack, setNavStack] = useState<NavLevel[]>([{ kind: 'root' }]);
    const [isGrid, setIsGrid] = useState(false);

    const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});

    const currentLevel = navStack[navStack.length - 1];

    useEffect(() => {
        if (!clientId) return;
        setLoadingTasks(true);
        AuthService.getAllTasks().then(allTasks => {
            const matching = allTasks.filter(t =>
                (t.clientIds?.includes(clientId) || t.clientId === clientId) &&
                (!t.fiscalYear || t.fiscalYear === selectedFY)
            );
            setClientTasks(matching);
        }).catch(() => { }).finally(() => setLoadingTasks(false));

        (async () => {
            try {
                const [allFiles, allFolders] = await Promise.all([
                    AuditDocService.getAllFiles(clientId, selectedFY, selectedTaskId !== 'ALL' ? selectedTaskId : undefined),
                    Promise.all(
                        (['A', 'B', 'C', 'D', 'E'] as AuditFolderKey[]).map(k =>
                            AuditDocService.getFolders(clientId, selectedFY, k)
                        )
                    ),
                ]);
                const fc: Record<string, number> = {};
                allFiles.forEach(f => {
                    fc[f.folderKey] = (fc[f.folderKey] || 0) + 1;
                    if (f.lineItem) {
                        const k = \`\${f.folderKey}-\${f.lineItem}\`;
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
            }
        })();
    }, [clientId, selectedFY, selectedTaskId]);

    const navigate = (index: number) => setNavStack(prev => prev.slice(0, index + 1));
    const enterMainFolder = (key: AuditFolderKey) => setNavStack(prev => [...prev, { kind: 'main-folder', folderKey: key }]);
    const enterLineItem = (lineItem: string, lineItemLabel: string) => setNavStack(prev => [...prev, { kind: 'line-item', folderKey: 'B', lineItem, lineItemLabel }]);
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

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.STAFF)) {
        return <div className="flex items-center justify-center p-10"><p style={{ color: 'var(--text-muted)' }}>Access restricted.</p></div>;
    }

    if (wifiStatus === 'CHECKING') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifying office network…</p>
            </div>
        );
    }
    if (wifiStatus === 'REMOTE' || wifiStatus === 'ERROR') return <WifiGate retry={retryWifi} />;

    const canGoBack = navStack.length > 1;

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden border min-h-[600px] shadow-sm relative bg-black/10" style={{ borderColor: 'var(--border)' }}>
            <div className="shrink-0 px-4 py-3 flex flex-wrap items-center gap-3 border-b border-white/5" style={{ background: 'var(--bg-surface)' }}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-white/5">
                        <CalendarDays size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <select
                            value={selectedFY}
                            onChange={e => { setSelectedFY(e.target.value); setNavStack([{ kind: 'root' }]); }}
                            className="text-xs font-semibold outline-none bg-transparent cursor-pointer"
                            style={{ color: 'var(--text-heading)' }}
                        >
                            {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 border border-white/5">
                        <ClipboardCheck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <select
                            value={selectedTaskId}
                            onChange={e => { setSelectedTaskId(e.target.value); setNavStack([{ kind: 'root' }]); }}
                            className="text-xs font-semibold outline-none max-w-[200px] bg-transparent cursor-pointer"
                            style={{ color: 'var(--text-heading)' }}
                            disabled={loadingTasks}
                        >
                            <option value="ALL">All Engagements</option>
                            {clientTasks.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.taskType ? \`[\${t.taskType}] \` : ''}{t.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                        <Wifi size={12} /> Office LAN
                    </div>

                    <div className="flex items-center rounded-xl overflow-hidden border border-white/10 ml-2">
                        <button onClick={() => setIsGrid(false)} className={\`p-2 transition-colors \${!isGrid ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-white/5 text-gray-500'}\`}>
                            <List size={14} />
                        </button>
                        <button onClick={() => setIsGrid(true)} className={\`p-2 transition-colors \${isGrid ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-white/5 text-gray-500'}\`}>
                            <LayoutGrid size={14} />
                        </button>
                    </div>
            </div>

            <div className="shrink-0 px-4 py-2.5 flex items-center gap-2 border-b border-white/5" style={{ background: 'var(--bg-elevated)' }}>
                {canGoBack && (
                    <button onClick={() => setNavStack(prev => prev.slice(0, -1))} className="shrink-0 p-1 rounded-md transition-colors hover:bg-white/10 text-gray-400">
                        <ArrowLeft size={14} />
                    </button>
                )}
                <Breadcrumb stack={navStack} onNavigate={navigate} />
            </div>

            <div className="flex-1 flex flex-col relative w-full h-full">
                        {currentLevel.kind === 'root' && (
                            <RootView
                                clientId={clientId}
                                fiscalYear={selectedFY}
                                fileCounts={fileCounts}
                                folderCounts={folderCounts}
                                onEnter={enterMainFolder}
                                isGrid={isGrid}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && user && (
                            <BFolderView
                                fileCounts={fileCounts}
                                onEnter={enterLineItem}
                                isGrid={isGrid}
                                clientId={clientId}
                                clientName={clientName}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && user && (
                            <>
                                {currentLevel.folderKey === 'E' && (
                                    <FolderEGovernance
                                        task={selectedTaskId !== 'ALL' ? (clientTasks.find(t => t.id === selectedTaskId) || null) : null}
                                    />
                                )}
                                <FolderContent
                                    key={\`\${clientId}-\${selectedFY}-\${currentLevel.folderKey}-\${selectedTaskId}\`}
                                    folderKey={currentLevel.folderKey}
                                    clientId={clientId}
                                    clientName={clientName}
                                    fiscalYear={selectedFY}
                                    userId={user.uid}
                                    userName={user.displayName}
                                    taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                    onEnterSubFolder={enterSubFolder}
                                    isGrid={isGrid}
                                />
                            </>
                        )}

                        {currentLevel.kind === 'line-item' && user && (
                            <FolderContent
                                key={\`\${clientId}-\${selectedFY}-B-\${currentLevel.lineItem}-\${selectedTaskId}\`}
                                folderKey="B"
                                lineItem={currentLevel.lineItem}
                                lineItemLabel={currentLevel.lineItemLabel}
                                clientId={clientId}
                                clientName={clientName}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                                isGrid={isGrid}
                            />
                        )}

                        {currentLevel.kind === 'custom-folder' && user && (
                            <FolderContent
                                key={\`\${clientId}-\${selectedFY}-\${currentLevel.folderKey}-\${currentLevel.lineItem}-\${currentLevel.folderId}-\${selectedTaskId}\`}
                                folderKey={currentLevel.folderKey}
                                lineItem={currentLevel.lineItem}
                                customFolderId={currentLevel.folderId}
                                clientId={clientId}
                                clientName={clientName}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={() => {}} 
                                isGrid={isGrid}
                            />
                        )}
            </div>
        </div>
    );
};
`;

fs.writeFileSync('components/audit/AuditWorkspace.tsx', helpers + '\n' + workspaceComponent);
