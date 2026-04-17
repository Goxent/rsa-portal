const fs = require('fs');

let docPage = fs.readFileSync('pages/AuditDocumentationPage.tsx', 'utf8');

docPage = docPage.replace('import { useOfficeWifiCheck } from \'../../hooks/useOfficeWifiCheck\';', 'import { useOfficeWifiCheck } from \'../../hooks/useOfficeWifiCheck\';\nimport { AuditWorkspace } from \'../components/audit/AuditWorkspace\';');
docPage = docPage.replace('import { useOfficeWifiCheck } from \'../hooks/useOfficeWifiCheck\';', 'import { useOfficeWifiCheck } from \'../hooks/useOfficeWifiCheck\';\nimport { AuditWorkspace } from \'../components/audit/AuditWorkspace\';');

const removeStartIndex = docPage.indexOf('// ─── Constants ────────────────────────────────────────────────────────────────');
const removeEndIndex = docPage.indexOf('// ─── Main Page ────────────────────────────────────────────────────────────────');

if(removeStartIndex !== -1 && removeEndIndex !== -1) {
    docPage = docPage.substring(0, removeStartIndex) + docPage.substring(removeEndIndex);
}

// Ensure proper import since AuditWorkspace was exported as named export
// I will just add the import at the top if it's missing
if (!docPage.includes('import { AuditWorkspace }')) {
    docPage = "import { AuditWorkspace } from '../components/audit/AuditWorkspace';\n" + docPage;
}

const renderStart = docPage.indexOf('{/* ── Address bar / Breadcrumb ── */}');
const renderEnd = docPage.indexOf('{/* ── Client Permission Modal ── */}');

if (renderStart !== -1 && renderEnd !== -1) {
    // we need to replace from the fragment <> down to the end of the Content div
    const prefixIdx = docPage.lastIndexOf('<>', renderStart);
    if (prefixIdx !== -1) {
        const toReplaceStr = docPage.substring(prefixIdx, renderEnd);
        docPage = docPage.replace(toReplaceStr, 
        `<div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 w-full h-full max-w-7xl mx-auto">
             <AuditWorkspace clientId={selectedClientId} clientName={selectedClient?.name || 'Unknown Client'} />
         </div>
    `);
    }
}

fs.writeFileSync('pages/AuditDocumentationPage.tsx', docPage);
