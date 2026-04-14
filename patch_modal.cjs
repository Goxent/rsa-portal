const fs = require('fs');

let code = fs.readFileSync('pages/AuditDocumentationPage.tsx', 'utf8');

// Find the last </div> before );
const idx = code.lastIndexOf('        </div>\n    );');

if (idx !== -1) {
    const modalJSX = `
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
                                                            await AuthService.updateClient(selectedClient.id, { permittedStaff: newPermitted });
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
`;
    const newCode = code.slice(0, idx) + modalJSX + code.slice(idx);
    fs.writeFileSync('pages/AuditDocumentationPage.tsx', newCode);
    console.log('Modal injected!');
} else {
    console.log('Target end div not found.');
}
