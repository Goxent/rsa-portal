import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, ClientProfile, AuditPhase } from '../types';

/** Helper to format date purely for viewing */
const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
        return new Date(dateStr).toLocaleDateString();
    } catch {
        return dateStr;
    }
};

/** Ensure text is a string to prevent ExcelJS/jsPDF crashes on null/undef/objects */
const safeText = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val);
};

export const exportTaskToExcel = async (task: Task, client?: ClientProfile | null): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RSA System';
    workbook.created = new Date();

    // =============== SHEET 1: Client & Engagement Info ===============
    const sheet1 = workbook.addWorksheet('Engagement Info');
    
    sheet1.columns = [
        { header: 'Attribute', key: 'attr', width: 30 },
        { header: 'Details', key: 'details', width: 50 }
    ];

    // Style headers
    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A3644' } };

    // Fill Client details
    sheet1.addRow({ attr: 'Client Name', details: client?.name || task.clientName || 'N/A' });
    sheet1.addRow({ attr: 'Client PAN', details: client?.pan || 'N/A' });
    sheet1.addRow({ attr: 'Address', details: client?.address || 'N/A' });
    sheet1.addRow({ attr: 'Contact Person', details: client?.contactPerson || 'N/A' });
    sheet1.addRow({ attr: '', details: '' }); // spacer

    // Fill Task Details
    sheet1.addRow({ attr: 'Engagement Title', details: task.title });
    sheet1.addRow({ attr: 'Fiscal Year', details: task.fiscalYear || 'N/A' });
    sheet1.addRow({ attr: 'Status', details: task.status });
    sheet1.addRow({ attr: 'Start Date', details: formatDate(task.startDate) });
    sheet1.addRow({ attr: 'Due Date', details: formatDate(task.dueDate) });
    sheet1.addRow({ attr: 'Team Leader', details: task.teamLeaderId ? 'Assigned' : 'Unassigned' });
    sheet1.addRow({ attr: 'Assigned Staff', details: (task.assignedToNames || []).join(', ') });

    // =============== SHEET 2: Audit Observations ===============
    const sheet2 = workbook.addWorksheet('Observations');
    sheet2.columns = [
        { header: 'ID / Title', key: 'title', width: 30 },
        { header: 'Observation / Finding', key: 'obs', width: 50 },
        { header: 'Implication', key: 'impl', width: 40 },
        { header: 'Recommendation', key: 'rec', width: 40 },
        { header: 'Severity', key: 'severity', width: 15 },
        { header: 'Created By', key: 'creator', width: 25 },
    ];
    // Formats
    sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber

    if (task.observations && task.observations.length > 0) {
        task.observations.forEach(obs => {
            const row = sheet2.addRow({
                title: obs.title,
                obs: obs.observation,
                impl: obs.implication,
                rec: obs.recommendation,
                severity: obs.severity,
                creator: obs.createdByName
            });
            row.alignment = { wrapText: true, vertical: 'top' };
        });
    }

    // =============== SHEET 3: FS Review Checklist ===============
    const sheet3 = workbook.addWorksheet('Review Checklist');
    sheet3.columns = [
        { header: 'Layer', key: 'layer', width: 25 },
        { header: 'Item / Title', key: 'item', width: 40 },
        { header: 'Requirement Definition', key: 'req', width: 50 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date of Review', key: 'reviewDate', width: 20 },
        { header: 'Reviewer Comment', key: 'comment', width: 40 },
    ];
    sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald

    if (task.reviewChecklist && task.reviewChecklist.length > 0) {
        const layers = [
            { id: 'TL', label: 'Team Leader', date: task.teamLeadApprovedAt },
            { id: 'ER', label: 'Engagement Reviewer', date: task.engagementReviewerApprovedAt },
            { id: 'SP', label: 'Signing Partner', date: task.signingPartnerApprovedAt }
        ];

        layers.forEach(layer => {
            const items = task.reviewChecklist!.filter(c => c.reviewerRole === layer.id);
            if (items.length > 0) {
                const reviewDateStr = layer.date ? formatDate(layer.date) : 'Pending';
                
                // Add header row for the layer
                const layerRow = sheet3.addRow({
                    layer: `[ ${layer.label.toUpperCase()} PROTOCOL ]`,
                    item: '', req: '', status: '', reviewDate: '', comment: ''
                });
                layerRow.font = { bold: true, color: { argb: 'FF10B981' } };
                layerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };

                items.forEach(chk => {
                    const row = sheet3.addRow({
                        layer: '', // Blank for sub-items
                        item: chk.isSectionHeader ? `--- ${chk.title} ---` : (chk.itemHead || chk.title),
                        req: chk.requirementDef || '',
                        status: chk.isSectionHeader ? '' : chk.status,
                        reviewDate: chk.isSectionHeader ? '' : reviewDateStr,
                        comment: chk.comment || ''
                    });
                    row.alignment = { wrapText: true, vertical: 'top' };
                });
                
                sheet3.addRow({}); // spacer
            }
        });
    }

    // =============== SHEET 4: Subtasks (Execution Queue) ===============
    const sheet4 = workbook.addWorksheet('Subtasks');
    sheet4.columns = [
        { header: 'Phase', key: 'phase', width: 30 },
        { header: 'Task Title', key: 'title', width: 50 },
        { header: 'Requirement', key: 'req', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Evidence Provided', key: 'evidence', width: 30 }
    ];
    sheet4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; // Blue

    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => {
            const row = sheet4.addRow({
                phase: st.phase || 'General',
                title: st.title,
                req: st.minimumRequirement || '',
                status: st.isCompleted ? 'Completed' : 'Pending',
                evidence: st.evidenceText ? `Yes (${st.evidenceText})` : (st.evidenceProvided ? 'Yes' : 'No')
            });
            row.alignment = { wrapText: true, vertical: 'top' };
        });
    }

    // Export the file to browser
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${client?.name || 'Task'}_Workpaper_${new Date().getTime()}.xlsx`.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    saveAs(new Blob([buffer]), fileName);
};


export const exportTaskToPDF = (task: Task, client?: ClientProfile | null): void => {
    // A4 Landscape is often better for tabular data
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    
    const primaryColor: [number, number, number] = [59, 130, 246]; // Brand Blue
    const margin = 14;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(30);
    doc.text('Engagement Workpaper', margin, 20);

    // Metadata section
    doc.setFontSize(10);
    doc.setTextColor(100);
    const generatedDate = new Date().toLocaleDateString();
    doc.text(`Exported on: ${generatedDate}`, margin, 27);
    
    // Client Info table
    autoTable(doc, {
        startY: 35,
        head: [['Client Information', 'Details']],
        body: [
            ['Name', safeText(client?.name || task.clientName || 'N/A')],
            ['PAN', safeText(client?.pan || 'N/A')],
            ['Address', safeText(client?.address || 'N/A')],
            ['Engagement Title', safeText(task.title)],
            ['Fiscal Year', safeText(task.fiscalYear || 'N/A')],
            ['Assignment Start', formatDate(task.startDate)],
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // OBSERVATIONS
    if (task.observations && task.observations.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text('Audit Observations & Findings', margin, currentY);
        
        const obsBody = task.observations.map(obs => [
            safeText(obs.title),
            safeText(obs.observation),
            safeText(obs.implication),
            safeText(obs.recommendation),
            safeText(obs.severity)
        ]);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Title / Area', 'Finding', 'Implication', 'Recommendation', 'Severity']],
            body: obsBody,
            theme: 'grid',
            headStyles: { fillColor: [217, 119, 6] }, // Amber
            styles: { fontSize: 9, cellPadding: 3 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // CHECKLIST
    if (task.reviewChecklist && task.reviewChecklist.length > 0) {
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text('Reviewer Checklist', margin, currentY);
        currentY += 10;

        const layers = [
            { id: 'TL', label: 'Team Leader', date: task.teamLeadApprovedAt },
            { id: 'ER', label: 'Engagement Reviewer', date: task.engagementReviewerApprovedAt },
            { id: 'SP', label: 'Signing Partner', date: task.signingPartnerApprovedAt }
        ];

        layers.forEach(layer => {
            const items = task.reviewChecklist!.filter(c => c.reviewerRole === layer.id);
            if (items.length > 0) {
                if (currentY > doc.internal.pageSize.getHeight() - 30) {
                    doc.addPage();
                    currentY = 20;
                }
                
                doc.setFontSize(11);
                doc.setTextColor(16, 185, 129); // Emerald
                const dateStr = layer.date ? formatDate(layer.date) : 'Pending';
                doc.text(`Layer: ${layer.label.toUpperCase()} PROTOCOL (Verified: ${dateStr})`, margin, currentY);

                const chkBody = items.map(chk => {
                    if (chk.isSectionHeader) {
                        return [
                            `--- ${safeText(chk.title)} ---`,
                            '', '', '', ''
                        ];
                    }
                    return [
                        safeText(chk.itemHead || chk.title),
                        safeText(chk.requirementDef),
                        safeText(chk.status),
                        dateStr,
                        safeText(chk.comment)
                    ];
                });

                autoTable(doc, {
                    startY: currentY + 5,
                    head: [['Control Item', 'Requirement', 'Status', 'Date of Review', 'Reviewer Comments']],
                    body: chkBody,
                    theme: 'grid',
                    headStyles: { fillColor: [16, 185, 129] }, // Emerald
                    styles: { fontSize: 8, cellPadding: 3 },
                    didParseCell: function (data) {
                        // Bold section headers
                        if (data.row.raw && typeof data.row.raw[0] === 'string' && data.row.raw[0].startsWith('---')) {
                           data.cell.styles.fontStyle = 'bold';
                           data.cell.styles.fillColor = [230, 244, 234];
                        }
                    }
                });
                currentY = (doc as any).lastAutoTable.finalY + 15;
            }
        });
    }

    // SUBTASKS
    if (task.subtasks && task.subtasks.length > 0) {
         if (currentY > doc.internal.pageSize.getHeight() - 40) {
             doc.addPage();
             currentY = 20;
         }
 
         doc.setFontSize(14);
         doc.setTextColor(30);
         doc.text('Execution Queue (Subtasks)', margin, currentY);
 
         const subBody = task.subtasks.map(st => [
             safeText(st.phase || 'General'),
             safeText(st.title),
             safeText(st.minimumRequirement),
             st.isCompleted ? 'Completed' : 'Pending',
             safeText(st.evidenceText || (st.evidenceProvided ? 'Yes' : 'No'))
         ]);
 
         autoTable(doc, {
             startY: currentY + 5,
             head: [['Phase', 'Task Title', 'Requirement', 'Status', 'Evidence Provided']],
             body: subBody,
             theme: 'grid',
             headStyles: { fillColor: [59, 130, 246] }, // Blue
             styles: { fontSize: 9, cellPadding: 3 }
         });
    }

    const fileName = `${client?.name || 'Task'}_Workpaper_${new Date().getTime()}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    doc.save(fileName);
};
