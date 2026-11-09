export interface PolicySection {
    id: string;
    category: 'ATTENDANCE' | 'LEAVE' | 'FIELDWORK' | 'WORKFLOW' | 'ETHICS' | 'GROWTH';
    title: string;
    subtitle: string;
    highlights: string[];
    content: string[];
    criticalRules: string[];
    relatedForms?: { label: string; route: string }[];
}

export interface TableSeat {
    seatNumber: number;
    title: string;
    role: string;
    isTableLeader?: boolean;
    buddyWithSeat?: number;
    notes?: string;
}

export interface OfficeTable {
    tableNumber: 1 | 2 | 3;
    tableName: string;
    tableLeaderRole: string;
    description: string;
    seats: TableSeat[];
}

export interface EscalationStep {
    level: number;
    role: string;
    scope: string;
    sla: string;
    contactNote: string;
}

export interface OrgRoleDefinition {
    id: string;
    title: string;
    level: string;
    department: string;
    reportingTo: string;
    responsibilities: string[];
}

export const HANDBOOK_METADATA = {
    version: 'FY 2081/82 - v2.1',
    effectiveDate: '2081-04-01 BS (July 16, 2024 AD)',
    lastUpdated: '2081-11-01 BS',
    firmName: 'R. Sapkota & Associates',
    firmAffiliation: 'Chartered Accountants (ICAN Regulated)',
    approvedBy: 'Managing Partner'
};

