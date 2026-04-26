import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Search, Filter, FileText, MoreVertical,
    Edit, Trash2, Phone, Mail, MapPin, BadgeCheck, Building2,
    Briefcase, Calendar, X, Save, ChevronDown, CheckCircle2, User,
    Download, FileSpreadsheet, AlertTriangle, ShieldCheck, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Client, UserRole, UserProfile, Task } from '../types';
import { AuthService } from '../services/firebase';
import { toast } from 'react-hot-toast';
import StaffSelect from '../components/StaffSelect';
import { SkeletonCard } from '../components/common/SkeletonCard';
import { getAvatarColor, getInitials } from '../utils/userUtils';

import { INITIAL_CLIENTS } from '../constants/initialClients';

const ClientsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const isStaff = user?.role === UserRole.STAFF;

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterService, setFilterService] = useState('ALL');
    const [filterAuditorFirm, setFilterAuditorFirm] = useState('ALL');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState<'BASIC' | 'CONTACT' | 'ASSIGNMENT' | 'PERMISSIONS'>('BASIC');
    const [permissionSaving, setPermissionSaving] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    // Form State
    const initialFormState: Partial<Client> = {
        name: '',
        code: '',
        serviceType: 'Statutory Audit',
        industry: 'Others',
        status: 'Active',
        category: 'A', // Default category
        email: '',
        phone: '',
        address: '',
        pan: '',
        contactPerson: '',
        auditorId: '',
        signingAuthorityId: '',
        signingAuthority: 'R. Sapkota & Associates' // Default
    };
    const [formData, setFormData] = useState<Partial<Client>>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedClients, fetchedStaff, fetchedTasks] = await Promise.all([
                AuthService.getAllClients(),
                AuthService.getAllUsers(),
                AuthService.getAllTasks()
            ]);
            setClients(fetchedClients);
            setStaffList(fetchedStaff);
            setTasks(fetchedTasks);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const handleSeedClients = async () => {
        if (!confirm(`Are you sure you want to seed ${INITIAL_CLIENTS.length} clients from the preset list? Duplicates will be skipped.`)) return;

        setIsSeeding(true);
        try {
            const result = await AuthService.seedClients(INITIAL_CLIENTS);
            toast.success(`Seeding Complete! Added: ${result.added}, Skipped: ${result.skipped}`);
            loadData();
        } catch (error) {
            console.error("Seeding failed:", error);
            toast.error("Failed to seed clients");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCode = formData.code;

        // Auto-generate code if empty
        if (!finalCode) {
            const existingCodes = clients.map(c => c.code).filter(c => c);

            // Try to find a numeric pattern
            const numbers = existingCodes.map(c => parseInt(c.replace(/\D/g, ''))).filter(n => !isNaN(n));
            const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

            // Format: C-001 or similar if no pattern, but let's try to infer or default
            // If most start with something, use it? For now, default to C-{number}
            finalCode = `C-${String(nextNum).padStart(3, '0')}`;
        }

        if (!formData.name) {
            toast.error('Name is required');
            return;
        }

        setIsSaving(true);
        try {
            // Sanitize data: Remove undefined/null values but KEEP empty strings (to allow clearing fields)
            const cleanData = Object.entries(formData).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            const clientData: Client = {
                ...cleanData,
                code: finalCode,
                updatedAt: new Date().toISOString()
            };

            if (editingId) {
                await AuthService.updateClient({ ...clientData, id: editingId });
                toast.success('Client updated successfully');
            } else {
                await AuthService.addClient(clientData as Client);
                toast.success('Client created successfully');
            }

            setIsModalOpen(false);
            setEditingId(null);
            setFormData(initialFormState);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error('Failed to save client: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (client: Client) => {
        setFormData(client);
        setEditingId(client.id);
        setActiveModalTab('BASIC');
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this client?')) return;
        try {
            await AuthService.deleteClient(id);
            toast.success('Client deleted');
            loadData();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const handleExport = async (type: 'pdf' | 'excel') => {
        const dataToExport = filteredClients;
        const dateStr = new Date().toISOString().split('T')[0];

        if (type === 'pdf') {
            const doc = new jsPDF();

            // ── Header Banner ──────────────────────────────────────────────
            doc.setFillColor(15, 23, 42); // Navy 900
            doc.rect(0, 0, 210, 48, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('R. SAPKOTA & ASSOCIATES', 105, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('Chartered Accountants  |  Kathmandu, Nepal', 105, 23, { align: 'center' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Client Directory Report', 105, 34, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 42, { align: 'center' });

            const tableColumn = ["Code", "Client Name", "PAN", "Focal Person", "Service", "Status"];
            const tableRows = dataToExport.map(client => [
                client.code,
                client.name,
                client.pan || '-',
                getAuditorName(client.auditorId),
                client.serviceType,
                client.status
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 55,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240] },
                headStyles: {
                    fillColor: [30, 41, 59], // Slate 800
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('R. Sapkota & Associates — Confidential', 14, doc.internal.pageSize.height - 10);
                doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
            }

            doc.save(`RSA_Clients_${dateStr}.pdf`);
            toast.success('PDF exported successfully');
        } else {
            // Excel Export
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'R. SAPKOTA & ASSOCIATES';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Clients', {
                pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
            });

            // Company Header
            sheet.mergeCells('A1:F1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'R. SAPKOTA & ASSOCIATES';
            titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            sheet.getRow(1).height = 32;

            sheet.mergeCells('A2:F2');
            const addrCell = sheet.getCell('A2');
            addrCell.value = 'Chartered Accountants  |  Kathmandu, Nepal';
            addrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF94A3B8' } };
            addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
            addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            sheet.getRow(2).height = 18;

            sheet.mergeCells('A3:F3');
            const reportTitleCell = sheet.getCell('A3');
            reportTitleCell.value = 'Client Directory Report';
            reportTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
            reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            sheet.getRow(3).height = 24;

            sheet.getRow(4).height = 8; // Spacer

            const COLS = [
                { header: 'Code', key: 'code', width: 12 },
                { header: 'Client Name', key: 'name', width: 40 },
                { header: 'PAN', key: 'pan', width: 15 },
                { header: 'Focal Person', key: 'focal', width: 25 },
                { header: 'Service Type', key: 'service', width: 25 },
                { header: 'Status', key: 'status', width: 12 },
            ];

            COLS.forEach((col, i) => {
                const column = sheet.getColumn(i + 1);
                column.key = col.key;
                column.width = col.width;
            });

            const headerRow = sheet.getRow(5);
            COLS.forEach((col, i) => {
                const cell = headerRow.getCell(i + 1);
                cell.value = col.header;
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            headerRow.height = 24;

            dataToExport.forEach((client, idx) => {
                sheet.addRow({
                    code: client.code,
                    name: client.name,
                    pan: client.pan || '-',
                    focal: getAuditorName(client.auditorId),
                    service: client.serviceType,
                    status: client.status
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RSA_Clients_${dateStr}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Excel exported successfully');
        }
    };

    // Filtering
    const filteredClients = clients.filter(c => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.pan?.includes(searchTerm);
        const matchesService = filterService === 'ALL' || c.serviceType === filterService;
        const matchesAuditor = filterAuditorFirm === 'ALL' || c.signingAuthority === filterAuditorFirm;
        const matchesCategory = filterCategory === 'ALL' || c.category === filterCategory;
        return matchesSearch && matchesService && matchesAuditor && matchesCategory;
    });

    const getAuditorName = (id?: string) => {
        if (!id) return 'Unassigned';
        return staffList.find(s => s.uid === id)?.displayName || 'Unknown';
    };

    // Helper to get display name (now fully static, but keeping function for consistency if needed)
    const getSigningAuthorityName = (client: Client) => {
        return client.signingAuthority || 'Not Specified';
    };

    const signingAuthorities = staffList.filter(s =>
        [UserRole.MASTER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(s.role)
    );

    const canEditClient = (client: Client) => {
        if (!user) return false;
        if (isAdmin || user.role === UserRole.MANAGER) return true;
        
        // Staff edit access
        if (isStaff) {
            return client.permittedStaff?.includes(user.uid);
        }

        return false;
    };

    return (
        <div className="min-h-full p-4 md:p-6 bg-transparent">
            <div className="space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap md:flex-row justify-between items-start md:items-center gap-4">
                <div className="min-w-full md:min-w-0">
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <Building2 className="mr-3 text-amber-400" /> Client Directory
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage audit clients, tax filings, and contact details</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    {!isStaff && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleExport('pdf')}
                                className="p-3 md:p-2.5 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-900/10"
                                title="Export PDF"
                            >
                                <FileText size={20} />
                            </button>
                            <button
                                onClick={() => handleExport('excel')}
                                className="p-3 md:p-2.5 rounded-xl text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-/10"
                                title="Export Excel"
                            >
                                <FileSpreadsheet size={20} />
                            </button>
                        </div>
                    )}
                    {!isStaff && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setFormData(initialFormState);
                                setActiveModalTab('BASIC');
                                setIsModalOpen(true);
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-5 md:px-4 py-3 md:py-2.5 rounded-xl font-bold flex items-center shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95 flex-1 md:flex-none justify-center"
                        >
                            <Plus size={18} className="mr-2" /> <span className="text-[13px] md:text-sm">Add Client</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-xl">
                <div className="relative w-full md:w-80 order-2 md:order-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search clients by name, code, or PAN..."
                        className="w-full pl-10 pr-4 py-3 md:py-2 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar order-1 md:order-2">
                    <select
                        className="bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 md:py-2 text-[12px] md:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="ALL">All Categories</option>
                        <option value="A">Category A</option>
                        <option value="B">Category B</option>
                        <option value="C">Category C</option>
                    </select>

                    <select
                        className="bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 md:py-2 text-[12px] md:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                    >
                        <option value="ALL">All Services</option>
                        <option value="Statutory Audit">Statutory Audit</option>
                        <option value="Tax Filing">Tax Filing</option>
                        <option value="Compliance Audit">Compliance Audit</option>
                        <option value="Internal Audit">Internal Audit</option>
                        <option value="Advisory Services">Advisory Services</option>
                        <option value="Bookkeeping">Bookkeeping</option>
                    </select>

                    <select
                        className="bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 md:py-2 text-[12px] md:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
                        value={filterAuditorFirm}
                        onChange={(e) => setFilterAuditorFirm(e.target.value)}
                    >
                        <option value="ALL">All Auditors</option>
                        <option value="R. Sapkota & Associates">R. Sapkota & Associates</option>
                        <option value="TN Acharya & Co.">TN Acharya & Co.</option>
                        <option value="Pankaj Thapa Associates">Pankaj Thapa Associates</option>
                        <option value="NP Sharma & Co.">NP Sharma & Co.</option>
                        <option value="Others">Others</option>
                    </select>
                </div>
            </div>

            {/* Client Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map((client, index) => {
                    const clientVisuals = getAvatarColor(client.id || client.name);
                    const bgGradient = `${clientVisuals.from} ${clientVisuals.to}`;

                    // Compute task counts
                    const clientTaskCount = tasks.filter(t => t.clientIds?.includes(client.id)).length;
                    const overdueCount = tasks.filter(t =>
                        t.clientIds?.includes(client.id) &&
                        t.status !== 'COMPLETED' &&
                        t.status !== 'ARCHIVED' &&
                        t.dueDate && new Date(t.dueDate) < new Date()
                    ).length;

                    // Compute Risk badge
                    const risks = client.riskAreas || [];
                    const hasCritical = risks.some(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
                    const hasMedium = risks.some(r => r.severity === 'MEDIUM');
                    const riskBadgeClass = hasCritical ? 'bg-red-500/20 text-red-400 border-red-500/30' : hasMedium ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : null;

                    return (
                        <div
                            key={client.id}
                            className={`glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-1`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Card Header with Fluid Gradient */}
                            <div className={`p-6 bg-gradient-to-br ${bgGradient} relative overflow-hidden`}>
                                {/* Abstract Shapes */}
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>

                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg backdrop-blur-md ${clientVisuals.bg} ${clientVisuals.text} border ${clientVisuals.border} group-hover:scale-110 transition-transform duration-500`}>
                                            {getInitials(client.name)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight tracking-tight group-hover:text-blue-200 transition-colors">
                                                {client.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white/70 font-mono border border-white/10 backdrop-blur-sm">
                                                    {client.code}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm font-bold uppercase tracking-wider ${client.status === 'Active'
                                                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                    }`}>
                                                    {client.status}
                                                </span>
                                                {client.category && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold border border-white/10 backdrop-blur-sm">
                                                        CAT {client.category}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Quick Stats Badges */}
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 border backdrop-blur-sm ${overdueCount > 0 ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-white/10 text-gray-300 border-white/10'}`}>
                                                    <CheckCircle2 size={10} />
                                                    {clientTaskCount} tasks {overdueCount > 0 && `· ${overdueCount} overdue`}
                                                </span>
                                                {riskBadgeClass && (
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 border backdrop-blur-sm font-bold uppercase ${riskBadgeClass}`}>
                                                        <AlertTriangle size={10} />
                                                        {hasCritical ? 'High Risk' : 'Elevated'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {(canEditClient(client) || isAdmin) && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col gap-1 transform translate-x-2 group-hover:translate-x-0">
                                            {canEditClient(client) && (
                                                <button
                                                    onClick={() => handleEdit(client)}
                                                    className="p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-md"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(client.id)}
                                                    className="p-2 hover:bg-rose-500/20 rounded-lg text-white/70 hover:text-rose-400 transition-colors backdrop-blur-md"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div
                                className="p-6 flex flex-col gap-4 bg-navy-900/40 backdrop-blur-sm cursor-pointer hover:bg-navy-800/50 transition-colors"
                                onClick={() => navigate(`/clients/${client.id}`)}
                            >
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                    <div className="flex items-start gap-3 group/item">
                                        <div className="mt-0.5 p-1.5 rounded-full bg-white/5 text-gray-400">
                                            <User size={12} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Focal Person</p>
                                            <p className="text-sm text-gray-200 font-medium">{getAuditorName(client.auditorId)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Last Activity</p>
                                        <p className="text-sm text-gray-300 font-mono tracking-tight">{client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : 'New'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                     <div className="flex items-center text-sm font-medium text-gray-400">
                                         <Briefcase size={14} className="mr-2" />
                                         <span className="truncate max-w-[150px]">{client.serviceType}</span>
                                     </div>
                                     <span className="text-xs text-brand-400 font-bold hover:underline">View Details →</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="glass-panel p-0 rounded-2xl overflow-hidden border border-white/5 h-[180px]">
                            <div className="h-24 bg-white/[0.03] animate-pulse relative overflow-hidden">
                                <div className="absolute inset-0 skeleton-pulse opacity-50" />
                            </div>
                            <div className="p-6">
                                <SkeletonCard lines={2} hasAvatar height={60} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filteredClients.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Building2 size={32} className="text-gray-600" />
                    </div>
                    <p className="text-xl font-bold text-white">No clients found</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
                        Try adjusting your filters or add a new client to the directory.
                    </p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 shadow-2xl flex flex-col">
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 backdrop-blur-md z-10">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                {editingId ? <Edit className="mr-2 text-amber-400" /> : <Plus className="mr-2 text-amber-400" />}
                                {editingId ? 'Edit Client' : 'New Client Profile'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tab Strip */}
                        <div className="flex px-6 pt-4 gap-6 border-b border-white/10 shrink-0 overflow-x-auto">
                            {(['BASIC', 'CONTACT', 'ASSIGNMENT', ...(editingId ? ['PERMISSIONS'] : [])] as const).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveModalTab(tab as any)}
                                    className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeModalTab === tab ? 'text-amber-400 border-amber-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                                >
                                    {tab === 'BASIC' ? 'Basic Info' : tab === 'CONTACT' ? 'Contact & Tax' : tab === 'PERMISSIONS' ? '🔐 Audit Docs Access' : 'Assignment'}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6 flex-1 overflow-y-auto">
                            {activeModalTab === 'BASIC' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Client Name <span className="text-red-400">*</span>
                                        </label>
                                        <input required type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Acme Corp Pvt Ltd" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Client Code <span className="text-[10px] text-gray-500">(Auto-generated if empty)</span>
                                        </label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm font-mono"
                                            value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. ACME-01 (Optional)" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Assignment Type</label>
                                        <div className="relative">
                                            <select className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={formData.serviceType} onChange={e => setFormData({ ...formData, serviceType: e.target.value as any })}>
                                                <option value="Statutory Audit">Statutory Audit</option>
                                                <option value="Tax Filing">Tax Filing</option>
                                                <option value="Compliance Audit">Compliance Audit</option>
                                                <option value="Internal Audit">Internal Audit</option>
                                                <option value="Advisory Services">Advisory Services</option>
                                                <option value="Bookkeeping">Bookkeeping</option>
                                                <option value="VAT Filing">VAT Filing</option>
                                                <option value="ITR Filing">ITR Filing</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Type</label>
                                        <div className="relative">
                                            <select className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value as any })}>
                                                <option value="Airlines">Airlines</option>
                                                <option value="Consulting">Consulting</option>
                                                <option value="Co-operatives">Co-operatives</option>
                                                <option value="Courier">Courier</option>
                                                <option value="Education">Education</option>
                                                <option value="Hotel & Restaurant">Hotel & Restaurant</option>
                                                <option value="Hydropower">Hydropower</option>
                                                <option value="Investment">Investment</option>
                                                <option value="IT Consulting">IT Consulting</option>
                                                <option value="Joint Venture">Joint Venture</option>
                                                <option value="Manufacturing">Manufacturing</option>
                                                <option value="NGO/INGO">NGO/INGO</option>
                                                <option value="NPO">NPO</option>
                                                <option value="Securities Broker">Securities Broker</option>
                                                <option value="Trading">Trading</option>
                                                <option value="Others">Others</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Auditor (Signing Authority)</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            <select
                                                className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={['R. Sapkota & Associates', 'TN Acharya & Co.', 'Pankaj Thapa Associates', 'NP Sharma & Co.'].includes(formData.signingAuthority || '') ? formData.signingAuthority : 'Others'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'Others') {
                                                        setFormData({ ...formData, signingAuthority: '', signingAuthorityId: '' });
                                                    } else {
                                                        setFormData({ ...formData, signingAuthority: val, signingAuthorityId: '' });
                                                    }
                                                }}
                                            >
                                                <option value="R. Sapkota & Associates">R. Sapkota & Associates</option>
                                                <option value="TN Acharya & Co.">TN Acharya & Co.</option>
                                                <option value="Pankaj Thapa Associates">Pankaj Thapa Associates</option>
                                                <option value="NP Sharma & Co.">NP Sharma & Co.</option>
                                                <option value="Others">Others (Manual Entry)</option>
                                            </select>
                                            {(!['R. Sapkota & Associates', 'TN Acharya & Co.', 'Pankaj Thapa Associates', 'NP Sharma & Co.'].includes(formData.signingAuthority || '') || formData.signingAuthority === '') && (
                                                <input
                                                    type="text"
                                                    placeholder="Enter Auditor Name"
                                                    className="w-full glass-input rounded-lg px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2"
                                                    value={formData.signingAuthority}
                                                    onChange={e => setFormData({ ...formData, signingAuthority: e.target.value, signingAuthorityId: '' })}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}

                            {activeModalTab === 'CONTACT' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">Contact & Tax Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">PAN Number</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.pan} onChange={e => setFormData({ ...formData, pan: e.target.value })} placeholder="9-digit PAN" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Contact Person</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Phone Number</label>
                                        <input type="tel" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
                                        <input type="email" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Office Address</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            )}

                            {activeModalTab === 'ASSIGNMENT' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">Internal Focal Person</h3>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Assigned Internal Focal Person</label>
                                    <StaffSelect
                                        users={staffList}
                                        value={formData.auditorId}
                                        onChange={(val) => setFormData({ ...formData, auditorId: val as string })}
                                        placeholder="Select Lead Auditor..."
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="status" checked={formData.status === 'Active'} onChange={() => setFormData({ ...formData, status: 'Active' })} className="accent-blue-500" />
                                            <span className="text-sm text-gray-300">Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="status" checked={formData.status === 'Inactive'} onChange={() => setFormData({ ...formData, status: 'Inactive' })} className="accent-red-500" />
                                            <span className="text-sm text-gray-300">Inactive</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Compliance Settings */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">Compliance Services</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center space-x-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.vatReturn || false}
                                            onChange={(e) => setFormData({ ...formData, vatReturn: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 bg-gray-700"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-gray-200">VAT Returns</span>
                                            <span className="block text-xs text-gray-500">Auto-reminders on 25th</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.itrReturn || false}
                                            onChange={(e) => setFormData({ ...formData, itrReturn: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 bg-gray-700"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-gray-200">Income Tax (ITR)</span>
                                            <span className="block text-xs text-gray-500">Enable ITR Filing</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            </div>
                            )}

                            {activeModalTab === 'PERMISSIONS' && editingId && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ShieldCheck size={16} /> Audit Documentation Access
                                </h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Select which staff members can <span className="text-white font-semibold">view audit documentation</span> for this client. Staff will see this client in their Audit Docs page in read-only mode.
                                </p>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1 mt-3">
                                    {staffList.filter(s => s.role === UserRole.STAFF).map(staff => {
                                        const client = clients.find(c => c.id === editingId);
                                        const isPermitted = client?.permittedStaff?.includes(staff.uid) || false;
                                        return (
                                            <button
                                                key={staff.uid}
                                                type="button"
                                                disabled={permissionSaving}
                                                onClick={async () => {
                                                    setPermissionSaving(true);
                                                    const currentPerms = client?.permittedStaff || [];
                                                    const newPerms = isPermitted
                                                        ? currentPerms.filter(id => id !== staff.uid)
                                                        : [...currentPerms, staff.uid];
                                                    try {
                                                        await AuthService.updateClientPermissions(editingId, newPerms);
                                                        setClients(prev => prev.map(c => c.id === editingId ? { ...c, permittedStaff: newPerms } : c));
                                                        toast.success(`${isPermitted ? 'Removed' : 'Granted'} access for ${staff.displayName}`);
                                                    } catch {
                                                        toast.error('Failed to update permissions');
                                                    } finally {
                                                        setPermissionSaving(false);
                                                    }
                                                }}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                                                    isPermitted
                                                        ? 'bg-amber-500/10 border-amber-500/30'
                                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                                                        {staff.displayName?.[0] || '?'}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-xs font-semibold text-white">{staff.displayName}</p>
                                                        <p className="text-[10px] text-gray-500">{staff.department || 'Staff'}</p>
                                                    </div>
                                                </div>
                                                {isPermitted && <Check size={16} className="text-amber-400" />}
                                            </button>
                                        );
                                    })}
                                    {staffList.filter(s => s.role === UserRole.STAFF).length === 0 && (
                                        <p className="text-center text-xs text-gray-500 py-8">No staff members found.</p>
                                    )}
                                </div>
                            </div>
                            )}


                            <div className="flex justify-end pt-4 gap-3 sticky bottom-0 bg-[#080b14]/90 p-4 border-t border-white/10 -mx-6 -mb-6 backdrop-blur">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm font-medium">Cancel</button>
                                <button type="submit" disabled={isSaving} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center">
                                    {isSaving ? <span className="animate-spin mr-2">⏳</span> : <Save size={18} className="mr-2" />}
                                    {editingId ? 'Update Client' : 'Create Client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};

export default ClientsPage;
