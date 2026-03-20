import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Loader2, Book, CheckSquare, FolderOpen } from 'lucide-react';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import { Resource, Template } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [resources, setResources] = useState<Resource[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setIsLoading(true);
            Promise.all([
                KnowledgeService.getAllResources(),
                TemplateService.getAllTemplates()
            ]).then(([resData, tempData]) => {
                setResources(resData);
                setTemplates(tempData);
                setIsLoading(false);
            });
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredResources = resources.filter(r => r.title.toLowerCase().includes(query.toLowerCase()) || r.category?.toLowerCase().includes(query.toLowerCase()));
    const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase()));

    const totalResults = filteredResources.length + filteredTemplates.length;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    className="w-full max-w-2xl bg-[#09090b] shadow-2xl border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[80vh] relative"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center p-4 border-b border-white/10 relative">
                        <Search size={22} className="text-amber-500 absolute left-6" />
                        <input
                            ref={inputRef}
                            className="w-full bg-transparent text-xl text-white placeholder-gray-500 pl-12 pr-10 focus:outline-none focus:ring-0 border-none"
                            placeholder="Search tasks, templates, knowledge base... (Ctrl + /)"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                        <button onClick={onClose} className="absolute right-4 p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-lg flex items-center justify-center">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 size={30} className="animate-spin text-amber-500" /></div>
                        ) : query && totalResults === 0 ? (
                            <div className="py-16 text-center text-gray-500">
                                <Search size={40} className="mx-auto mb-3 opacity-20 text-gray-400" />
                                <p>No results found for "{query}"</p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-6">
                                {query && filteredTemplates.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="px-3 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Templates</div>
                                        {filteredTemplates.slice(0, 5).map(t => (
                                            <div key={t.id} onClick={() => { onClose(); navigate('/templates'); }} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors">
                                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                                                    {t.category === 'CHECKLIST' ? <CheckSquare size={18} /> : <FileText size={18} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-gray-200 group-hover:text-purple-300 transition-colors">{t.name}</div>
                                                    <div className="text-xs text-gray-500 truncate">{t.description}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {query && filteredResources.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="px-3 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Knowledge Base</div>
                                        {filteredResources.slice(0, 5).map(r => (
                                            <a key={r.id} href={r.link || r.downloadUrl || '#'} target="_blank" rel="noreferrer" onClick={onClose} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors">
                                                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                                    <Book size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-gray-200 group-hover:text-amber-300 truncate transition-colors">{r.title}</div>
                                                    <div className="text-xs text-gray-500 uppercase tracking-wider">{r.category || 'Document'}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {!query && (
                                    <div className="py-12 flex flex-col items-center text-center text-gray-500">
                                        <FolderOpen size={48} className="mb-4 opacity-20" />
                                        <h3 className="text-base font-bold text-gray-400 mb-1">Global Search is Ready</h3>
                                        <p className="text-sm max-w-[250px]">Start typing to search across templates and firm knowledge.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
