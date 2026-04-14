const fs = require('fs');

let code = fs.readFileSync('pages/AuditDocumentationPage.tsx', 'utf8');

const oldTopBarAndContent = `            {/* ── Top bar ── */}
            <div className="shrink-0 px-4 py-2.5 flex flex-wrap items-center gap-3"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>

                <FolderArchive size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="text-sm font-bold hidden sm:inline"
                    style={{ color: 'var(--text-heading)' }}>Audit Docs</span>

                <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--border)' }} />

                {/* Client */}
                <div className="flex items-center gap-1.5">
                    <Building2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl text-sm outline-none max-w-[200px]"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                        disabled={loadingClients}
                    >
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Fiscal Year */}
                <div className="flex items-center gap-1.5">
                    <CalendarDays size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        value={selectedFY}
                        onChange={e => setSelectedFY(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
                    >
                        {NEPALI_FISCAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                </div>

                {/* Engagement / Task Selector */}
                <div className="flex items-center gap-1.5">
                    <ClipboardCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        value={selectedTaskId}
                        onChange={e => { setSelectedTaskId(e.target.value); setNavStack([{ kind: 'root' }]); }}
                        className="px-2.5 py-1.5 rounded-xl text-sm outline-none max-w-[220px]"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}
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

                {/* WiFi */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>
                    <Wifi size={12} /> Office
                </div>

                {/* View toggle */}
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

            {/* ── Address bar / Breadcrumb ── */}
            <div className="shrink-0 px-4 py-2 flex items-center gap-2"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {canGoBack && (
                    <button
                        onClick={() => setNavStack(prev => prev.slice(0, -1))}
                        className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: 'var(--text-muted)' }}>
                        <ArrowLeft size={15} />
                    </button>
                )}
                <Breadcrumb stack={navStack} onNavigate={navigate} />

                {/* NAS note */}
                {currentLevel.kind === 'root' && (
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono"
                        style={{ color: 'var(--text-muted)' }}>
                        <ServerCrash size={11} />
                        Appwrite Cloud · NAS sync coming soon
                    </div>
                )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 flex flex-col">
                {currentLevel.kind === 'root' && (
                    <RootView
                        clientId={selectedClientId}
                        fiscalYear={selectedFY}
                        fileCounts={fileCounts}
                        folderCounts={folderCounts}
                        onEnter={enterMainFolder}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && selectedClient && user && (
                    <BFolderView
                        fileCounts={fileCounts}
                        onEnter={enterLineItem}
                        isGrid={isGrid}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                        onEnterSubFolder={enterSubFolder}
                    />
                )}

                {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && selectedClient && user && (
                    <>
                        {currentLevel.folderKey === 'E' && (
                            <FolderEGovernance
                                task={selectedTaskId !== 'ALL' ? (clientTasks.find(t => t.id === selectedTaskId) || null) : null}
                            />
                        )}
                        <FolderContent
                            key={\`\${selectedClientId}-\${selectedFY}-\${currentLevel.folderKey}-\${selectedTaskId}\`}
                            folderKey={currentLevel.folderKey}
                            clientId={selectedClientId}
                            clientName={selectedClient.name}
                            fiscalYear={selectedFY}
                            userId={user.uid}
                            userName={user.displayName}
                            taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                            onEnterSubFolder={enterSubFolder}
                            isGrid={isGrid}
                        />
                    </>
                )}

                {currentLevel.kind === 'line-item' && selectedClient && user && (
                    <FolderContent
                        key={\`\${selectedClientId}-\${selectedFY}-B-\${currentLevel.lineItem}-\${selectedTaskId}\`}
                        folderKey="B"
                        lineItem={currentLevel.lineItem}
                        lineItemLabel={currentLevel.lineItemLabel}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                        onEnterSubFolder={enterSubFolder}
                        isGrid={isGrid}
                    />
                )}

                {currentLevel.kind === 'custom-folder' && selectedClient && user && (
                    <FolderContent
                        key={\`\${selectedClientId}-\${selectedFY}-\${currentLevel.folderKey}-\${currentLevel.lineItem}-\${currentLevel.folderId}-\${selectedTaskId}\`}
                        folderKey={currentLevel.folderKey}
                        lineItem={currentLevel.lineItem}
                        customFolderId={currentLevel.folderId}
                        clientId={selectedClientId}
                        clientName={selectedClient.name}
                        fiscalYear={selectedFY}
                        userId={user.uid}
                        userName={user.displayName}
                        taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                        onEnterSubFolder={() => {}} // no deeper nesting
                        isGrid={isGrid}
                    />
                )}
            </div>`;