export const HANDBOOK_POLICIES: PolicySection[] = [
    {
        id: 'office-hours-punctuality',
        category: 'ATTENDANCE',
        title: 'Office Timing, Punctuality & Grace Period',
        subtitle: 'Standard working hours, morning grace window, and late arrival consequences',
        highlights: [
            'Official office hours: 10:00 AM to 5:00 PM (Sunday to Friday)',
            'Grace window: 15 minutes (Clock-in by 10:15 AM is marked PRESENT)',
            'Clock-ins at 10:16 AM or later are automatically flagged as LATE'
        ],
        content: [
            'All team members are expected to be at their workstations and ready for daily operations by 10:00 AM.',
            'A 15-minute grace period until 10:15 AM is provided to accommodate standard Kathmandu traffic contingencies.',
            'Repeated unpunctuality directly affects audit field readiness, client meeting commitments, and team deliverables.'
        ],
        criticalRules: [
            '6 or more unjustified late arrivals in a single Nepali calendar month result in a mandatory deduction of 1 day from the annual leave balance.',
            'Manual attendance correction requests must be submitted on the SAME DAY with justification; retroactive corrections beyond 24 hours require Partner approval.',
            'Clock-out must be preceded by submitting the Daily Report (Done, Pending, Blockers, Tomorrow).'
        ],
        relatedForms: [
            { label: 'Attendance Dashboard', route: '/attendance' },
            { label: 'Daily Punch Log', route: '/attendance' }
        ]
    },
    {
        id: 'fieldwork-client-site',
        category: 'FIELDWORK',
        title: 'Fieldwork & Client Premises Check-In',
        subtitle: 'Guidelines for audit execution at client offices and travel declarations',
        highlights: [
            'Site-day declaration must be agreed with the Engagement Manager the day prior',
            'Morning notification to HR Coordinator must be submitted by 10:15 AM on field days',
            'Field staff must clock in using client location tagging'
        ],
        content: [
            'Audit associates on client assignments represent the firm directly. Punctuality at client premises is governed by the client’s official operating schedule or 10:00 AM, whichever is earlier.',
            'When conducting fieldwork outside Kathmandu valley, team leaders must submit a fieldwork itinerary to HR prior to departure.',
            'Laptops and audit documentation must remain protected under encryption guidelines at all times while on field.'
        ],
        criticalRules: [
            'Never leave client premises without checking in with the client accounting lead and your engagement team leader.',
            'Field working papers, vouchers checked, and draft queries must be uploaded to the portal before leaving the client premises.'
        ],
        relatedForms: [
            { label: 'Audit Documentation', route: '/audit-docs' },
            { label: 'Active Assignments', route: '/tasks' }
        ]
    },
    {
        id: 'leave-regulations',
        category: 'LEAVE',
        title: 'Leave Policy & Notice Requirements',
        subtitle: 'Annual entitlement, sick leave, study leave, and busy-season leave freeze',
        highlights: [
            '3 working days advance notice required for planned casual or annual leave',
            'Sudden sick leave requires verbal/written notification to HR before 10:00 AM',
            'Mandatory leave blackout during peak statutory busy season (Poush and Ashwin)'
        ],
        content: [
            'Leave balances are calculated based on working days only (Sunday to Friday). Saturdays and public holidays do not consume leave balance.',
            'Article trainees are entitled to exam preparation leave per ICAN guidelines upon providing official exam admission documentation.',
            'Prior to proceeding on leave exceeding 2 days, the staff member must complete a structured task handover with their designated table buddy.'
        ],
        criticalRules: [
            'Leaves taken without written approval from the Engagement Manager or Partner are treated as ABSENT.',
            'No planned leaves are permitted during the annual statutory audit deadline months unless sanctioned by the Managing Partner.'
        ],
        relatedForms: [
            { label: 'Apply for Leave', route: '/leaves' },
            { label: 'Leave Balance Tracker', route: '/leaves' }
        ]
    },
    {
        id: 'workflow-signoff-governance',
        category: 'WORKFLOW',
        title: 'Engagement Governance & 3-Layer Sign-off',
        subtitle: 'Audit quality control, procedure tick marks, and sequential review hierarchy',
        highlights: [
            'Preparer records identity and timestamp on every procedure tick (ISA 230)',
            'Strict 3-layer sign-off: Team Leader -> QC Reviewer -> Signing Partner',
            'Segregation of duties: preparers cannot act as QC reviewer or signing partner'
        ],
        content: [
            'All audit tasks progress through three structured phases: (1) Onboarding, (2) Planning & Execution, and (3) Review & Conclusion.',
            'Procedures flagged with "Evidence Mandatory" require verified vouchers or working paper documentation uploaded to the A-E audit folders.',
            'Review notes raised by reviewers must be resolved and cleared before file sign-off can proceed.'
        ],
        criticalRules: [
            'No engagement task can be marked Completed without full partner sign-off and zero uncleared review queries.',
            'Modifications to procedures after review commencement are locked and require explicit reopening by the reviewer.',
            'All material observations (CRITICAL or HIGH risk) must have an agreed management response and disposition before completion.'
        ],
        relatedForms: [
            { label: 'Tasks & Workflow', route: '/tasks' },
            { label: 'Audit Folders (A-E)', route: '/audit-docs' }
        ]
    },
    {
        id: 'ethics-confidentiality',
        category: 'ETHICS',
        title: 'Professional Ethics, Independence & Confidentiality',
        subtitle: 'ICAN code of ethics, client data protection, and conflict of interest rules',
        highlights: [
            'Strict adherence to the ICAN Code of Ethics and Nepal Standards on Auditing',
            'Non-disclosure of client financial information, tax strategies, and trade secrets',
            'Annual written independence declaration required from all audit personnel'
        ],
        content: [
            'Staff members must maintain absolute confidentiality regarding all information obtained during professional engagements.',
            'Any personal relationship, financial interest, or prior employment with a client entity must be formally disclosed to the Managing Partner prior to engagement assignment.',
            'Client files, data, and passwords must never be stored on personal unencrypted devices or communicated over unsecured public channels.'
        ],
        criticalRules: [
            'Breach of client confidentiality constitutes gross professional misconduct and grounds for immediate disciplinary termination and reporting to ICAN.',
            'Accepting gifts, hospitality, or personal favors from clients is strictly prohibited.'
        ],
        relatedForms: [
            { label: 'Client Directory', route: '/clients' }
        ]
    },
    {
        id: 'training-buddy-system',
        category: 'GROWTH',
        title: 'Professional Development & Buddy System',
        subtitle: 'Seating table support, buddy pairing, quarterly evaluations, and training',
        highlights: [
            'Every 1st-year article trainee is paired with a 3rd-year Senior Buddy',
            'Table leaders conduct daily standups and weekly technical debriefs',
            'Quarterly performance evaluations based on technical quality, punctuality, and teamwork'
        ],
        content: [
            'The firm operates on a collaborative table mentorship structure. Questions regarding tax laws, NSA procedures, or software use should follow the 4-step issue ladder before escalating to partners.',
            'Bi-weekly technical knowledge sessions are conducted on Friday afternoons, covering NFRS, tax amendments, and audit methodologies.',
            'Trainees maintain a continuous learning log of assignments completed and technical standards applied.'
        ],
        criticalRules: [
            'Issues unresolved for more than 2 working days must be escalated to the Audit Manager.',
            'Constructive feedback during quarterly reviews is mandatory for promotion and article stipend progression.'
        ]
    }
];

