
import React, { useState, useEffect } from 'react';
import { Folder, FileText, Search, ExternalLink, Download, Grid, List, BookOpen, Shield, Calculator, FileCheck, Users, Eye, X, Mail, Sparkles, Send, Bot, Plus } from 'lucide-react';
import { AIService } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { UserRole, Resource } from '../types';
import { AuthService } from '../services/firebase';

const CATEGORIES = [
    { id: 'All', icon: Grid, label: 'All Resources' },
    { id: 'Audit', icon: Shield, label: 'Audit & Assurance' },
    { id: 'Tax', icon: Calculator, label: 'Taxation' },
    { id: 'HR', icon: Users, label: 'Human Resources' }, 
    { id: 'Compliance', icon: FileCheck, label: 'Legal & Compliance' },
];

// Helper Icon Component
const ResourceIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'folder': return <Folder className="text-yellow-400 fill-yellow-400/20" size={40} />;
        case 'pdf': return <FileText className="text-red-400" size={40} />;
        case 'sheet': return <FileText className="text-green-400" size={40} />;
        case 'doc': return <FileText className="text-blue-400" size={40} />;
        default: return <FileText className="text-gray-400" size={40} />;
    }
};

const ResourcesPage: React.FC = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Viewer State
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  
  // AI Chat State
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isResearching, setIsResearching] = useState(false);

  // Add Resource Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newResource, setNewResource] = useState<Partial<Resource>>({
      title: '', type: 'folder', category: 'Audit', link: ''
  });

  useEffect(() => {
      loadResources();
  }, []);

  const loadResources = async () => {
      const data = await AuthService.getAllResources();
      setResources(data);
  };

  const filteredResources = resources.filter(res => {
      const matchCat = selectedCategory === 'All' || res.category === selectedCategory;
      const matchSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
  });

  const handleOpenResource = (res: Resource) => {
      if (res.type === 'folder') {
          window.open(res.link, '_blank');
      } else {
          setPreviewResource(res);
          setShowAiPanel(false);
          setAiResponse('');
          setAiQuery('');
      }
  };

  const handleOpenDriveAccess = () => {
      window.open('mailto:anil99sunar@gmail.com?subject=Request Access to RSA Master Drive', '_blank');
  };

  const handleAskAI = async () => {
      if (!aiQuery.trim() || !previewResource) return;
      setIsResearching(true);
      const response = await AIService.researchConcept(previewResource.title, aiQuery);
      setAiResponse(response);
      setIsResearching(false);
  };

  const handleAddResource = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newResource.title || !newResource.link) return;
      
      const res: Resource = {
          id: '',
          title: newResource.title,
          type: newResource.type as any,
          category: newResource.category || 'Audit',
          link: newResource.link,
          updatedAt: new Date().toISOString().split('T')[0]
      };
      
      await AuthService.addResource(res);
      await loadResources();
      setIsAddModalOpen(false);
      setNewResource({ title: '', type: 'folder', category: 'Audit', link: '' });
  };

  return (
    <div className="flex h-full gap-6 animate-in fade-in duration-500">
        {/* Sidebar Categories */}
        <div className="hidden md:flex flex-col w-64 glass-panel rounded-2xl p-4 shrink-0 h-full">
            <h2 className="text-lg font-bold text-white px-4 mb-6 flex items-center">
                <BookOpen className="mr-2 text-blue-400" size={20}/> Library
            </h2>
            <div className="space-y-1">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                            selectedCategory === cat.id 
                            ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <cat.icon size={18} />
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>
            
            <div className="mt-auto p-4 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/10">
                <p className="text-xs text-blue-200 font-semibold mb-2">Google Drive Access</p>
                <p className="text-[10px] text-gray-300 mb-3 leading-relaxed">
                   For knowledge & Resources, please connect <span className="text-white font-medium select-all">anil99sunar@gmail.com</span> for google drive.
                </p>
                <button 
                    onClick={handleOpenDriveAccess}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors flex items-center justify-center"
                >
                    <Mail size={12} className="mr-2"/> Contact Admin
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-2.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <input 
                        className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm"
                        placeholder="Search resources..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="flex items-center gap-3">
                    {user?.role === UserRole.ADMIN && (
                         <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center"
                         >
                             <Plus size={16} className="mr-2"/> Add Resource
                         </button>
                    )}
                    <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Grid size={18}/>
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <List size={18}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredResources.map(res => (
                            <div key={res.id} onClick={() => handleOpenResource(res)} className="glass-panel p-5 rounded-xl group hover:bg-white/10 transition-all cursor-pointer border border-white/5 hover:border-blue-500/30 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <ResourceIcon type={res.type} />
                                    <button className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye size={18} />
                                    </button>
                                </div>
                                <h3 className="text-sm font-semibold text-gray-200 mb-1 group-hover:text-blue-300 transition-colors line-clamp-2">{res.title}</h3>
                                <div className="mt-auto flex justify-between items-center text-[10px] text-gray-500 pt-3">
                                    <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">{res.category}</span>
                                    <span>{res.updatedAt}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-panel rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-white/5 text-gray-400 uppercase text-xs border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Last Updated</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredResources.map(res => (
                                    <tr key={res.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenResource(res)}>
                                        <td className="px-6 py-4 flex items-center">
                                            <div className="mr-3 scale-75 origin-left"><ResourceIcon type={res.type} /></div>
                                            <span className="font-medium text-white">{res.title}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-white/10 px-2 py-1 rounded text-xs border border-white/5">{res.category}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-xs">{res.updatedAt}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenResource(res); }} className="text-blue-400 hover:text-blue-300 text-xs font-medium border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors flex items-center ml-auto">
                                                <Eye size={14} className="mr-1"/> Preview
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

        {/* Add Resource Modal (Admin Only) */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-lg border border-white/10">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-lg font-bold text-white font-heading">Add New Resource</h3>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
                    </div>
                    
                    <form onSubmit={handleAddResource} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Resource Title</label>
                            <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.title} onChange={e => setNewResource({...newResource, title: e.target.value})} placeholder="e.g. Audit Guidelines 2024" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Type</label>
                                <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.type} onChange={e => setNewResource({...newResource, type: e.target.value as any})}>
                                    <option value="folder">Google Drive Folder</option>
                                    <option value="pdf">PDF Document</option>
                                    <option value="doc">Word Document</option>
                                    <option value="sheet">Excel Sheet</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Category</label>
                                <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.category} onChange={e => setNewResource({...newResource, category: e.target.value})}>
                                    <option value="Audit">Audit</option>
                                    <option value="Tax">Tax</option>
                                    <option value="HR">HR</option>
                                    <option value="Compliance">Compliance</option>
                                    <option value="Management">Management</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Google Drive Link / URL</label>
                            <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={newResource.link} onChange={e => setNewResource({...newResource, link: e.target.value})} placeholder="https://drive.google.com/..." />
                            <p className="text-[10px] text-gray-500 mt-1">Paste the shareable link from Google Drive here.</p>
                        </div>
                        
                        <div className="pt-2">
                            <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg">
                                Save Resource
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Document Preview & AI Modal */}
        {previewResource && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className={`glass-modal h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${showAiPanel ? 'w-[95%] max-w-7xl' : 'w-full max-w-6xl'}`}>
                    
                    {/* Modal Header */}
                    <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                        <div className="flex items-center space-x-3">
                            <ResourceIcon type={previewResource.type} />
                            <div>
                                <h3 className="text-lg font-bold text-white">{previewResource.title}</h3>
                                <p className="text-xs text-gray-400">Internal Viewer</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                             <button
                                onClick={() => setShowAiPanel(!showAiPanel)}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showAiPanel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-purple-300 hover:bg-purple-500/10'}`}
                             >
                                <Sparkles size={16} />
                                <span>AI Assistant</span>
                             </button>
                             <div className="h-6 w-px bg-white/10 mx-2"></div>
                             <a 
                                href={previewResource.link} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                title="Open in New Tab"
                             >
                                <ExternalLink size={20} />
                             </a>
                            <button 
                                onClick={() => setPreviewResource(null)} 
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24}/>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Main Content (Iframe) */}
                        <div className={`flex-1 bg-white relative transition-all duration-300 ${showAiPanel ? 'w-2/3' : 'w-full'}`}>
                            <iframe 
                                src={previewResource.link} 
                                className="w-full h-full border-none"
                                title="Resource Preview"
                            />
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-500 text-center pointer-events-none -z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-2"></div>
                                Loading Preview...
                            </div>
                        </div>

                        {/* AI Panel */}
                        {showAiPanel && (
                            <div className="w-96 border-l border-white/10 bg-navy-900/90 flex flex-col animate-in slide-in-from-right duration-300">
                                <div className="p-4 border-b border-white/10 bg-purple-900/10">
                                    <h4 className="text-purple-300 font-bold flex items-center text-sm">
                                        <Bot size={16} className="mr-2"/> Research Assistant
                                    </h4>
                                    <p className="text-[10px] text-gray-400 mt-1">Ask questions about concepts in this document. I'll search online for context.</p>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {aiResponse ? (
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                                            <div className="mt-2 text-[10px] text-gray-500 flex justify-end">Powered by Gemini & Google Search</div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                                            <Sparkles size={48} className="mb-2"/>
                                            <p className="text-xs text-center px-6">Ask me to explain tax laws, auditing standards, or specific terms found in the document.</p>
                                        </div>
                                    )}
                                    {isResearching && (
                                        <div className="flex items-center space-x-2 text-purple-300 text-xs animate-pulse">
                                            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                            <span>Researching internet sources...</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-white/10 bg-navy-900">
                                    <div className="relative">
                                        <input 
                                            className="w-full bg-navy-800 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                            placeholder="Ask about a concept..."
                                            value={aiQuery}
                                            onChange={(e) => setAiQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                                        />
                                        <button 
                                            onClick={handleAskAI}
                                            disabled={isResearching || !aiQuery.trim()}
                                            className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ResourcesPage;
