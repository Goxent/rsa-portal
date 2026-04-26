import React from 'react';
import {
    History, FolderOpen, FileText, FileSearch, ExternalLink,
    CloudUpload, Loader2, Folder, ShieldCheck
} from 'lucide-react';
import { AUDIT_FOLDER_STRUCTURE, AuditFolderKey } from '../../../types';
import { AuditDocFile, AuditDocFolder } from '../../../services/auditDocs';
import { GoogleDriveService } from '../../../services/googleDrive';

export interface TaskDocumentsTabProps {
    auditFiles: AuditDocFile[];
    customFolders: AuditDocFolder[];
    isLoadingDocs: boolean;
    isUploadingDoc: boolean;
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
            <div className="w-80 border-r border-white/[0.04] p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Audit Repository</h4>
                    <button 
                        onClick={onLoadFiles}
                        className="p-1.5 text-gray-500 hover:text-white transition-all"
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
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${
                                        isSelected 
                                            ? 'bg-brand-500 border-brand-400 text-white shadow-lg' 
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FolderOpen size={16} className={isSelected ? 'text-white' : 'text-brand-500/60'} />
                                        <span className="text-[12px] font-bold truncate tracking-tight">{def.label}</span>
                                    </div>
                                    {fileCount > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-brand-500/20 text-brand-400'}`}>
                                            {fileCount}
                                        </span>
                                    )}
                                </button>

                                {isSelected && (
                                    <div className="ml-4 pl-4 border-l border-white/10 space-y-1 pt-1 pb-2">
                                        {/* Native Line Items (for B) */}
                                        {def.lineItems?.map(item => {
                                            const isItemSelected = selectedLineItemForUpload === item;
                                            const itemFileCount = auditFiles.filter(f => f.lineItem === item).length;
                                            
                                            return (
                                                <button
                                                    key={item}
                                                    onClick={() => onSelectLineItem(item)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-medium transition-all ${
                                                        isItemSelected ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{item}</span>
                                                    {itemFileCount > 0 && <span className="opacity-60">{itemFileCount}</span>}
                                                </button>
                                            );
                                        })}

                                        {/* Custom Sub-folders — Read-only display */}
                                        {customFolders.filter(f => f.folderKey === key && (key !== 'B' || f.lineItem === selectedLineItemForUpload)).map(folder => (
                                            <div key={folder.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-medium text-gray-400">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Folder size={12} className="text-amber-500/50" />
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
            <div className="flex-1 glass-pane bg-[#080a0e] flex flex-col overflow-hidden">
                <div className="shrink-0 p-8 border-b border-white/[0.04] flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                            <FileText size={18} className="text-brand-400" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-black text-white uppercase tracking-[0.2em]">Documentation Repository</h3>
                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                {selectedFolderForUpload ? `${AUDIT_FOLDER_STRUCTURE[selectedFolderForUpload as AuditFolderKey]?.label} ${selectedLineItemForUpload ? `→ ${selectedLineItemForUpload}` : ''}` : 'Select a folder to manage files'}
                            </p>
                        </div>
                    </div>

                    {selectedFolderForUpload && (
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2.5 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg shadow-brand-500/20 active:scale-95">
                                <CloudUpload size={14} /> Upload Evidence
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

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {isLoadingDocs ? (
                        <div className="h-full flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                            <Loader2 size={48} className="text-brand-500 animate-spin" strokeWidth={1.5} />
                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Synchronizing Vault...</p>
                        </div>
                    ) : !selectedFolderForUpload ? (
                        <div className="h-full flex flex-col items-center justify-center py-24 gap-6 text-center opacity-40">
                            <div className="w-24 h-24 rounded-[32px] bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                                <FolderOpen size={48} className="text-gray-700" />
                            </div>
                            <div>
                                <p className="text-[15px] font-black uppercase tracking-[0.3em] text-white">Repository Offline</p>
                                <p className="text-[10px] font-medium text-gray-600 uppercase tracking-[0.2em] mt-4">Select a target folder from the left pane to access documentation.</p>
                            </div>
                        </div>
                    ) : (() => {
                        const currentFiles = auditFiles.filter(f => 
                            f.folderKey === selectedFolderForUpload && 
                            (!selectedLineItemForUpload || f.lineItem === selectedLineItemForUpload)
                        );

                        if (currentFiles.length === 0) {
                            return (
                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01] flex flex-col items-center gap-6">
                                    <FileSearch size={48} className="text-gray-800 opacity-20" />
                                    <div>
                                        <p className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Vault is Empty</p>
                                        <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mt-2 px-10">No documentation has been synchronized to this slot for the selected client and fiscal year.</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <>
                                {/* Read-Only Notice */}
                                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl border"
                                    style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                                    <div className="shrink-0 mt-0.5">
                                        <ShieldCheck size={14} style={{ color: '#f59e0b' }} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>Read-Only View</p>
                                        <p className="text-[9px] font-medium mt-0.5" style={{ color: 'rgba(245,158,11,0.6)' }}>
                                            Files displayed here are read-only references. To delete or reorganize files, use the <strong style={{ color: '#f59e0b' }}>Audit Documentation</strong> module with appropriate authorization.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {currentFiles.map(file => (
                                    <div key={file.id} className="group relative bg-[#0f1218] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.03] hover:border-brand-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${file.mimeType.includes('pdf') ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                {file.mimeType.includes('image') ? <ExternalLink size={18} /> : <FileText size={18} />}
                                            </div>
                                            <button 
                                                onClick={() => window.open(GoogleDriveService.getFileView(file.appwriteFileId), '_blank')}
                                                className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-brand-500 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[12px] font-bold text-gray-100 truncate pr-4" title={file.fileName}>{file.fileName}</p>
                                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                                                {Math.round(file.fileSize / 1024)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center text-[7px] font-black text-brand-400">
                                                {(file.uploadedByName || '?').substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-[9px] font-bold text-gray-600 truncate">{file.uploadedByName}</span>
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
