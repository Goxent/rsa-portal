import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FileText, Search, Plus, Star, Copy, Trash2, 
    File, FileSpreadsheet, FileCode, CheckSquare, Sparkles, 
    ExternalLink, X, Library, BookOpen, Download, 
    FolderOpen, FileJson, FileType, Loader2, Palette, Check, AlertTriangle, ChevronDown, ChevronRight, ListTodo,
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, Activity, Edit2, Save, Book, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
    Template, UserRole, Resource, Category, TemplateFolder, AuditPhase, 
    TaskStatus, SubTask, TaskType 
} from '../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../constants/taskTypeChecklists';
import { TemplateService } from '../services/templates';
import { KnowledgeService } from '../services/knowledge';
import { StorageService } from '../services/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';
import { useQueryClient } from '@tanstack/react-query';
import { templateKeys } from '../hooks/useTemplates';
import ResearchAssistant from '../components/ResearchAssistant';
import toast from 'react-hot-toast';
import { useModal } from '../context/ModalContext';

// ─── Default folder colours ───────────────────────────────────────────────────
const DEFAULT_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

type ActiveTab = 'templates' | 'knowledge';

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const TemplatesPage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [activeTab, setActiveTab] = useState<ActiveTab>('knowledge');

    // ── Templates state ────────────────────────────────────────────────────────
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [folders, setFolders] = useState<TemplateFolder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState('ALL');
    const [filterTaskType, setFilterTaskType] = useState<TaskType | 'ALL'>('ALL');
    const [isTemplateFolderModalOpen, setIsTemplateFolderModalOpen] = useState(false);
    const [currentTemplateFolder, setCurrentTemplateFolder] = useState<Partial<TemplateFolder>>({ name: '', color: '#F59E0B', icon: 'FolderOpen' });
    
    const [newTemplate, setNewTemplate] = useState<{
        id?: string;
        name: string;
        description: string;
        category: 'TASK' | 'CHECKLIST' | 'DOCUMENT' | 'WORKFLOW' | 'REVIEWER_CHECKLIST';
        type: string;
        content: string;
        priority: string;
        expectedDays: number;
        taskType?: TaskType;
        reviewerRole?: 'TL' | 'ER' | 'SP';
        tags: string[];
        attachments: any[];
        folderId: string;
        folderName?: string;
    }>({
        name: '', description: '', category: 'TASK', type: '', content: '',
        priority: 'MEDIUM', expectedDays: 7, taskType: undefined,
        reviewerRole: undefined,
        tags: [], attachments: [], folderId: '', folderName: ''
    });

    const [phaseSubtasks, setPhaseSubtasks] = useState<{ [key in AuditPhase]: any[] }>({
        [AuditPhase.ONBOARDING]: [],
        [AuditPhase.PLANNING_AND_EXECUTION]: [],
        [AuditPhase.REVIEW_AND_CONCLUSION]: []
    });
    
    const [statusSubtaskMap, setStatusSubtaskMap] = useState<{ [key: string]: any[] }>({
        [TaskStatus.IN_PROGRESS]: [],
        [TaskStatus.UNDER_REVIEW]: [],
        [TaskStatus.HALTED]: [],
        [TaskStatus.COMPLETED]: [],
        [TaskStatus.ARCHIVED]: []
    });
    
    const [activePhaseTab, setActivePhaseTab] = useState<AuditPhase>(AuditPhase.ONBOARDING);
    const [expandedSections, setExpandedSections] = useState({ phases: false, statuses: false, workflow: false });
    const [nextTemplateId, setNextTemplateId] = useState<string>('');
    const [openStatusAccordions, setOpenStatusAccordions] = useState<string[]>([]);

    // ── Knowledge Base state ───────────────────────────────────────────────────
    const [resources, setResources] = useState<Resource[]>([]);
    const [kbCategories, setKbCategories] = useState<Category[]>([]);
    const [kbLoading, setKbLoading] = useState(false);
    const [activeKbCategory, setActiveKbCategory] = useState('ALL');
    const [kbSearch, setKbSearch] = useState('');
    const [viewDoc, setViewDoc] = useState<{ url: string; type: string; title: string; downloadUrl?: string } | null>(null);
    const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [currentResource, setCurrentResource] = useState<Partial<Resource>>({ type: 'pdf', category: '', link: '', title: '', reviewDate: '' });
    const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({ label: '', icon: 'FolderOpen', color: '#3B82F6' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadMode, setIsUploadMode] = useState(false);

    // ── Load data ──────────────────────────────────────────────────────────────
    useEffect(() => { loadTemplates(); loadFolders(); }, [categoryFilter]);

    useEffect(() => {
        if (activeTab === 'knowledge' && resources.length === 0 && !kbLoading) {
            loadKbData();
        }
    }, [activeTab]);

    const loadTemplates = async () => {
        try {
            const data = await TemplateService.getAllTemplates(categoryFilter === 'ALL' ? undefined : categoryFilter);
            setTemplates(data);
        } catch { toast.error('Failed to load templates'); }
    };

    const loadFolders = async () => {
        try {
            const data = await TemplateService.getFolders();
            setFolders(data);
        } catch { toast.error('Failed to load folders'); }
    };

    const loadKbData = async () => {
        setKbLoading(true);
        try {
            const [res, cats] = await Promise.all([
                KnowledgeService.getAllResources(),
                KnowledgeService.getAllCategories(),
            ]);
            setResources(res);
            setKbCategories(cats);
        } catch { toast.error('Failed to load knowledge base'); }
        finally { setKbLoading(false); }
    };

    // ── Template handlers ──────────────────────────────────────────────────────
    const handleCreateTemplate = async () => {
        if (!user || !newTemplate.name || isSubmitting) return;
        setIsSubmitting(true);
        try {
            // Flatten phase subtasks
            const subtaskDetails = Object.entries(phaseSubtasks).flatMap(([phase, tasks]) => 
                (tasks as any[]).filter(t => t.title).map(t => ({ ...t, phase: phase as AuditPhase }))
            );

            const payload = {
                ...newTemplate,
                subtaskDetails,
                statusSubtasks: statusSubtaskMap,
                nextTemplateId,
                createdBy: user.uid
            };

            if (newTemplate.id) {
                await TemplateService.updateTemplate(newTemplate.id, payload as any);
                toast.success('Template updated successfully');
            } else {
                await TemplateService.createTemplate(payload as any);
                toast.success('Template created successfully');
            }

            // Reset everything
            setNewTemplate({ 
                name: '', description: '', category: 'TASK', type: '', content: '',
                priority: 'MEDIUM', expectedDays: 7, taskType: undefined,
                tags: [], attachments: [], folderId: '', folderName: '' 
            });
            setPhaseSubtasks({
                [AuditPhase.ONBOARDING]: [],
                [AuditPhase.PLANNING_AND_EXECUTION]: [],
                [AuditPhase.REVIEW_AND_CONCLUSION]: []
            });
            setStatusSubtaskMap({
                [TaskStatus.IN_PROGRESS]: [],
                [TaskStatus.UNDER_REVIEW]: [],
                [TaskStatus.HALTED]: [],
                [TaskStatus.COMPLETED]: [],
                [TaskStatus.ARCHIVED]: []
            });
            setNextTemplateId('');
            setIsModalOpen(false);
            setNewTemplate({ 
                name: '', description: '', category: 'TASK', type: '', content: '',
                priority: 'MEDIUM', expectedDays: 7, taskType: undefined,
                reviewerRole: undefined,
                tags: [], attachments: [], folderId: '', folderName: '' 
            });
            
            // Intelligence: Invalidate templates query to sync with task creation workflow
            queryClient.invalidateQueries({ queryKey: templateKeys.all });
            
            await loadTemplates();
        } catch (error) { 
            console.error(error);
            toast.error(newTemplate.id ? 'Failed to update template' : 'Failed to create template'); 
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditTemplate = (template: Template) => {
        setNewTemplate({
            id: template.id,
            name: template.name,
            description: template.description || '',
            category: (template.category as any) || 'TASK',
            type: template.type || '',
            content: template.content || '',
            priority: template.priority || 'MEDIUM',
            expectedDays: template.expectedDays || 7,
            taskType: template.taskType,
            tags: template.tags || [],
            attachments: template.attachments || [],
            folderId: template.folderId || '',
            folderName: template.folderName,
            reviewerRole: template.reviewerRole
        });

        // Populate subtasks
        const phaseMap: any = {
            [AuditPhase.ONBOARDING]: [],
            [AuditPhase.PLANNING_AND_EXECUTION]: [],
            [AuditPhase.REVIEW_AND_CONCLUSION]: []
        };
        
        if (template.subtaskDetails) {
            template.subtaskDetails.forEach((st: any) => {
                if (st.phase && phaseMap[st.phase]) {
                    phaseMap[st.phase].push(st);
                }
            });
        }
        setPhaseSubtasks(phaseMap);

        if (template.statusSubtasks) {
            setStatusSubtaskMap(template.statusSubtasks);
        }

        setNextTemplateId(template.nextTemplateId || '');
        setIsModalOpen(true);
    };

    const handleDuplicateTemplate = (template: Template) => {
        handleEditTemplate(template);
        setNewTemplate(prev => ({ ...prev, id: undefined, name: `${prev.name} (Copy)` }));
        toast.success('Template duplicated - make changes and save');
    };

    const addPhaseSubtask = (phase: AuditPhase) => {
        const newItem = { title: '' };
        setPhaseSubtasks(prev => ({ ...prev, [phase]: [...(prev[phase] || []), newItem] }));
    };

    const updatePhaseSubtaskField = (phase: AuditPhase, idx: number, field: string, value: any) => {
        setPhaseSubtasks(prev => {
            const newPhaseTasks = [...(prev[phase] || [])];
            newPhaseTasks[idx] = { ...newPhaseTasks[idx], [field]: value };
            return { ...prev, [phase]: newPhaseTasks };
        });
    };

    const removePhaseSubtask = (phase: AuditPhase, index: number) => {
        setPhaseSubtasks(prev => ({ ...prev, [phase]: prev[phase].filter((_, i) => i !== index) }));
    };

    const addStatusSubtask = (status: TaskStatus) => {
        setStatusSubtaskMap(prev => ({
            ...prev,
            [status]: [...(prev[status] || []), { title: '' }]
        }));
    };

    const updateStatusSubtaskField = (status: TaskStatus, idx: number, field: string, value: any) => {
        setStatusSubtaskMap(prev => {
            const newStatusTasks = [...(prev[status] || [])];
            newStatusTasks[idx] = { ...newStatusTasks[idx], [field]: value };
            return { ...prev, [status]: newStatusTasks };
        });
    };

    const removeStatusSubtask = (status: TaskStatus, idx: number) => {
        setStatusSubtaskMap(prev => ({
            ...prev,
            [status]: prev[status].filter((_, i) => i !== idx)
        }));
    };

    const toggleSection = (section: 'phases' | 'statuses' | 'workflow') => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleStatusAccordion = (status: string) => {
        setOpenStatusAccordions(prev => 
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const handleCreateTemplateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTemplateFolder.name || !user) return;
        setIsSubmitting(true);
        try {
            const id = await TemplateService.createFolder({ name: currentTemplateFolder.name, color: currentTemplateFolder.color || '#F59E0B', icon: currentTemplateFolder.icon || 'FolderOpen', createdBy: user.uid });
            setFolders(prev => [...prev, { ...currentTemplateFolder, id, createdBy: user.uid, createdAt: new Date().toISOString() } as TemplateFolder]);
            toast.success('Folder created');
            setIsTemplateFolderModalOpen(false);
            setCurrentTemplateFolder({ name: '', color: '#F59E0B', icon: 'FolderOpen' });
        } catch { toast.error('Failed to create folder'); }
        finally { setIsSubmitting(false); }
    };

    const handleDeleteTemplateFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openModal('CONFIRMATION', {
            title: 'Delete Folder',
            message: 'Templates in this folder will not be deleted but will lose their folder association.',
            confirmLabel: 'Delete', variant: 'danger',
            onConfirm: async () => {
                try {
                    await TemplateService.deleteFolder(id);
                    setFolders(prev => prev.filter(f => f.id !== id));
                    if (activeFolderId === id) setActiveFolderId('ALL');
                    toast.success('Folder deleted');
                } catch { toast.error('Failed to delete folder'); }
            }
        });
    };

    const handleUseTemplate = async (template: Template) => {
        try {
            await TemplateService.useTemplate(template.id);
            toast.success(`Template "${template.name}" ready to use!`);
            await loadTemplates();
        } catch { toast.error('Error using template'); }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (confirm('Are you sure you want to delete this template?')) {
            try {
                await TemplateService.deleteTemplate(id);
                toast.success('Template deleted');
                queryClient.invalidateQueries({ queryKey: templateKeys.all });
                loadTemplates();
            } catch { toast.error('Delete failed'); }
        }
    };

    // ── Knowledge Base handlers ────────────────────────────────────────────────
    const handleOpenResource = (res: Resource) => {
        if (res.type === 'article' || res.link?.includes('docs.google.com') || res.type === 'folder') {
            if (res.link) window.open(res.link, '_blank');
        } else {
            setViewDoc({ url: res.link || '', type: res.type, title: res.title, downloadUrl: res.downloadUrl });
        }
    };

    const handleDeleteResource = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openModal('CONFIRMATION', {
            title: 'Delete Resource',
            message: 'Are you sure you want to delete this resource? This cannot be undone.',
            confirmLabel: 'Delete', variant: 'danger',
            onConfirm: async () => {
                try {
                    await KnowledgeService.deleteResource(id);
                    setResources(prev => prev.filter(r => r.id !== id));
                    toast.success('Resource deleted');
                } catch { toast.error('Failed to delete resource'); }
            }
        });
    };

    const handleEditResource = (resource: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentResource(resource);
        setIsUploadMode(!!resource.fileId);
        setIsResourceModalOpen(true);
    };

    const handleResourceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentResource.title || (!currentResource.link && !currentResource.fileId)) {
            toast.error('Title and Link/File are required'); return;
        }
        setIsSubmitting(true);
        try {
            const resourceData = { ...currentResource, category: currentResource.category || (kbCategories[0]?.id || 'GENERAL') };
            if (currentResource.id) {
                await KnowledgeService.updateResource(currentResource.id, resourceData);
                setResources(prev => prev.map(r => r.id === currentResource.id ? { ...r, ...resourceData } as Resource : r));
                toast.success('Resource updated');
            } else {
                const id = await KnowledgeService.addResource(resourceData as any);
                setResources(prev => [{ ...resourceData, id, updatedAt: new Date().toISOString() } as Resource, ...prev]);
                toast.success('Resource added');
            }
            setIsResourceModalOpen(false);
            setCurrentResource({ type: 'pdf', category: '', link: '', title: '', reviewDate: '' });
        } catch { toast.error('Failed to save resource'); }
        finally { setIsSubmitting(false); }
    };

    const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openModal('CONFIRMATION', {
            title: 'Delete Category',
            message: 'Resources in this category will not be deleted but need re-categorizing.',
            confirmLabel: 'Delete', variant: 'danger',
            onConfirm: async () => {
                try {
                    await KnowledgeService.deleteCategory(id);
                    setKbCategories(prev => prev.filter(c => c.id !== id));
                    if (activeKbCategory === id) setActiveKbCategory('ALL');
                    toast.success('Category deleted');
                } catch { toast.error('Failed to delete category'); }
            }
        });
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCategory.label) return;
        setIsSubmitting(true);
        try {
            const id = await KnowledgeService.addCategory({
                label: currentCategory.label!, icon: currentCategory.icon || 'FolderOpen', color: currentCategory.color || '#3B82F6'
            });
            setKbCategories(prev => [...prev, { ...currentCategory, id, createdAt: new Date().toISOString() } as Category]);
            toast.success('Category created');
            setIsCategoryModalOpen(false);
            setCurrentCategory({ label: '', icon: 'FolderOpen', color: '#3B82F6' });
        } catch { toast.error('Failed to create category'); }
        finally { setIsSubmitting(false); }
    };

    // ── Helpers ────────────────────────────────────────────────────────────────
    const filteredTemplates = templates.filter(t => {
        const matchesFolder = activeFolderId === 'ALL' || t.folderId === activeFolderId;
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterTaskType === 'ALL' || t.taskType === filterTaskType || !t.taskType;
        
        // Logical check: If we filter by a specific TaskType, we show:
        // 1. Templates that specifically match that TaskType
        // 2. "General" templates (taskType is undefined)
        // This makes the templates more discoverable.
        return matchesFolder && matchesSearch && matchesType;
    });

    const recommendedTemplates = filteredTemplates.filter(t => filterTaskType !== 'ALL' && t.taskType === filterTaskType);
    const generalTemplates = filteredTemplates.filter(t => filterTaskType === 'ALL' || !t.taskType);

    const filteredResources = resources.filter(r => {
        const matchesCat = activeKbCategory === 'ALL' || r.category === activeKbCategory;
        const matchesSearch = r.title.toLowerCase().includes(kbSearch.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const getTemplateIcon = (type: string) => {
        if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet size={20} className="text-brand-400" />;
        if (type.includes('pdf')) return <FileText size={20} className="text-red-400" />;
        return <File size={20} className="text-amber-400" />;
    };

    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText size={24} className="text-red-400" />;
            case 'sheet': return <FileJson size={24} className="text-green-400" />;
            case 'doc': return <FileType size={24} className="text-amber-400" />;
            case 'image': return <FileType size={24} className="text-purple-400" />;
            default: return <FileText size={24} className="text-gray-400" />;
        }
    };

    // ── Sub-components for better organization ────────────────────────────────
    const TemplateCard: React.FC<{ 
        template: Template; 
        index: number; 
        isAdmin: boolean;
        onDelete: (id: string) => void;
        onPreview: (t: Template) => void;
    }> = ({ template, index, isAdmin, onDelete, onPreview }) => (
        <div 
            className="group relative overflow-hidden flex flex-col h-full rounded-2xl bg-[#0d1117]/80 backdrop-blur-md border border-white/[0.05] hover:border-amber-500/30 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:-translate-y-1"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Visual Accent */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] group-hover:bg-amber-500/10 group-hover:border-amber-500/20 transition-all shadow-inner">
                        {template.category === 'CHECKLIST' ? <ListTodo className="text-amber-400" size={20} /> : 
                         template.category === 'TASK' ? <Activity className="text-indigo-400" size={20} /> :
                         <FileText className="text-cyan-400" size={20} />}
                    </div>
                    <div className="flex items-center gap-2">
                        {template.taskType && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-tighter">
                                {(() => {
                                    const Icon = {
                                        ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                    }[TASK_TYPE_ICONS[template.taskType]] || Activity;
                                    return <Icon size={10} />;
                                })()}
                                {TASK_TYPE_LABELS[template.taskType]}
                            </div>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${
                            template.category === 'TASK' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            template.category === 'CHECKLIST' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            template.category === 'DOCUMENT' ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' :
                            template.category === 'REVIEWER_CHECKLIST' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-pink-500/10 text-pink-400 border-pink-500/20'
                        }`}>
                            {template.category === 'REVIEWER_CHECKLIST' ? 'Reviewer' : template.category}
                        </span>
                        {template.category === 'REVIEWER_CHECKLIST' && template.reviewerRole && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${
                                template.reviewerRole === 'TL' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                                template.reviewerRole === 'ER' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}>
                                {template.reviewerRole}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    <h3 className="font-black text-white text-base mb-1.5 leading-none transition-colors group-hover:text-amber-400 uppercase tracking-tight">{template.name}</h3>
                    <p className="text-[12px] text-gray-500 mb-4 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{template.description || 'No description provided.'}</p>
                </div>

            {template.attachments && template.attachments.length > 0 && (
                <div className="mb-3 space-y-1">
                    <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">Attachments</p>
                    {template.attachments.slice(0, 2).map((att: any, i: number) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            className="flex items-center p-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-colors group/file border border-white/[0.04]">
                            <div className="mr-2">{getTemplateIcon(att.name)}</div>
                            <span className="text-[11px] text-gray-300 truncate flex-1">{att.name}</span>
                            <ExternalLink size={10} className="text-gray-600 opacity-0 group-hover/file:opacity-100 transition-opacity" />
                        </a>
                    ))}
                </div>
            )}

                <div className="pt-4 border-t border-white/[0.05] mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            <Star size={12} className="text-amber-500/60" />
                            <span>{template.usageCount || 0} uses</span>
                        </div>
                        {isAdmin && (
                            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                <button onClick={() => handleEditTemplate(template)} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5" title="Edit Template">
                                    <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleDuplicateTemplate(template)} className="text-gray-500 hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-indigo-500/10" title="Duplicate Template">
                                    <Copy size={13} />
                                </button>
                                <button onClick={() => onDelete(template.id!)} className="text-gray-600 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10" title="Delete Template">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => onPreview(template)}
                        className="text-[11px] font-black text-amber-500 hover:text-amber-400 flex items-center transition-all group/btn uppercase tracking-widest">
                        View Details <ChevronRight size={14} className="ml-0.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2.5 font-heading">
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <Library className="text-amber-400" size={22} />
                        </div>
                        Resources
                    </h1>
                    <p className="text-[13px] text-slate-500 mt-1 ml-12">Templates, SOPs, and firm knowledge — all in one place</p>
                </div>
                {/* Stats strip */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <BookOpen size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-blue-300">{resources.length} Documents</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <FileCode size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">{templates.length} Templates</span>
                    </div>
                </div>
            </div>

            {/* ── Tab Switcher ── */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'knowledge'
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                >
                    <BookOpen size={13} /> Knowledge Base
                    {resources.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'knowledge' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}`}>{resources.length}</span>}
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'templates'
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                >
                    <FileCode size={13} /> Templates
                    {templates.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'templates' ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>{templates.length}</span>}
                </button>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/*  TEMPLATES TAB                                           */}
            {/* ════════════════════════════════════════════════════════ */}
            {activeTab === 'templates' && (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="relative flex-1 w-full md:max-w-xs">
                            <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
                            <input type="text" placeholder="Search templates..."
                                className="w-full glass-input rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        {isAdmin && (
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => setIsTemplateFolderModalOpen(true)}
                                    className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center transition-all">
                                    <Plus size={14} className="mr-2" /> Folder
                                </button>
                                <button onClick={() => setIsModalOpen(true)}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center transition-all">
                                    <Plus size={14} className="mr-2" /> Template
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Prompt E: TaskType Filter Pills Row */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide py-1">
                        <button
                            onClick={() => setFilterTaskType('ALL')}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                                filterTaskType === 'ALL'
                                    ? 'bg-amber-500 text-black border-amber-400/50 shadow-lg shadow-amber-500/20'
                                    : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.05]'
                            }`}
                        >
                            All Engagement Types
                        </button>
                        {Object.values(TaskType).map((type) => {
                            const isSelected = filterTaskType === type;
                            const IconComponent = {
                                ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                            }[TASK_TYPE_ICONS[type]] || Activity;

                            return (
                                <button
                                    key={type}
                                    onClick={() => setFilterTaskType(type)}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-500/50 shadow-lg shadow-indigo-600/20'
                                            : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <IconComponent size={12} className={isSelected ? 'text-white' : 'text-slate-500'} />
                                    <span>{TASK_TYPE_LABELS[type]}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-5 overflow-hidden">
                        {/* Folder sidebar */}
                        <div className="w-full lg:w-56 flex-shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2">
                            <button onClick={() => setActiveFolderId('ALL')}
                                className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeFolderId === 'ALL' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                <FolderOpen size={16} className="mr-2.5" /> All Templates
                            </button>
                            
                            {folders.map(folder => (
                                <div key={folder.id} className="relative group flex-shrink-0 lg:flex-shrink w-full">
                                    <button onClick={() => setActiveFolderId(folder.id)}
                                        className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeFolderId === folder.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        style={{ borderLeft: activeFolderId === folder.id ? `3px solid ${folder.color || '#F59E0B'}` : 'none' }}>
                                        <FolderOpen size={16} className="mr-2.5" style={{ color: folder.color || '#9CA3AF' }} />
                                        {folder.name}
                                    </button>
                                    {isAdmin && (
                                        <button onClick={e => handleDeleteTemplateFolder(folder.id, e)}
                                            className="absolute right-2 top-3 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Templates Grid with Recommendations */}
                        <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar">
                            {filterTaskType !== 'ALL' && recommendedTemplates.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Sparkles size={14} className="animate-pulse" />
                                        <h2 className="text-xs font-black uppercase tracking-widest">Recommended for {TASK_TYPE_LABELS[filterTaskType]}</h2>
                                        <div className="h-px flex-1 bg-indigo-500/20" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {recommendedTemplates.map((template, index) => (
                                            <TemplateCard 
                                                key={template.id} 
                                                template={template} 
                                                index={index} 
                                                isAdmin={isAdmin}
                                                onDelete={handleDeleteTemplate}
                                                onPreview={setPreviewTemplate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {filterTaskType !== 'ALL' && (
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <h2 className="text-[10px] font-bold uppercase tracking-widest">General Templates</h2>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {generalTemplates.map((template, index) => (
                                        <TemplateCard 
                                            key={template.id} 
                                            template={template} 
                                            index={index} 
                                            isAdmin={isAdmin}
                                            onDelete={handleDeleteTemplate}
                                            onPreview={setPreviewTemplate}
                                        />
                                    ))}
                                </div>
                            </div>

                            {filteredTemplates.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500">
                                    <FileCode size={48} className="mb-3 opacity-20" />
                                    <p className="font-medium">No templates found</p>
                                    <p className="text-sm">Try a different search or {isAdmin ? 'create a new template' : 'check back later'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/*  KNOWLEDGE BASE TAB                                      */}
            {/* ════════════════════════════════════════════════════════ */}
            {activeTab === 'knowledge' && (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="relative flex-1 w-full md:max-w-xs">
                            <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
                            <input type="text" placeholder="Search documents..."
                                className="w-full glass-input rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                                value={kbSearch} onChange={e => setKbSearch(e.target.value)} />
                        </div>
                        {isAdmin && (
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => setIsCategoryModalOpen(true)}
                                    className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center transition-all">
                                    <Plus size={14} className="mr-2" /> Folder
                                </button>
                                <button onClick={() => {
                                    setCurrentResource({ type: 'pdf', category: activeKbCategory === 'ALL' && kbCategories.length > 0 ? kbCategories[0].id : activeKbCategory, link: '', title: '', reviewDate: '' });
                                    setIsUploadMode(false); setIsResourceModalOpen(true);
                                }} className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center transition-all">
                                    <Plus size={14} className="mr-2" /> Resource
                                </button>
                            </div>
                        )}
                        <DocumentViewer isOpen={!!viewDoc} onClose={() => setViewDoc(null)}
                            url={viewDoc?.url || ''} type={viewDoc?.type || 'file'}
                            title={viewDoc?.title || ''} downloadUrl={viewDoc?.downloadUrl} />
                    </div>

                    {/* KB Content */}
                    <div className="flex flex-col lg:flex-row gap-5 overflow-hidden">
                        {/* Category sidebar */}
                        <div className="w-full lg:w-56 flex-shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2">
                            <button onClick={() => setActiveKbCategory('ALL')}
                                className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeKbCategory === 'ALL' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                <FolderOpen size={16} className="mr-2.5" /> All Resources
                            </button>
                            {kbCategories.map(cat => (
                                <div key={cat.id} className="relative group flex-shrink-0 lg:flex-shrink w-full">
                                    <button onClick={() => setActiveKbCategory(cat.id)}
                                        className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeKbCategory === cat.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        style={{ borderLeft: activeKbCategory === cat.id ? `3px solid ${cat.color || '#3B82F6'}` : 'none' }}>
                                        <FolderOpen size={16} className="mr-2.5" style={{ color: cat.color || '#6B7280' }} />
                                        {cat.label}
                                    </button>
                                    {isAdmin && (
                                        <button onClick={e => handleDeleteCategory(cat.id, e)}
                                            className="absolute right-2 top-3 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {kbCategories.length === 0 && !kbLoading && isAdmin && (
                                <button onClick={async () => { await KnowledgeService.seedDefaultCategories(); loadKbData(); }}
                                    className="w-full text-xs text-brand-400 hover:text-brand-300 underline py-2 text-center">
                                    Initialize Default Folders
                                </button>
                            )}
                        </div>

                        {/* Resources grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {kbLoading ? (
                                <div className="flex justify-center py-20"><Loader2 size={36} className="animate-spin text-brand-500" /></div>
                            ) : filteredResources.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                                    <FolderOpen size={48} className="mb-3 opacity-20" />
                                    <p className="font-medium">No resources found</p>
                                    <p className="text-sm">Try a different folder or {isAdmin ? 'add a new resource' : 'check back later'}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredResources.map(resource => (
                                        <div key={resource.id} onClick={() => handleOpenResource(resource)}
                                            className="bg-[#0d1117]/80 backdrop-blur-sm border border-white/[0.06] p-4 rounded-xl hover:border-white/[0.12] transition-all group relative cursor-pointer flex flex-col h-full hover:shadow-lg hover:shadow-black/20 hover:-translate-y-[1px]">
                                            <div className="flex items-start justify-between mb-2.5">
                                                <div className="p-2 bg-white/[0.04] rounded-lg border border-white/[0.06] group-hover:border-white/[0.12] transition-all">
                                                    {getResourceIcon(resource.type)}
                                                </div>
                                                <div className="flex space-x-2 items-center">
                                                    {resource.reviewDate && new Date(resource.reviewDate) < new Date() && (
                                                        <div className="flex items-center text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">
                                                            <AlertTriangle size={12} className="mr-1" /> Expired
                                                        </div>
                                                    )}
                                                    {isAdmin && (
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={e => handleEditResource(resource, e)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><FileText size={13} /></button>
                                                            <button onClick={e => handleDeleteResource(resource.id, e)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <h3 className="text-white font-semibold mb-1 line-clamp-2 min-h-[2.5rem] text-[13px] group-hover:text-amber-300 transition-colors">{resource.title}</h3>
                                            <div className="mt-auto pt-2 border-t border-white/[0.04] flex items-center justify-between">
                                                <span className="text-[9px] text-slate-600 uppercase tracking-wider">{new Date(resource.updatedAt).toLocaleDateString()}</span>
                                                <ExternalLink size={12} className="text-slate-700 group-hover:text-amber-400 transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════════════ */}

            {/* ── Template Create Modal ─────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white flex items-center uppercase tracking-tighter"><Plus size={20} className="mr-3 text-amber-400" /> {newTemplate.id ? 'Edit Template' : 'Create New Template'}</h3>
                            <button onClick={() => {
                                setIsModalOpen(false);
                                setNewTemplate({ 
                                    name: '', description: '', category: 'TASK', type: '', content: '',
                                    priority: 'MEDIUM', expectedDays: 7, taskType: undefined,
                                    tags: [], attachments: [], folderId: '', folderName: '' 
                                });
                            }} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Template Name</label>
                                    <input type="text" className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                        placeholder="e.g. Audit Checklist 2024" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Folder</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.folderId} onChange={e => {
                                            const f = folders.find(folder => folder.id === e.target.value);
                                            setNewTemplate({ ...newTemplate, folderId: e.target.value, folderName: f?.name });
                                        }}>
                                        <option value="">No Folder (Root)</option>
                                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value as any })}>
                                        <option value="TASK">Task</option>
                                        <option value="CHECKLIST">Checklist</option>
                                        <option value="DOCUMENT">Document</option>
                                        <option value="WORKFLOW">Workflow</option>
                                        <option value="REVIEWER_CHECKLIST">Reviewer Checklist</option>
                                    </select>
                                </div>
                                {newTemplate.category === 'REVIEWER_CHECKLIST' && (
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Reviewer Layer</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'TL', label: 'Team Leader', color: 'indigo' },
                                                { id: 'ER', label: 'Engagement Reviewer', color: 'purple' },
                                                { id: 'SP', label: 'Signing Partner', color: 'rose' }
                                            ].map(role => (
                                                <button
                                                    key={role.id}
                                                    type="button"
                                                    onClick={() => setNewTemplate({ ...newTemplate, reviewerRole: role.id as any })}
                                                    className={`p-3 rounded-xl border text-center transition-all ${
                                                        newTemplate.reviewerRole === role.id 
                                                            ? `bg-${role.color}-500/10 border-${role.color}-500 text-${role.color}-400 shadow-lg` 
                                                            : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <div className="text-[10px] font-black uppercase tracking-widest">{role.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Type / Tag</label>
                                    <input type="text" className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={newTemplate.type} onChange={e => setNewTemplate({ ...newTemplate, type: e.target.value })}
                                        placeholder="e.g. Tax" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Description</label>
                                    <textarea className="w-full glass-input rounded-lg px-3 py-2 text-sm" rows={3}
                                        value={newTemplate.description} onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                        placeholder="Briefly describe what this template is for..." />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Attachments</label>
                                    <div className="border-2 border-dashed border-white/20 rounded-xl p-4 hover:bg-white/5 transition-colors">
                                        <FileUploader maxSizeMB={20}
                                            onUploadComplete={fileData => {
                                                setNewTemplate(prev => ({ ...prev, attachments: [...prev.attachments, { id: fileData.id, name: fileData.name, url: fileData.url, type: 'FILE' }] }));
                                                toast.success('File attached');
                                            }}
                                            accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.csv" />
                                    </div>
                                    {newTemplate.attachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {newTemplate.attachments.map((att, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-lg text-sm">
                                                    <div className="flex items-center truncate">
                                                        {getTemplateIcon(att.name)}
                                                        <span className="ml-2 text-gray-300 truncate">{att.name}</span>
                                                    </div>
                                                    <button onClick={() => setNewTemplate(prev => ({ ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) }))} className="text-red-400"><Trash2 size={13} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Content / Instructions</label>
                                        <button type="button" onClick={() => setIsResearchOpen(true)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center">
                                            <Sparkles size={10} className="mr-1" /> Draft with AI
                                        </button>
                                    </div>
                                    <textarea className="w-full glass-input rounded-lg px-3 py-2 text-sm font-mono" rows={6}
                                        value={newTemplate.content} onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                        placeholder="Enter default content, JSON structure, or markdown guidelines..." />
                                </div>

                                {/* Prompt E: TaskType Selection Card Grid */}
                                <div className="col-span-2 border-t border-white/5 pt-4">
                                    <label className="block text-xs font-black text-gray-400 mb-3 uppercase tracking-widest">Target Engagement Type</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNewTemplate({ ...newTemplate, taskType: undefined })}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                                newTemplate.taskType === undefined
                                                    ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                                                    : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className={`p-2 rounded-lg ${newTemplate.taskType === undefined ? 'bg-black/20' : 'bg-white/5'}`}>
                                                <Activity size={16} />
                                            </div>
                                            <span className="text-[10px] font-bold">General</span>
                                        </button>
                                        {Object.values(TaskType).map((type) => {
                                            const isSelected = newTemplate.taskType === type;
                                            const IconComponent = {
                                                ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                            }[TASK_TYPE_ICONS[type]] || Activity;

                                            return (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setNewTemplate({ ...newTemplate, taskType: type })}
                                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/20'
                                                            : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:bg-white/[0.06]'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-white/5'}`}>
                                                        <IconComponent size={16} />
                                                    </div>
                                                    <span className="text-[10px] font-bold truncate w-full text-center">{TASK_TYPE_LABELS[type]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* SECTION 1: Phase-wise Subtasks */}
                                <div className="col-span-2 border-t border-white/5 pt-4">
                                    <button type="button" onClick={() => toggleSection('phases')}
                                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all group">
                                        <div className="flex items-center gap-2 text-amber-500">
                                            <ListTodo size={18} />
                                            <span className="text-sm font-black uppercase tracking-wider">Phase-wise Subtasks</span>
                                            <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full ml-2">
                                                {Object.values(phaseSubtasks).flat().length} items
                                            </span>
                                        </div>
                                        {expandedSections.phases ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedSections.phases && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="p-4 space-y-4">
                                                    <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
                                                        {(Object.values(AuditPhase)).map(phase => (
                                                            <button key={phase} type="button" onClick={() => setActivePhaseTab(phase)}
                                                                className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${activePhaseTab === phase ? 'bg-amber-500 text-black shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                                                {phase.replace(/_/g, ' ')}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="space-y-2">
                                                        {phaseSubtasks[activePhaseTab].map((item, idx) => (
                                                            <div key={idx} className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] group items-center">
                                                                <div className="flex-1">
                                                                    <input type="text" placeholder="Subtask title (e.g. Verify Client ID)" required
                                                                        className="w-full bg-transparent border-none text-sm text-white focus:ring-0 p-0 placeholder:text-gray-600 font-medium"
                                                                        value={item.title} onChange={e => updatePhaseSubtaskField(activePhaseTab, idx, 'title', e.target.value)} />
                                                                </div>
                                                                <button type="button" onClick={() => removePhaseSubtask(activePhaseTab, idx)} className="p-1.5 rounded-lg text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button type="button" onClick={() => addPhaseSubtask(activePhaseTab)}
                                                            className="flex items-center justify-center w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-white hover:bg-white/5 transition-all text-xs font-bold gap-2">
                                                            <Plus size={14} /> Add Subtask to {activePhaseTab.replace(/_/g, ' ')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* SECTION 2: Status-based Automation (Auto-Checklists) */}
                                <div className="col-span-2 border-t border-white/5 pt-4">
                                    <button type="button" onClick={() => toggleSection('statuses')}
                                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all group">
                                        <div className="flex items-center gap-2 text-purple-400">
                                            <Sparkles size={18} />
                                            <span className="text-sm font-black uppercase tracking-wider">Auto-Checklists on Status Change</span>
                                            <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full ml-2">
                                                {Object.values(statusSubtaskMap).flat().length} Automations
                                            </span>
                                        </div>
                                        {expandedSections.statuses ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedSections.statuses && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="p-4 space-y-3">
                                                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 mb-4 flex gap-3 items-start">
                                                        <AlertTriangle size={14} className="text-purple-400 mt-0.5" />
                                                        <div>
                                                            <p className="text-[10px] text-purple-300 font-black uppercase tracking-widest mb-1">What is this?</p>
                                                            <p className="text-[11px] text-purple-200/60 leading-relaxed">
                                                                Define subtasks that <b>automatically appear</b> when a task moves to a specific status. 
                                                                <br/><i>Example: When moving to "Under Review", automatically add "Partner Sign-off Required".</i>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {[TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED].map(status => (
                                                        <div key={status} className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.01]">
                                                            <button type="button" onClick={() => toggleStatusAccordion(status)}
                                                                className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                                    When status becomes: {status.replace(/_/g, ' ')}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[9px] font-bold text-gray-600">{(statusSubtaskMap[status] || []).length} items</span>
                                                                    {openStatusAccordions.includes(status) ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
                                                                </div>
                                                            </button>
                                                            
                                                            {openStatusAccordions.includes(status) && (
                                                                <div className="p-3 bg-black/10 space-y-2">
                                                                    {(statusSubtaskMap[status] || []).map((item, idx) => (
                                                                        <div key={idx} className="flex gap-2 items-center bg-white/[0.03] p-2 px-3 rounded-lg border border-white/5">
                                                                            <div className="flex-1">
                                                                                <input type="text" placeholder="Checklist item (e.g. Verify Sign-offs)"
                                                                                    className="w-full bg-transparent border-none text-[11px] text-white focus:ring-0 p-0 placeholder:text-gray-600 font-medium"
                                                                                    value={item.title} onChange={e => updateStatusSubtaskField(status, idx, 'title', e.target.value)} />
                                                                            </div>
                                                                            <button type="button" onClick={() => removeStatusSubtask(status, idx)} className="text-gray-600 hover:text-rose-500 p-1">
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button type="button" onClick={() => addStatusSubtask(status)}
                                                                        className="w-full py-1.5 rounded-lg border border-dashed border-white/5 text-[9px] font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                                                                        + Add Automation Task
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-between items-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">{isSubmitting ? 'Processing request...' : 'Ready to save'}</div>
                            <div className="flex space-x-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-black text-gray-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">Cancel</button>
                                <button 
                                    onClick={handleCreateTemplate} 
                                    disabled={isSubmitting}
                                    className="bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-2.5 rounded-xl text-xs font-black hover:bg-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-all transform hover:-translate-y-0.5 active:scale-95 uppercase tracking-widest flex items-center"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                                    {newTemplate.id ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 animate-in fade-in duration-300">
                    <div className="glass-modal rounded-[32px] w-full max-w-4xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">
                        <div className="px-10 py-8 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center tracking-tighter uppercase">
                                    <Book size={24} className="mr-4 text-amber-500" /> {previewTemplate.name}
                                </h3>
                                <div className="flex gap-3 mt-3">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/20">{previewTemplate.category}</span>
                                    {previewTemplate.category === 'REVIEWER_CHECKLIST' && previewTemplate.reviewerRole && (
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            previewTemplate.reviewerRole === 'TL' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                                            previewTemplate.reviewerRole === 'ER' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                            'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                        }`}>
                                            Role: {previewTemplate.reviewerRole === 'TL' ? 'Team Lead' : previewTemplate.reviewerRole === 'ER' ? 'Engagement Reviewer' : 'Signing Partner'}
                                        </span>
                                    )}
                                    {previewTemplate.taskType && (
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                                            {(() => {
                                                const Icon = {
                                                    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                                }[TASK_TYPE_ICONS[previewTemplate.taskType]] || Activity;
                                                return <Icon size={12} />;
                                            })()}
                                            {TASK_TYPE_LABELS[previewTemplate.taskType]}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setPreviewTemplate(null)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-xl"><X size={24} /></button>
                        </div>
                        
                        <div className="p-10 overflow-y-auto custom-scrollbar space-y-10 bg-[#080a0c]">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <div className="w-1 h-3 bg-amber-500 rounded-full" /> Description
                                        </h4>
                                        <p className="text-gray-300 leading-relaxed text-sm font-medium">{previewTemplate.description || 'No description provided for this template.'}</p>
                                    </div>

                                    {previewTemplate.content && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-3 bg-amber-500 rounded-full" /> Guidelines & Instructions
                                            </h4>
                                            <div className="bg-white/[0.02] p-6 rounded-[24px] border border-white/5 font-mono text-sm text-gray-400 whitespace-pre-wrap leading-relaxed shadow-inner">
                                                {previewTemplate.content}
                                            </div>
                                        </div>
                                    )}

                                    {/* PHASE-WISE SUBTASKS VIEW */}
                                    {previewTemplate.subtaskDetails && previewTemplate.subtaskDetails.length > 0 && (
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-3 bg-brand-500 rounded-full" /> SOP Protocol Details
                                            </h4>
                                            
                                            <div className="space-y-8">
                                                {Object.values(AuditPhase).map(phase => {
                                                    const phaseTasks = (previewTemplate as any).subtaskDetails?.filter((st: any) => st.phase === phase);
                                                    if (!phaseTasks || phaseTasks.length === 0) return null;

                                                    return (
                                                        <div key={phase} className="space-y-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                                    {phase.replace(/_/g, ' ')}
                                                                </div>
                                                                <div className="h-px flex-1 bg-white/[0.05]" />
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {phaseTasks.map((st: any, i: number) => (
                                                                    <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-start gap-4">
                                                                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 text-xs font-black shadow-inner">
                                                                            {i + 1}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <p className="text-sm font-bold text-white uppercase tracking-tight">{st.title}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-10">
                                    {/* ATTACHMENTS */}
                                    {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-3 bg-amber-500 rounded-full" /> Reference Files
                                            </h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {previewTemplate.attachments.map((att: any, i: number) => (
                                                    <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                                        className="flex items-center p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-amber-500/30 transition-all group overflow-hidden relative shadow-sm">
                                                        <div className="mr-4 p-3 bg-black/40 rounded-xl group-hover:bg-amber-500/20 transition-colors shadow-inner">{getTemplateIcon(att.name)}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-black text-gray-200 truncate group-hover:text-white uppercase tracking-tight transition-colors">{att.name}</p>
                                                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">Click to preview</p>
                                                        </div>
                                                        <ExternalLink size={14} className="text-gray-600 group-hover:text-amber-400 transition-colors" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* WORKFLOW STATUS MAPPING */}
                                    {previewTemplate.statusSubtasks && Object.values(previewTemplate.statusSubtasks).some((tasks: any) => tasks.length > 0) && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-3 bg-purple-500 rounded-full" /> Status Hooks
                                            </h4>
                                            <div className="space-y-3">
                                                {Object.entries(previewTemplate.statusSubtasks).map(([status, tasks]: [string, any]) => {
                                                    if (tasks.length === 0) return null;
                                                    return (
                                                        <div key={status} className="p-4 rounded-[20px] bg-white/[0.02] border border-white/[0.04]">
                                                            <div className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-3">{status.replace(/_/g, ' ')}</div>
                                                            <div className="space-y-2">
                                                                {tasks.map((t: any, i: number) => (
                                                                    <div key={i} className="flex items-center gap-3">
                                                                        <div className="w-1 h-1 rounded-full bg-purple-500/40" />
                                                                        <p className="text-[11px] font-medium text-gray-400">{t.title}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <div className="w-1 h-3 bg-gray-500 rounded-full" /> Details
                                        </h4>
                                        <div className="bg-white/[0.02] rounded-[24px] border border-white/5 p-6 space-y-6">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-600 font-bold uppercase">Priority</span>
                                                <span className={`font-black uppercase tracking-widest ${
                                                    previewTemplate.priority === 'HIGH' ? 'text-rose-400' :
                                                    previewTemplate.priority === 'MEDIUM' ? 'text-amber-400' : 'text-brand-400'
                                                }`}>{previewTemplate.priority}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-600 font-bold uppercase">Est. Duration</span>
                                                <span className="text-gray-300 font-black uppercase tracking-widest">{previewTemplate.expectedDays} Days</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-600 font-bold uppercase">Usage Frequency</span>
                                                <span className="text-amber-500 font-black flex items-center gap-2"><Star size={12} /> {previewTemplate.usageCount || 0} Uses</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-white/10 bg-white/5 flex justify-end gap-4">
                            <button onClick={() => setPreviewTemplate(null)} className="px-8 py-3 rounded-2xl text-xs font-black text-gray-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">Close Preview</button>
                            {isAdmin && (
                                <button onClick={() => { handleEditTemplate(previewTemplate); setPreviewTemplate(null); }}
                                    className="bg-white/10 hover:bg-white/[0.15] text-white px-8 py-3 rounded-2xl text-xs font-black transition-all flex items-center uppercase tracking-widest border border-white/10">
                                    <Edit2 size={16} className="mr-3" /> Edit Master
                                </button>
                            )}
                            <button onClick={() => { handleUseTemplate(previewTemplate); setPreviewTemplate(null); }}
                                className="bg-amber-600 text-black px-10 py-3 rounded-2xl text-xs font-black hover:bg-amber-500 shadow-[0_15px_40px_rgba(245,158,11,0.25)] flex items-center transition-all transform hover:-translate-y-0.5 active:scale-95 uppercase tracking-widest">
                                <Copy size={16} className="mr-3" /> Deploy Protocol
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Resource Add/Edit Modal ───────────────────────────────────────── */}
            {isResourceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-lg flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">{currentResource.id ? 'Edit Resource' : 'Add New Resource'}</h3>
                            <button onClick={() => setIsResourceModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResourceSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
                                <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentResource.title || ''} onChange={e => setCurrentResource({ ...currentResource, title: e.target.value })}
                                    placeholder="e.g. Audit Standard 2024" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Review / Expiry Date</label>
                                <input type="date" className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentResource.reviewDate || ''} onChange={e => setCurrentResource({ ...currentResource, reviewDate: e.target.value })}
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Leave empty if document does not expire.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Folder</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={currentResource.category} onChange={e => setCurrentResource({ ...currentResource, category: e.target.value })}>
                                        <option value="" disabled>Select Folder</option>
                                        {kbCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={currentResource.type} onChange={e => setCurrentResource({ ...currentResource, type: e.target.value as any })}>
                                        <option value="pdf">PDF Document</option>
                                        <option value="sheet">Excel Sheet</option>
                                        <option value="doc">Word Doc</option>
                                        <option value="image">Image</option>
                                        <option value="article">Link / Article</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Content Source</label>
                                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 mb-3 w-fit">
                                    <button type="button" onClick={() => setIsUploadMode(false)}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${!isUploadMode ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        External Link
                                    </button>
                                    <button type="button" onClick={() => setIsUploadMode(true)}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${isUploadMode ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        Upload File
                                    </button>
                                </div>
                                {isUploadMode ? (
                                    <div className="border-2 border-dashed border-white/10 rounded-xl p-4 hover:border-brand-500/50 transition-colors">
                                        <FileUploader maxSizeMB={20}
                                            onUploadComplete={fileData => setCurrentResource({ ...currentResource, title: currentResource.title || fileData.name, link: fileData.url, type: fileData.type as any, fileId: fileData.id, downloadUrl: StorageService.getDownloadUrl(fileData.id) })}
                                            accept={currentResource.type === 'pdf' ? '.pdf,application/pdf' : currentResource.type === 'image' ? 'image/*' : '.doc,.docx,.xls,.xlsx,.ppt,.pptx'} />
                                        {currentResource.fileId && <div className="mt-2 text-xs text-green-400 flex items-center"><FileText size={12} className="mr-1" /> File uploaded successfully</div>}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input required={!isUploadMode} className="w-full glass-input rounded-lg pl-9 pr-3 py-2 text-sm"
                                            value={currentResource.link || ''} onChange={e => setCurrentResource({ ...currentResource, link: e.target.value })}
                                            placeholder="https://drive.google.com/..." />
                                        <ExternalLink size={13} className="absolute left-3 top-2.5 text-gray-500" />
                                    </div>
                                )}
                            </div>
                            <div className="pt-3 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsResourceModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                                    {currentResource.id ? 'Update' : 'Add Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── New Folder Modal ──────────────────────────────────────────────── */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-md flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">New Folder</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Folder Name <span className="text-red-400">*</span></label>
                                <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentCategory.label || ''} onChange={e => setCurrentCategory({ ...currentCategory, label: e.target.value })}
                                    placeholder="e.g. Audit Reports" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Folder Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {DEFAULT_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setCurrentCategory({ ...currentCategory, color })}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${currentCategory.color === color ? 'border-white ring-2 ring-white/20' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}>
                                            {currentCategory.color === color && <Check size={13} className="text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-3 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── New Template Folder Modal ───────────────────────────────────────── */}
            {isTemplateFolderModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-md flex flex-col shadow-2xl border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">New Template Folder</h3>
                            <button onClick={() => setIsTemplateFolderModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateTemplateFolder} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Folder Name <span className="text-red-400">*</span></label>
                                <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                    value={currentTemplateFolder.name || ''} onChange={e => setCurrentTemplateFolder({ ...currentTemplateFolder, name: e.target.value })}
                                    placeholder="e.g. Onboarding Templates" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Folder Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {DEFAULT_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setCurrentTemplateFolder({ ...currentTemplateFolder, color })}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${currentTemplateFolder.color === color ? 'border-white ring-2 ring-white/20' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}>
                                            {currentTemplateFolder.color === color && <Check size={13} className="text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-3 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsTemplateFolderModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center shadow-lg transition-all">
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── AI Research Assistant ─────────────────────────────────────────── */}
            <ResearchAssistant isOpen={isResearchOpen} onClose={() => setIsResearchOpen(false)}
                context={`Current Template Draft: ${JSON.stringify(newTemplate)}`} />
        </div>
    );
};

export default TemplatesPage;