export const OFFICE_SEATING_TABLES: OfficeTable[] = [
    {
        tableNumber: 1,
        tableName: 'Table 1: Statutory Audit & Financial Institutions',
        tableLeaderRole: 'Senior Audit Associate / 3rd Year Trainee',
        description: 'Handles banking, hydropower, and manufacturing statutory audits and NFRS compliance.',
        seats: [
            { seatNumber: 1, title: 'Seat 1A', role: 'Table Leader (Senior Associate)', isTableLeader: true, notes: 'Engagement oversight & initial working paper review' },
            { seatNumber: 2, title: 'Seat 1B', role: 'Senior Trainee (3rd Year)', buddyWithSeat: 4, notes: 'Direct mentor to Seat 1D' },
            { seatNumber: 3, title: 'Seat 1C', role: 'Audit Associate (2nd Year)', notes: 'Fieldwork lead for commercial clients' },
            { seatNumber: 4, title: 'Seat 1D', role: 'Article Trainee (1st Year)', buddyWithSeat: 2, notes: 'Paired with Seat 1B for vouching & compliance checks' },
            { seatNumber: 5, title: 'Seat 1E', role: 'Article Trainee (1st Year)', notes: 'Vouching, bank reconciliations & TDS verification' },
            { seatNumber: 6, title: 'Seat 1F', role: 'Audit Intern / Floater', notes: 'Reserved for interns and field rotation' }
        ]
    },
    {
        tableNumber: 2,
        tableName: 'Table 2: Tax Compliance & Advisory Services',
        tableLeaderRole: 'Tax Specialist / Audit Associate',
        description: 'Dedicated to VAT returns, income tax assessments, DDA, and regulatory compliance.',
        seats: [
            { seatNumber: 1, title: 'Seat 2A', role: 'Table Leader (Tax Associate)', isTableLeader: true, notes: 'VAT filing review & tax computation verification' },
            { seatNumber: 2, title: 'Seat 2B', role: 'Senior Trainee (3rd Year)', buddyWithSeat: 4, notes: 'Income tax returns & transfer pricing lead' },
            { seatNumber: 3, title: 'Seat 2C', role: 'Audit Trainee (2nd Year)', notes: 'Monthly VAT & withholding tax returns' },
            { seatNumber: 4, title: 'Seat 2D', role: 'Article Trainee (1st Year)', buddyWithSeat: 2, notes: 'Paired with Seat 2B for tax computation checks' },
            { seatNumber: 5, title: 'Seat 2E', role: 'Article Trainee (1st Year)', notes: 'IRD portal filings and biometric sync' },
            { seatNumber: 6, title: 'Seat 2F', role: 'Reserved / Floater', notes: 'Tax season expansion desk' }
        ]
    },
    {
        tableNumber: 3,
        tableName: 'Table 3: Internal Audit & Special Engagements',
        tableLeaderRole: 'Internal Audit Lead / Senior Associate',
        description: 'Focuses on internal controls review, SOP development, and management audits.',
        seats: [
            { seatNumber: 1, title: 'Seat 3A', role: 'Table Leader (Internal Audit Lead)', isTableLeader: true, notes: 'Risk assessment & management report structuring' },
            { seatNumber: 2, title: 'Seat 3B', role: 'Audit Associate (2nd Year)', buddyWithSeat: 4, notes: 'Internal control testing & walkthroughs' },
            { seatNumber: 3, title: 'Seat 3C', role: 'Article Trainee (2nd Year)', notes: 'Operational process sampling' },
            { seatNumber: 4, title: 'Seat 3D', role: 'Article Trainee (1st Year)', buddyWithSeat: 2, notes: 'Paired with Seat 3B for audit sampling' },
            { seatNumber: 5, title: 'Seat 3E', role: 'HR & Administrative Coordinator', notes: 'Office coordination, records, and client communications' },
            { seatNumber: 6, title: 'Seat 3F', role: 'Office Assistant / IT Support', notes: 'Documentation archiving & technical support' }
        ]
    }
];

