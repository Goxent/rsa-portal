import React from 'react';
import {
    History, FolderOpen, FileText, FileSearch, ExternalLink,
    CloudUpload, Loader2, Folder, ShieldCheck
} from 'lucide-react';
import { AUDIT_FOLDER_STRUCTURE, AuditFolderKey } from '../../../types';
import { AuditDocFile, AuditDocFolder } from '../../../services/auditDocs';
import { StorageService } from '../../../services/storage';

export interface TaskDocumentsTabProps {
    auditFiles: AuditDocFile[];
    customFolders: AuditDocFolder[];
    isLoadingDocs: boolean;
    isUploadingDoc: boolean;
    uploadProgress: number;
    selectedFolderForUpload: AuditFolderKey | '';
    selectedLineItemForUpload: string;
    onSelectFolder: (key: AuditFolderKey | '') => void;
    onSelectLineItem: (item: string) => void;
    onLoadFiles: () => void;
    onFileUpload: (files: FileList | null) => void;
}

const TaskDocumentsTab: React.FC<TaskDocumentsTabProps> = ({
    auditFiles,
    customFolders,
    isLoadingDocs,
    isUploadingDoc,
    uploadProgress,
    selectedFolderForUpload,
    selectedLineItemForUpload,
    onSelectFolder,
    onSelectLineItem,
    onLoadFiles,
    onFileUpload,
}) => {
    return (
        <div className="flex-1 flex overflow-hidden">
             {/* Left Pane: Folder Navigation */}
            <div className="w-80 border-r border-[var(--border)] p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--text-muted)]">Audit repository</h4>
                    <button 
                        onClick={onLoadFiles}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
                        title="Sync Repository"
                    >
                        <History size={14} className={isLoadingDocs ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="space-y-4">
                    {Object.entries(AUDIT_FOLDER_STRUCTURE).map(([key, def]) => {
                        const isSelected = selectedFolderForUpload === key;
                        const fileCount = auditFiles.filter(f => f.folderKey === key).length;
                        
                        return (
                            <div key={key} className="space-y-1">
                                <button
                                    onClick={() => {
                                        onSelectFolder(key as AuditFolderKey);
                                        onSelectLineItem('');
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[var(--radius-md)] transition-colors border ${
                                        isSelected 
                                            ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)] font-semibold' 
                                            : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-mid)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <FolderOpen size={15} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />
                                        <span className="text-xs truncate tracking-tight">{def.label}</span>
                                    </div>
                                    {fileCount > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-[var(--radius-sm)] text-[10px] font-medium tabular-nums ${isSelected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]'}`}>
                                            {fileCount}
                                        </span>
                                    )}
                                </button>

                                {isSelected && (
                                    <div className="ml-4 pl-3 border-l border-[var(--border)] space-y-1 pt-1 pb-1">
                                        {/* Native Line Items (for B) */}
                                        {def.lineItems?.map(item => {
                                            const isItemSelected = selectedLineItemForUpload === item;
                                            const itemFileCount = auditFiles.filter(f => f.lineItem === item).length;
                                            
                                            return (
                                                <button
                                                    key={item}
                                                    onClick={() => onSelectLineItem(item)}
                                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${
                                                        isItemSelected ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-surface)]'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{item}</span>
                                                    {itemFileCount > 0 && <span className="opacity-60 tabular-nums text-[10px]">{itemFileCount}</span>}
                                                </button>
                                            );
                                        })}

                                        {/* Custom Sub-folders — Read-only display */}
                                        {customFolders.filter(f => f.folderKey === key && (key !== 'B' || f.lineItem === selectedLineItemForUpload)).map(folder => (
                                            <div key={folder.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--text-muted)]">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Folder size={12} className="text-[var(--color-warning)]" />
                                                    <span className="truncate">{folder.name}</span>
                                                </div>
                                            </div>
                                        ))}

                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Pane: File Listing & Upload */}
            <div className="flex-1 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col overflow-hidden">
                <div className="shrink-0 p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] flex items-center justify-center border border-[var(--border-accent)] text-[var(--accent)]">
                            <FileText size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-[var(--text-heading)]">Documentation repository</h3>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5">
                                {selectedFolderForUpload ? `${AUDIT_FOLDER_STRUCTURE[selectedFolderForUpload as AuditFolderKey]?.label} ${selectedLineItemForUpload ? `→ ${selectedLineItemForUpload}` : ''}` : 'Select a folder to manage files'}
                            </p>
                        </div>
                    </div>

                    {selectedFolderForUpload && (
                        <div className="flex items-center gap-3">
                            {isUploadingDoc && (
                                <div className="flex flex-col items-end gap-1 mr-3">
                                    <span className="text-[10px] font-medium text-[var(--accent)] tabular-nums animate-pulse">Uploading {uploadProgress}%</span>
                                    <div className="w-28 h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)]">
                                        <div 
                                            className="h-full bg-[var(--accent)] transition-all duration-300" 
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <label className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-[var(--radius-md)] text-xs font-semibold cursor-pointer transition-colors shadow-none">
                                {isUploadingDoc ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />} 
                                {isUploadingDoc ? 'Syncing...' : 'Upload evidence'}
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    multiple
                                    onChange={(e) => onFileUpload(e.target.files)}
                                    disabled={isUploadingDoc}
                                />
                            </label>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {isLoadingDocs ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 gap-3 opacity-60">
                            <Loader2 size={36} className="text-[var(--accent)] animate-spin" strokeWidth={1.5} />
                            <p className="text-xs font-medium text-[var(--text-muted)]">Synchronizing vault...</p>
                        </div>
                    ) : !selectedFolderForUpload ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                                <FolderOpen size={32} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--text-heading)]">Repository offline</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Select a target folder from the left pane to access documentation.</p>
                            </div>
                        </div>
                    ) : (() => {
                        const currentFiles = auditFiles.filter(f => 
                            f.folderKey === selectedFolderForUpload && 
                            (!selectedLineItemForUpload || f.lineItem === selectedLineItemForUpload)
                        );

                        if (currentFiles.length === 0) {
                            return (
                                <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--bg-surface)] flex flex-col items-center gap-4">
                                    <FileSearch size={36} className="text-[var(--text-muted)] opacity-30" />
                                    <div>
                                        <p className="text-xs font-semibold text-[var(--text-heading)]">Vault is empty</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1 px-8">No documentation has been synchronized to this slot for the selected client and fiscal year.</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <>
                                {/* Read-Only Notice */}
                                <div className="mb-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-[var(--radius-md)] border"
                                    style={{ background: 'rgba(217,164,65,0.06)', borderColor: 'rgba(217,164,65,0.2)' }}>
                                    <div className="shrink-0 mt-0.5">
                                        <ShieldCheck size={14} style={{ color: 'var(--color-warning)' }} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Read-only view</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            Files displayed here are read-only references. To delete or reorganize files, use the <strong style={{ color: 'var(--color-warning)' }}>Audit Documentation</strong> module with appropriate authorization.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {currentFiles.map(file => (
                                    <div key={file.id} className="group relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 transition-colors hover:border-[var(--border-mid)]">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-heading)]">
                                                {file.mimeType.includes('image') ? <ExternalLink size={16} /> : <FileText size={16} />}
                                            </div>
                                            <button 
                                                onClick={() => window.open(StorageService.getViewUrl(file.appwriteFileId), '_blank')}
                                                className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-main)] transition-colors opacity-0 group-hover:opacity-100"
                                                title="Open file"
                                            >
                                                <ExternalLink size={13} />
                                            </button>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-semibold text-[var(--text-heading)] truncate pr-2" title={file.fileName}>{file.fileName}</p>
                                            <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                                {Math.round(file.fileSize / 1024)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[9px] font-medium text-[var(--accent)]">
                                                {(file.uploadedByName || '?').substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-[11px] text-[var(--text-secondary)] truncate">{file.uploadedByName}</span>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default TaskDocumentsTab;