const newTopBarAndContent = `            {/* ── Top bar ── */}
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
                                        {t.taskType ? \`[\${t.taskType}] \` : ''}{t.title}
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
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                                    style={{ 
                                        background: 'var(--bg-surface)', 
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-heading)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Client Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {clients
                                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className="group text-left p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] border relative overflow-hidden"
                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at 50% 0%, var(--accent-dim) 0%, transparent 70%)' }} />
                                    
                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                            <Building2 size={24} style={{ color: 'var(--accent)' }} />
                                        </div>
                                        <h3 className="text-base font-bold line-clamp-2 leading-snug mb-1" style={{ color: 'var(--text-heading)' }}>
                                            {client.name}
                                        </h3>
                                        <div className="mt-auto pt-4 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                            <span>View Documents</span>
                                            <ArrowLeft size={14} className="rotate-180 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: 'var(--accent)' }} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                <div className="col-span-full py-12 text-center">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No clients found matching "{searchQuery}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Address bar / Breadcrumb ── */}
                    <div className="shrink-0 px-4 py-2 flex items-center gap-2"
                        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        {canGoBack && (
                            <button
                                onClick={() => setNavStack(prev => prev.slice(0, -1))}
                                className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                                style={{ color: 'var(--text-muted)' }}>
                                <ArrowLeft size={15} />
                            </button>
                        )}
                        <Breadcrumb stack={navStack} onNavigate={navigate} />

                        {/* NAS note */}
                        {currentLevel.kind === 'root' && (
                            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono"
                                style={{ color: 'var(--text-muted)' }}>
                                <ServerCrash size={11} />
                                Appwrite Cloud · NAS sync coming soon
                            </div>
                        )}
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        {currentLevel.kind === 'root' && selectedClient && (
                            <RootView
                                clientId={selectedClientId}
                                fiscalYear={selectedFY}
                                fileCounts={fileCounts}
                                folderCounts={folderCounts}
                                onEnter={enterMainFolder}
                                isGrid={isGrid}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey === 'B' && selectedClient && user && (
                            <BFolderView
                                fileCounts={fileCounts}
                                onEnter={enterLineItem}
                                isGrid={isGrid}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                            />
                        )}

                        {currentLevel.kind === 'main-folder' && currentLevel.folderKey !== 'B' && selectedClient && user && (
                            <>
                                {currentLevel.folderKey === 'E' && (
                                    <FolderEGovernance
                                        task={selectedTaskId !== 'ALL' ? (clientTasks.find(t => t.id === selectedTaskId) || null) : null}
                                    />
                                )}
                                <FolderContent
                                    key={\`\${selectedClientId}-\${selectedFY}-\${currentLevel.folderKey}-\${selectedTaskId}\`}
                                    folderKey={currentLevel.folderKey}
                                    clientId={selectedClientId}
                                    clientName={selectedClient.name}
                                    fiscalYear={selectedFY}
                                    userId={user.uid}
                                    userName={user.displayName}
                                    taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                    onEnterSubFolder={enterSubFolder}
                                    isGrid={isGrid}
                                    isReadOnly={isReadOnly}
                                />
                            </>
                        )}

                        {currentLevel.kind === 'line-item' && selectedClient && user && (
                            <FolderContent
                                key={\`\${selectedClientId}-\${selectedFY}-B-\${currentLevel.lineItem}-\${selectedTaskId}\`}
                                folderKey="B"
                                lineItem={currentLevel.lineItem}
                                lineItemLabel={currentLevel.lineItemLabel}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={enterSubFolder}
                                isGrid={isGrid}
                                isReadOnly={isReadOnly}
                            />
                        )}

                        {currentLevel.kind === 'custom-folder' && selectedClient && user && (
                            <FolderContent
                                key={\`\${selectedClientId}-\${selectedFY}-\${currentLevel.folderKey}-\${currentLevel.lineItem}-\${currentLevel.folderId}-\${selectedTaskId}\`}
                                folderKey={currentLevel.folderKey}
                                lineItem={currentLevel.lineItem}
                                customFolderId={currentLevel.folderId}
                                clientId={selectedClientId}
                                clientName={selectedClient.name}
                                fiscalYear={selectedFY}
                                userId={user.uid}
                                userName={user.displayName}
                                taskId={selectedTaskId !== 'ALL' ? selectedTaskId : undefined}
                                onEnterSubFolder={() => {}} // no deeper nesting
                                isGrid={isGrid}
                                isReadOnly={isReadOnly}
                            />
                        )}
                    </div>
                </>
            )}`;

if (code.includes(oldTopBarAndContent)) {
    code = code.replace(oldTopBarAndContent, newTopBarAndContent);
    fs.writeFileSync('pages/AuditDocumentationPage.tsx', code);
    console.log('Part 2 Top Bar & Grid replaced successfully');
} else {
    console.log('ERROR: Could not find old top bar block');
}