export const ISSUE_ESCALATION_LADDER: EscalationStep[] = [
    {
        level: 1,
        role: 'Level 1: Senior Buddy / Desk Partner',
        scope: 'Technical vouching queries, template use, portal navigation, and working paper cross-referencing.',
        sla: 'Address within 2 hours',
        contactNote: 'Consult your assigned senior table buddy first.'
    },
    {
        level: 2,
        role: 'Level 2: Table Leader',
        scope: 'Discrepancies in client books, uncooperative client personnel, procedure interpretation, and daily blockers.',
        sla: 'Address same day',
        contactNote: 'Discuss during table standup or immediate consultation.'
    },
    {
        level: 3,
        role: 'Level 3: Audit Manager',
        scope: 'Material misstatements, accounting treatment disputes (NFRS/NAS), scope limitations, and schedule delays.',
        sla: 'Resolution within 24 hours',
        contactNote: 'Formal escalation with supporting working papers.'
    },
    {
        level: 4,
        role: 'Level 4: Engagement / Managing Partner',
        scope: 'Audit opinion modifications, fraud discoveries, client legal disputes, and ethical / independence threats.',
        sla: 'Immediate consultation',
        contactNote: 'Direct briefing with Audit Manager and complete documentation.'
    }
];

export const ORG_STRUCTURE_ROLES: OrgRoleDefinition[] = [
    {
        id: 'managing-partner',
        title: 'Managing Partner (FCA)',
        level: 'Leadership / Partner',
        department: 'Firm Governance',
        reportingTo: 'Firm Partnership',
        responsibilities: [
            'Overall firm quality management (NSQM 1) and strategic direction',
            'Final audit report signing and statutory opinion issuance',
            'Client acceptance, key fee agreements, and regulatory representation'
        ]
    },
    {
        id: 'engagement-partner',
        title: 'Engagement Partner / EQR',
        level: 'Partner / Senior Technical',
        department: 'Audit & Assurance',
        reportingTo: 'Managing Partner',
        responsibilities: [
            'Independent Engagement Quality Review (EQR) for high-risk audits',
            'Technical concurrence on complex accounting treatments under NFRS',
            'Final review and sign-off on engagement files'
        ]
    },
    {
        id: 'audit-manager',
        title: 'Audit & Tax Manager',
        level: 'Management',
        department: 'Operations',
        reportingTo: 'Engagement Partner',
        responsibilities: [
            'Engagement resource planning, timeline management, and budget oversight',
            'Second-tier review of audit files and tax computations',
            'Escalation resolution and client management letter coordination'
        ]
    },
    {
        id: 'table-leader',
        title: 'Table Leader / Senior Associate',
        level: 'Senior Staff',
        department: 'Audit & Assurance',
        reportingTo: 'Audit Manager',
        responsibilities: [
            'Day-to-day engagement execution and field team supervision',
            'First-layer technical sign-off on procedures and checklists',
            'Daily standup coordination and 1st-year trainee mentoring'
        ]
    },
    {
        id: 'article-trainees',
        title: 'Article Trainees (Years 1, 2 & 3)',
        level: 'Trainees (ICAN)',
        department: 'Assurance & Tax',
        reportingTo: 'Table Leader',
        responsibilities: [
            'Execution of audit procedures, vouching, and analytical checks',
            'Audit folder documentation (A through E working papers)',
            'Compliance with daily time logging and evening daily reporting'
        ]
    },
    {
        id: 'admin-hr',
        title: 'Admin & HR Coordinator',
        level: 'Support Administration',
        department: 'Administration',
        reportingTo: 'Managing Partner',
        responsibilities: [
            'Staff attendance monitoring, leave records, and onboarding facilitation',
            'Official notice dissemination and firm calendar management',
            'Client logistics, file archiving, and office infrastructure maintenance'
        ]
    }
];
