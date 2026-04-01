import { 
    FileText, Search, Plus, Star, Copy, Trash2, 
    File, FileSpreadsheet, FileCode, CheckSquare, Sparkles, 
    ExternalLink, X, Library, BookOpen, Download, 
    FolderOpen, FileJson, FileType, Loader2, Palette, Check, AlertTriangle, ChevronDown, ChevronRight, ListTodo,
    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
    Template, UserRole, Resource, Category, TemplateFolder, AuditPhase, 
    TaskStatus, SubTask, TaskType, TASK_TYPE_LABELS, TASK_TYPE_ICONS 
} from '../types';
import { TemplateService } from '../services/templates';
import { KnowledgeService } from '../services/knowledge';
import { StorageService } from '../services/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUploader } from '../components/common/FileUploader';
import { DocumentViewer } from '../components/common/DocumentViewer';
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
    
    const [newTemplate, setNewTemplate] = useState({
        name: '', description: '', category: 'TASK', type: '', content: '',
        priority: 'MEDIUM', expectedDays: 7, taskType: undefined as TaskType | undefined,
        tags: [] as string[], attachments: [] as any[], folderId: '', folderName: ''
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
        if (!user || !newTemplate.name) return;
        try {
            // Flatten phase subtasks
            const subtaskDetails = Object.entries(phaseSubtasks).flatMap(([phase, tasks]) => 
                tasks.filter(t => t.title).map(t => ({ ...t, phase: phase as AuditPhase }))
            );

            const payload = {
                ...newTemplate,
                subtaskDetails,
                statusSubtasks: statusSubtaskMap,
                nextTemplateId,
                createdBy: user.uid
            };

            await TemplateService.createTemplate(payload as any);
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
            toast.success('Template created successfully');
            await loadTemplates();
        } catch { toast.error('Failed to create template'); }
    };

    const addPhaseSubtask = (phase: AuditPhase) => {
        const newItem = { title: '', minimumRequirement: '', assigneeRole: '', daysOffset: 0 };
        setPhaseSubtasks(prev => ({ ...prev, [phase]: [...(prev[phase] || []), newItem] }));
    };

    const removePhaseSubtask = (phase: AuditPhase, index: number) => {
        setPhaseSubtasks(prev => ({ ...prev, [phase]: prev[phase].filter((_, i) => i !== index) }));
    };

    const updatePhaseSubtaskField = (phase: AuditPhase, index: number, field: string, value: any) => {
        setPhaseSubtasks(prev => ({
            ...prev,
            [phase]: prev[phase].map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    const addStatusSubtask = (status: TaskStatus) => {
        const newItem = { title: '', minimumRequirement: '' };
        setStatusSubtaskMap(prev => ({ ...prev, [status]: [...(prev[status] || []), newItem] }));
    };

    const removeStatusSubtask = (status: TaskStatus, index: number) => {
        setStatusSubtaskMap(prev => ({ ...prev, [status]: prev[status].filter((_, i) => i !== index) }));
    };

    const updateStatusSubtaskField = (status: TaskStatus, index: number, field: string, value: any) => {
        setStatusSubtaskMap(prev => ({
            ...prev,
            [status]: prev[status].map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    const toggleSection = (section: keyof typeof expandedSections) => {
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
        if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet size={20} className="text-emerald-400" />;
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
            className="bg-[#0d1117]/80 backdrop-blur-sm border border-white/[0.06] p-4 rounded-xl hover:border-white/[0.12] transition-all group relative overflow-hidden flex flex-col h-full hover:shadow-lg hover:shadow-black/20 hover:-translate-y-[1px]"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-white/[0.04] rounded-lg border border-white/[0.06] group-hover:border-white/[0.12] transition-all">
                    {template.category === 'CHECKLIST' ? <CheckSquare className="text-amber-400" size={18} /> : 
                     template.category === 'TASK' ? <Activity className="text-indigo-400" size={18} /> :
                     <FileText className="text-cyan-400" size={18} />}
                </div>
                <div className="flex items-center space-x-2">
                    {template.taskType && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {(() => {
                                const Icon = {
                                    ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen
                                }[TASK_TYPE_ICONS[template.taskType]] || Activity;
                                return <Icon size={10} />;
                            })()}
                            {TASK_TYPE_LABELS[template.taskType]}
                        </div>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                        template.category === 'TASK' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        template.category === 'CHECKLIST' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        template.category === 'DOCUMENT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                        {template.category}
                    </span>
                    {isAdmin && (
                        <button onClick={() => onDelete(template.id!)} className="text-gray-600 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>
            <h3 className="font-semibold text-white text-sm mb-1 leading-snug">{template.name}</h3>
            <p className="text-[12px] text-slate-500 mb-3 line-clamp-2 flex-1">{template.description}</p>

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

            <div className="pt-2.5 border-t border-white/[0.04] mt-auto flex items-center justify-between">
                <div className="flex items-center space-x-1 text-[10px] text-slate-600">
                    <Star size={10} className="text-amber-500/60" />
                    <span>{template.usageCount || 0} uses</span>
                </div>
                <button onClick={() => onPreview(template)}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center transition-colors">
                    <ExternalLink size={11} className="mr-1" /> View & Use
                </button>
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
                            <h3 className="text-lg font-bold text-white flex items-center"><Plus size={16} className="mr-2 text-amber-400" /> Create New Template</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
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
                                    </select>
                                </div>
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
                                                            <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] group">
                                                                <div className="flex-1 space-y-2">
                                                                    <input type="text" placeholder="Subtask title (e.g. Verify Client ID)" required
                                                                        className="w-full bg-transparent border-none text-sm text-white focus:ring-0 p-0 placeholder:text-gray-600"
                                                                        value={item.title} onChange={e => updatePhaseSubtaskField(activePhaseTab, idx, 'title', e.target.value)} />
                                                                    <input type="text" placeholder="Min. requirement..."
                                                                        className="w-full bg-transparent border-none text-[11px] text-gray-500 focus:ring-0 p-0 placeholder:text-gray-700"
                                                                        value={item.minimumRequirement} onChange={e => updatePhaseSubtaskField(activePhaseTab, idx, 'minimumRequirement', e.target.value)} />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <select className="bg-white/5 border-none rounded-lg text-[10px] text-gray-400 focus:ring-0 py-1"
                                                                        value={item.assigneeRole} onChange={e => updatePhaseSubtaskField(activePhaseTab, idx, 'assigneeRole', e.target.value)}>
                                                                        <option value="">— Any —</option>
                                                                        {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                                                                    </select>
                                                                    <div className="relative">
                                                                        <input type="number" placeholder="Days" className="w-16 bg-white/5 border-none rounded-lg text-[10px] text-gray-400 focus:ring-0 py-1 pl-2 pr-6"
                                                                            value={item.daysOffset} onChange={e => updatePhaseSubtaskField(activePhaseTab, idx, 'daysOffset', parseInt(e.target.value) || 0)} />
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 font-bold uppercase pointer-events-none">Days</span>
                                                                    </div>
                                                                    <button type="button" onClick={() => removePhaseSubtask(activePhaseTab, idx)} className="p-1.5 rounded-lg text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
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

                                {/* SECTION 2: Auto-Subtasks by Status Transition */}
                                <div className="col-span-2 border-t border-white/5 pt-4">
                                    <button type="button" onClick={() => toggleSection('statuses')}
                                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all group">
                                        <div className="flex items-center gap-2 text-purple-500">
                                            <FileType size={18} />
                                            <span className="text-sm font-black uppercase tracking-wider">Status-Change Rules</span>
                                            <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full ml-2">
                                                {Object.values(statusSubtaskMap).flat().length} transition items
                                            </span>
                                        </div>
                                        {expandedSections.statuses ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedSections.statuses && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="p-4 space-y-2">
                                                    {[TaskStatus.IN_PROGRESS, TaskStatus.UNDER_REVIEW, TaskStatus.HALTED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED].map(status => (
                                                        <div key={status} className="border border-white/5 rounded-xl overflow-hidden">
                                                            <button type="button" onClick={() => toggleStatusAccordion(status)}
                                                                className="flex items-center justify-between w-full px-4 py-2 bg-black/20 hover:bg-black/30 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-2 h-2 rounded-full ${status === TaskStatus.COMPLETED ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">On transition to {status.replace(/_/g, ' ')}</span>
                                                                    <span className="text-[10px] text-gray-500 font-mono">({statusSubtaskMap[status]?.length || 0})</span>
                                                                </div>
                                                                {openStatusAccordions.includes(status) ? <ChevronDown size={12} className="text-gray-600" /> : <ChevronRight size={12} className="text-gray-600" />}
                                                            </button>
                                                            <AnimatePresence>
                                                                {openStatusAccordions.includes(status) && (
                                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-white/[0.01]">
                                                                        <div className="p-3 space-y-2">
                                                                            {statusSubtaskMap[status]?.map((item, idx) => (
                                                                                <div key={idx} className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] group">
                                                                                    <div className="flex-1 space-y-1">
                                                                                        <input type="text" placeholder="Inject subtask title..." className="w-full bg-transparent border-none text-xs text-white focus:ring-0 p-0 placeholder:text-gray-600 font-bold"
                                                                                            value={item.title} onChange={e => updateStatusSubtaskField(status as TaskStatus, idx, 'title', e.target.value)} />
                                                                                        <input type="text" placeholder="Requirement..." className="w-full bg-transparent border-none text-[10px] text-gray-500 focus:ring-0 p-0 placeholder:text-gray-700"
                                                                                            value={item.minimumRequirement} onChange={e => updateStatusSubtaskField(status as TaskStatus, idx, 'minimumRequirement', e.target.value)} />
                                                                                    </div>
                                                                                    <button type="button" onClick={() => removeStatusSubtask(status as TaskStatus, idx)} className="text-gray-600 hover:text-red-400 p-1">
                                                                                        <X size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                            <button type="button" onClick={() => addStatusSubtask(status as TaskStatus)}
                                                                                className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 pl-2">
                                                                                <Plus size={12} /> Add Rule for {status}
                                                                            </button>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* SECTION 3: Workflow Chain */}
                                <div className="col-span-2 border-t border-white/5 pt-4">
                                    <button type="button" onClick={() => toggleSection('workflow')}
                                        className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all group">
                                        <div className="flex items-center gap-2 text-emerald-500">
                                            <Copy size={18} />
                                            <span className="text-sm font-black uppercase tracking-wider">Workflow Chain</span>
                                            {nextTemplateId && <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full ml-2">Active</span>}
                                        </div>
                                        {expandedSections.workflow ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedSections.workflow && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="p-4 space-y-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Auto-trigger template on completion:</label>
                                                        <div className="flex gap-2">
                                                            <select className="flex-1 glass-input rounded-xl px-4 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-emerald-500"
                                                                value={nextTemplateId} onChange={e => setNextTemplateId(e.target.value)}>
                                                                <option value="">— None —</option>
                                                                {templates.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                                                                ))}
                                                            </select>
                                                            {nextTemplateId && (
                                                                <button type="button" onClick={() => setNextTemplateId('')} className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all">
                                                                    <X size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-300/70 leading-relaxed italic">
                                                            <Sparkles size={12} className="inline mr-1" />
                                                            When a task using this template is marked <strong>COMPLETED</strong>, the selected template's phase-1 subtasks will be automatically added to a new linked task.
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end space-x-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleCreateTemplate} className="bg-amber-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-amber-500 shadow-lg transition-all">
                                Create Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Template Preview Modal ────────────────────────────────────────── */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-2xl w-full max-w-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center"><FileText className="mr-2 text-amber-400" /> {previewTemplate.name}</h3>
                            <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-white transition-colors"><X size={22} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                            <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{previewTemplate.category}</span>
                                {previewTemplate.type && <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">{previewTemplate.type}</span>}
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Description</h4>
                                <p className="text-gray-300 leading-relaxed text-sm">{previewTemplate.description}</p>
                            </div>
                            {previewTemplate.content && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Content Preview</h4>
                                    <div className="bg-black/30 p-4 rounded-xl border border-white/10 font-mono text-sm text-gray-300 whitespace-pre-wrap max-h-56 overflow-y-auto">{previewTemplate.content}</div>
                                </div>
                            )}
                            {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Attachments</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {previewTemplate.attachments.map((att: any, i: number) => (
                                            <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                                className="flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group">
                                                <div className="mr-3 p-2 bg-white/5 rounded-lg text-amber-400">{getTemplateIcon(att.name)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-200 truncate group-hover:text-amber-300 transition-colors">{att.name}</p>
                                                    <p className="text-xs text-gray-500">Click to view</p>
                                                </div>
                                                <ExternalLink size={13} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                            <button onClick={() => setPreviewTemplate(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors">Close</button>
                            <button onClick={() => { handleUseTemplate(previewTemplate); setPreviewTemplate(null); }}
                                className="bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-500 shadow-lg flex items-center transition-all hover:-translate-y-0.5">
                                <Copy size={14} className="mr-2" /> Use Template
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
