export interface HandbookValue {
    id: string;
    number: string;
    title: string;
    pillars: string;
    description: string;
    motto: string;
}

export interface HandbookTable {
    title?: string;
    headers: string[];
    rows: string[][];
}

export interface TableSeat {
    seatNumber: string;
    personName: string;
    role: string;
    isTableLeader?: boolean;
    isVacant?: boolean;
    notes?: string;
}

export interface WorkstationTable {
    tableNumber: 1 | 2 | 3;
    title: string;
    subtitle: string;
    leaderTitle: string;
    description: string;
    seats: TableSeat[];
}

export interface IssueEscalationStep {
    step: number;
    title: string;
    subtitle: string;
    description: string;
}

export interface RoleResponsibility {
    role: string;
    tableOrLevel?: string;
    keyResponsibilities: string[];
    trainsAndReviews: string[];
    reportsTo: string;
}

export interface HandbookSection {
    id: string;
    sectionNumber: string;
    title: string;
    subtitle?: string;
    tagline?: string;
    category:
        | 'PURPOSE'
        | 'VALUES'
        | 'HOURS'
        | 'PUNCTUALITY'
        | 'ATTENDANCE'
        | 'DRESS'
        | 'BREAKS'
        | 'WORKSTATION'
        | 'ETHICS'
        | 'STRUCTURE'
        | 'REPORTING'
        | 'DISCIPLINE'
        | 'TECHNOLOGY'
        | 'FACILITIES'
        | 'PERFORMANCE'
        | 'CULTURE'
        | 'ACKNOWLEDGEMENT';
    whoThisAppliesTo?: string;
    calloutRule?: {
        label: string;
        text: string;
    };
    paragraphs: string[];
    subsections?: {
        id: string;
        title: string;
        subtitle?: string;
        paragraphs: string[];
        rules?: string[];
        tables?: HandbookTable[];
    }[];
    rules?: string[];
    tables?: HandbookTable[];
    values?: HandbookValue[];
    workstationTables?: WorkstationTable[];
    escalationSteps?: IssueEscalationStep[];
    roleResponsibilities?: RoleResponsibility[];
}

export interface HandbookMetadata {
    title: string;
    subtitle: string;
    tagline: string;
    firmName: string;
    firmAffiliation: string;
    version: string;
    effectiveDate: string;
    lastUpdated: string;
    approvedBy: string;
    googleFormLink: string;
}

// ── Default Metadata ──────────────────────────────────────────────────────────
export const DEFAULT_HANDBOOK_METADATA: HandbookMetadata = {
    title: 'EMPLOYEE HANDBOOK',
    subtitle: 'HOW WE WORK',
    tagline: 'How we work, how we behave and what we expect from each other.',
    firmName: 'R. Sapkota & Associates',
    firmAffiliation: 'Chartered Accountants',
    version: 'FY 2081/82 - v2.2',
    effectiveDate: '2081-04-01 BS (July 16, 2024 AD)',
    lastUpdated: '2081-11-15 BS',
    approvedBy: 'The Partner',
    googleFormLink: 'https://docs.google.com/forms/d/e/1FAIpQLSfh6x8xJq9rsa-handbook-declaration/viewform',
};

// ── Default Seating Tables (Section 08) ────────────────────────────────────────
export const DEFAULT_WORKSTATION_TABLES: WorkstationTable[] = [
    {
        tableNumber: 1,
        title: 'TABLE 1 | AUDIT ASSOCIATES',
        subtitle: 'Leads Table 2 and Table 3',
        leaderTitle: 'Audit Associate (Seat 1 Table Leader)',
        description: 'Plans day-to-day work, allocates tasks, detailed review of working papers, drafts audit reports.',
        seats: [
            { seatNumber: 'SEAT 1A', personName: 'Sabina Shahi Thakuri', role: 'Audit Associate', isTableLeader: true, notes: 'Table Leader' },
            { seatNumber: 'SEAT 1B', personName: 'Parbati Budhathoki', role: 'Audit Associate', notes: 'Fieldwork Lead' },
            { seatNumber: 'SEAT 2A', personName: 'Ankita Khanal', role: 'Audit Associate', notes: 'Review & Reporting' },
            { seatNumber: 'SEAT 2B', personName: 'Inrajit Pandit', role: 'Audit Associate', notes: 'Quality & Field Review' },
        ],
    },
    {
        tableNumber: 2,
        title: 'TABLE 2 | THIRD-YEAR AND SECOND-YEAR ARTICLES',
        subtitle: 'Guided by Table 1. Leads Table 3',
        leaderTitle: 'Third-Year Article (Seat 1 Table Leader)',
        description: 'Standard and complex procedures, first-level check of Table 3, daily guidance for juniors.',
        seats: [
            { seatNumber: 'SEAT 3A', personName: 'Deepankar Paudyal', role: 'Second-Year Article', notes: 'Commercial Audit' },
            { seatNumber: 'SEAT 3B', personName: 'Amrit Patel', role: 'Third-Year Article', notes: 'Complex Audit' },
            { seatNumber: 'SEAT 3C', personName: 'Dipendra Mahato', role: 'Second-Year Article', notes: 'Statutory Verification' },
            { seatNumber: 'SEAT 3D', personName: 'VACANT', role: 'Third-Year Article', isVacant: true },
            { seatNumber: 'SEAT 3E', personName: 'VACANT', role: 'Second-Year Article', isVacant: true },
            { seatNumber: 'SEAT 3F', personName: 'VACANT', role: 'Third-Year Article', isVacant: true },
            { seatNumber: 'SEAT 4A', personName: 'Babin Poudel', role: 'Third-Year Article', notes: 'Financial Verification' },
            { seatNumber: 'SEAT 4B', personName: 'Bilakshi Gautam', role: 'Second-Year Article', notes: 'Compliance' },
            { seatNumber: 'SEAT 4C', personName: 'Rakshya Giri', role: 'Third-Year Article', notes: 'Field Lead' },
            { seatNumber: 'SEAT 4D', personName: 'Asmita Marasini', role: 'Second-Year Article', notes: 'Tax & Audit' },
            { seatNumber: 'SEAT 4E', personName: 'VACANT', role: 'Third-Year Article', isVacant: true },
            { seatNumber: 'SEAT 4F', personName: 'VACANT', role: 'Second-Year Article', isVacant: true },
        ],
    },
    {
        tableNumber: 3,
        title: 'TABLE 3 | FIRST-YEAR ARTICLES, INTERNS AND TRAINEES',
        subtitle: 'Guided by Tables 1 and 2. Training Priority',
        leaderTitle: 'First-Year Article (Seat 1 Table Leader)',
        description: 'Basic vouching, filing, data entry, learning tools, standards and office rules. Training focus.',
        seats: [
            { seatNumber: 'SEAT 5A', personName: 'Rojina Baniya', role: 'First-Year Article', notes: 'Vouching & Verification' },
            { seatNumber: 'SEAT 5B', personName: 'VACANT', role: 'First-Year Article', isVacant: true },
            { seatNumber: 'SEAT 5C', personName: 'Babita Maharjan', role: 'Intern / Trainee', notes: 'Data Entry & Audit Support' },
            { seatNumber: 'SEAT 5D', personName: 'VACANT', role: 'First-Year Article', isVacant: true },
            { seatNumber: 'SEAT 5E', personName: 'Isha Khadka', role: 'Intern / Trainee', notes: 'Vouching & Compliance' },
            { seatNumber: 'SEAT 5F', personName: 'VACANT', role: 'First-Year Article', isVacant: true },
            { seatNumber: 'SEAT 5G', personName: 'Furba Tamang', role: 'Intern / Trainee', notes: 'Documentation & Field Support' },
        ],
    },
];

// ── Default 5-Step Escalation Ladder (Section 08.1) ───────────────────────────
export const DEFAULT_ESCALATION_STEPS: IssueEscalationStep[] = [
    {
        step: 1,
        title: 'TRY FIRST',
        subtitle: 'Self check',
        description: 'Check the handbook, Nepal Standards on Auditing, tax acts, circulars and your own working notes.',
    },
    {
        step: 2,
        title: 'SEAT LEADER',
        subtitle: 'Next in experience',
        description: 'Ask the tablemate just ahead of you in experience, then others at your table with subject knowledge.',
    },
    {
        step: 3,
        title: 'TABLE LEADER',
        subtitle: 'Seat 1 of your table',
        description: 'Seat 1 of your table helps solve the doubt or determines if it needs to move up.',
    },
    {
        step: 4,
        title: 'NEXT TABLE',
        subtitle: 'Up one table at a time',
        description: 'If unresolved, Table 3 moves to Table 2; Table 2 moves to Table 1 through their Table Leaders.',
    },
    {
        step: 5,
        title: 'MANAGER',
        subtitle: 'Audit Manager',
        description: 'Table 1’s Table Leader takes any unresolved issue directly to the Audit Manager.',
    },
];

// ── Default Responsibilities Matrix (Section 10.2) ───────────────────────────
export const DEFAULT_ROLE_RESPONSIBILITIES: RoleResponsibility[] = [
    {
        role: 'Partner',
        tableOrLevel: 'Executive Leadership',
        keyResponsibilities: [
            'Final decisions on engagements and sign-off of statutory audit reports.',
            'Client relationships, engagement fee structures and partner-level appointments.',
            'Sets firm policies and holds ultimate responsibility for quality, independence and ethics.',
        ],
        trainsAndReviews: [
            'Mentors Audit Managers.',
            'Reviews high-risk areas, modified audit opinions and sensitive client engagements.',
        ],
        reportsTo: 'Final authority',
    },
    {
        role: 'Audit Manager',
        tableOrLevel: 'Management Oversight',
        keyResponsibilities: [
            'Plans engagements, budgets audit hours and allocates engagement teams.',
            'Reviews files, management letters and draft audit reports.',
            'Handles client communications and statutory filing deadlines.',
            'Resolves escalated technical issues before they reach the Partner.',
        ],
        trainsAndReviews: [
            'Trains Table 1 (Audit Associates).',
            'Gives final comprehensive review of working papers before Partner sign-off.',
        ],
        reportsTo: 'Partner',
    },
    {
        role: 'Audit Associate',
        tableOrLevel: 'Table 1',
        keyResponsibilities: [
            'Runs day-to-day engagement fieldwork and supervises site teams.',
            'Performs detailed review of working papers and voucher checks.',
            'Drafts audit reports, observation sheets and management letters.',
            'Leads the engagement team where assigned.',
        ],
        trainsAndReviews: [
            'Trains Table 2 and Table 3 team members.',
            'Reviews working papers before submitting to the Manager.',
        ],
        reportsTo: 'Audit Manager',
    },
    {
        role: 'Table Leader',
        tableOrLevel: 'Seat 1 (Held alongside designation)',
        keyResponsibilities: [
            'First point of contact for the table and monitors table progress.',
            'Takes unresolved queries to the Table Leader of the next table up.',
            'Consolidates daily reporting for the table and keeps workflow on track.',
        ],
        trainsAndReviews: [
            'Guides and mentors own tablemates.',
            'Provides structured feedback at the quarterly seating and performance review.',
        ],
        reportsTo: 'Table Leader of the next table up (Table 1 Table Leader reports to Manager)',
    },
    {
        role: 'Third-Year Article',
        tableOrLevel: 'Table 2',
        keyResponsibilities: [
            'Handles complex audit areas independently (NFRS compliance, tax provisions).',
            'Prepares working papers to review-ready standard.',
            'Supports Table 1 on technical client queries and reconciliations.',
        ],
        trainsAndReviews: [
            'Acts as Buddy for first-year article trainees and interns.',
            'Performs first-level checks of Table 3 vouching and basic schedules.',
        ],
        reportsTo: 'Table 1, through own seat leader and Table Leader',
    },
    {
        role: 'Second-Year Article',
        tableOrLevel: 'Table 2',
        keyResponsibilities: [
            'Carries out standard audit procedures (confirmations, physical verification).',
            'Maintains complete, cross-referenced working papers with clear tick marks.',
            'Assists with tax computations, VAT verification and TDS audits.',
        ],
        trainsAndReviews: [
            'Trains first-year articles and interns on basic vouching and audit software.',
        ],
        reportsTo: 'Table 1, through own seat leader and Table Leader',
    },
    {
        role: 'First-Year Article / Intern / Trainee',
        tableOrLevel: 'Table 3',
        keyResponsibilities: [
            'Executes foundational audit tasks: vouching, filing, casting and document copying.',
            'Learns audit methodology, standards, tax acts and office tools.',
            'Asks questions when unsure; maintains an up-to-date learning log.',
        ],
        trainsAndReviews: [
            'Learns from designated Buddy (Table 2) and senior table members.',
        ],
        reportsTo: 'Own seat leader at Table 3; Buddy from Table 2 for daily guidance',
    },
    {
        role: 'Client Relationship Manager (CRM)',
        tableOrLevel: 'Client Relations',
        keyResponsibilities: [
            'Coordinates with clients on all engagement schedules, document requests and logistics.',
            'Ensures client satisfaction, feedback collection and smooth communication flow.',
        ],
        trainsAndReviews: ['None'],
        reportsTo: 'Partner / Audit Manager',
    },
    {
        role: 'Engagement Quality Reviewer (EQR)',
        tableOrLevel: 'Quality Assurance',
        keyResponsibilities: [
            'Performs independent quality reviews of significant engagements per ICAN NSQM standards.',
            'Must remain completely independent of the fieldwork engagement team.',
        ],
        trainsAndReviews: ['None'],
        reportsTo: 'Partner',
    },
    {
        role: 'Admin and HR Coordinator',
        tableOrLevel: 'Operations & Facilities',
        keyResponsibilities: [
            'Maintains official attendance logs, leave registers and acknowledgment records.',
            'Manages office supplies, visitor records, staff/guest Wi-Fi and facilities.',
            'Conducts orientation and handbook briefings for new joiners.',
        ],
        trainsAndReviews: [
            'Briefs new joiners on office rules, punctuality and portal systems.',
        ],
        reportsTo: 'Partner / Audit Manager',
    },
    {
        role: 'Office Assistant',
        tableOrLevel: 'Support Staff',
        keyResponsibilities: [
            'Supports daily office requirements: pantry, office cleanliness, document handling.',
            'Runs official errands, assists with mail/couriers and visitor hospitality.',
        ],
        trainsAndReviews: ['None'],
        reportsTo: 'Admin and HR Coordinator',
    },
];

// ── Complete 17 Handbook Sections ─────────────────────────────────────────────
export const DEFAULT_HANDBOOK_SECTIONS: HandbookSection[] = [
    {
        id: '01-purpose-and-culture',
        sectionNumber: '01',
        title: 'Purpose and Culture',
        tagline: 'Trust is built on how we show up every day.',
        category: 'PURPOSE',
        paragraphs: [
            'R. Sapkota & Associates, Chartered Accountants is a professional firm. Our clients trust us with their numbers, their data and their reputation, and that trust is built on how we show up every day. This handbook sets simple, fair rules so that everyone knows what is expected and the office runs smoothly.',
        ],
        whoThisAppliesTo:
            'This handbook applies equally to all members of the firm, including partners, managers, audit associates, article trainees, interns, trainees and office staff. Every individual, regardless of designation or experience, is expected to uphold its standards. The Partner retains overall authority for interpretation, implementation and approval of handbook amendments. Where this handbook conflicts with applicable law or ICAN rules, the law or ICAN rules prevail. It is reviewed at the start of each fiscal year, and every change is issued in writing with a version number and acknowledged by all staff.',
        calloutRule: {
            label: 'WHO THIS APPLIES TO',
            text: 'All members of the firm, from Partner to Intern. Reviewed annually; changes issued in writing and acknowledged by all staff.',
        },
    },
    {
        id: '02-our-values',
        sectionNumber: '02',
        title: 'Our Values',
        tagline: 'These are the everyday habits behind how we work, how we support each other and how we serve our clients.',
        category: 'VALUES',
        paragraphs: [
            'Our values define the culture of R. Sapkota & Associates. They are not slogans on a wall—they are practical expectations that guide our decisions, working papers, peer interactions, and client engagements every day.',
        ],
        values: [
            {
                id: 'val-integrity',
                number: '01',
                title: 'Integrity',
                pillars: 'HONESTY. INDEPENDENCE. ACCOUNTABILITY.',
                description:
                    'We act honestly, ethically and transparently. We take responsibility for our work, maintain professional independence and uphold the highest standards of professional conduct, even when no one is watching.',
                motto: 'Do the right thing, even when no one is watching.',
            },
            {
                id: 'val-punctuality',
                number: '02',
                title: 'Punctuality and Respect for Time',
                pillars: 'DISCIPLINE. DELIVERY. COMMUNICATION.',
                description:
                    'We value punctuality, discipline and timely delivery. We respect our colleagues’ and clients’ schedules, meet agreed deadlines and communicate promptly when delays arise.',
                motto: 'Respect for time is respect for people.',
            },
            {
                id: 'val-confidentiality',
                number: '03',
                title: 'Confidentiality',
                pillars: 'DISCRETION. SECURITY. TRUST.',
                description:
                    'We protect all client information, financial records, working papers and internal firm information. Confidential information must never be disclosed, shared or used without proper authorisation.',
                motto: 'Trust is earned through discretion.',
            },
            {
                id: 'val-teamwork',
                number: '04',
                title: 'Teamwork',
                pillars: 'GUIDANCE. SUPPORT. CREDIT.',
                description:
                    'We encourage a supportive working environment where seniors guide, juniors learn, colleagues assist one another and everyone contributes towards shared objectives. We recognise collective effort and give credit where it is due.',
                motto: 'Work together. Grow together.',
            },
            {
                id: 'val-learning',
                number: '05',
                title: 'Continuous Learning',
                pillars: 'KNOWLEDGE. JUDGEMENT. GROWTH.',
                description:
                    'We promote continuous professional development, knowledge sharing and practical learning. Every team member is encouraged to improve technical competence, develop professional judgement and remain updated with applicable standards, regulations and industry practices.',
                motto: 'Every engagement is an opportunity to grow.',
            },
        ],
    },
    {
        id: '03-office-days-and-hours',
        sectionNumber: '03',
        title: 'Office Days and Working Hours',
        category: 'HOURS',
        paragraphs: [
            'Standard office operating hours are designed to support client service requirements while maintaining a healthy work-life rhythm for the team.',
        ],
        tables: [
            {
                headers: ['Item', 'Policy Specification'],
                rows: [
                    ['Working days', 'Sunday to Friday'],
                    ['Weekly off', 'Saturday'],
                    ['Office hours', '10:00 AM to 5:00 PM'],
                    ['Lunch break', '1:30 PM to 2:30 PM'],
                    ['Holidays', 'As per the firm’s holiday calendar, published at the start of each fiscal year'],
                ],
            },
        ],
        calloutRule: {
            label: 'BUSY SEASON',
            text: 'During the audit peak (Ashwin and Poush month, and near regulatory and client deadlines), working hours may extend. Extended hours are planned and announced in advance by the manager and kept strictly to what the work needs.',
        },
    },
    {
        id: '04-punctuality-and-late-arrival',
        sectionNumber: '04',
        title: 'Punctuality and Late Arrival',
        tagline: 'Punctuality is a sign of professionalism. We understand Kathmandu traffic is unpredictable, so the rules are firm but fair.',
        category: 'PUNCTUALITY',
        calloutRule: {
            label: 'THE RULE',
            text: '15 minutes’ grace. After that, it is a late mark.',
        },
        tables: [
            {
                headers: ['Office Starts', 'Late Mark Threshold'],
                rows: [['10:00 AM', 'Arrivals at or after 10:16 AM (10:00 – 10:15 AM is within Grace Window)']],
            },
        ],
        paragraphs: [
            'Grace period: arriving up to 15 minutes after the 10:00 AM start (until 10:15 AM) is accepted without a late mark.',
            'Late arrival: arriving after 10:15 AM is recorded as a late arrival.',
            'Attendance log: late arrivals are counted only from the official attendance log (see section 05).',
            'Consequence: 6 or more late arrivals in a single Nepali month without reasonable justification are treated as 1 day of leave for that month. The Admin and HR Coordinator shares each person’s late-arrival count at month end, so nobody is surprised. Late arrivals with reasonable justification are not counted.',
            'Genuine reasons: emergencies, medical issues, long traffic jams or strikes (bandh) must be informed to your reporting manager or the Admin and HR Coordinator by call or message before 10:15 AM, or as soon as it is safe to do so. These are reviewed case by case and recorded by Admin/HR.',
            'Client site days: if you are going directly to a client site, tell your manager the previous day and message the Admin and HR Coordinator by 10:15 AM on the day, because the office attendance log does not capture site days. Reaching the client on time is the standard.',
            'Habitual lateness: discussed in a one-to-one conversation first; repeated cases are reflected in performance reviews and follow Section 12 discipline.',
        ],
        rules: [
            'Arrival by 10:15 AM = Present (Grace applied).',
            'Arrival after 10:15 AM = Late Mark recorded on system.',
            '6 late marks in a Nepali month = 1 day leave deduction.',
            'Client site travel must be declared to HR and Manager before 10:15 AM.',
        ],
    },
    {
        id: '05-attendance-and-leave',
        sectionNumber: '05',
        title: 'Attendance and Leave',
        category: 'ATTENDANCE',
        paragraphs: [
            'Daily attendance: recorded on the firm’s attendance system, as designated by the Admin and HR Coordinator. Logging in and out is mandatory. Log out only after your timesheet and daily report are done (section 11). Unlogged attendance is treated as leave unless you can show justifiable circumstances.',
            'Missed log-in or log-out: contact the Admin and HR Coordinator on the same day. Corrections are not accepted after that day.',
            'Leave entitlement and balance: annual, sick and other leave entitlements are as stated in your appointment letter or the firm’s leave schedule for the fiscal year. The Admin and HR Coordinator keeps the leave register and informs each person of their balance on request.',
            'How to apply: apply for planned leave in writing to your senior, copied to the Admin and HR Coordinator, at least 3 working days before, or as early as possible. Leave counts as approved only when your manager or the Partner confirms it in writing.',
            'Handover before leave: before going on exam leave, or any planned leave of more than one day, hand over your work in writing to your senior or the person assigned by your manager, and finish all urgent work. Pending items, file locations and client contacts must be clearly noted in the handover.',
            'No planned leave during deadlines: no planned leave during peak audit and filing deadlines (Ashwin and Poush) unless approved by the Partner or manager, or in an emergency. Exam leave is not affected by this rule, but the handover must be completed before it starts.',
            'Sudden sick leave: call your reporting manager before 10:00 AM on the day and copy the Admin and HR Coordinator. A message alone is enough only if you cannot speak. A medical certificate may be requested for longer sick leave.',
            'Unauthorised absence: absence without approval or notification is recorded as unauthorised and handled under section 12.',
        ],
        rules: [
            'Log out of attendance ONLY after completing timesheet and daily report.',
            'Missed attendance punches must be corrected on the SAME DAY.',
            'Planned leave requires 3 working days written advance notice.',
            'Leaves >1 day require a structured written handover document.',
            'Planned leaves are frozen during Ashwin & Poush audit peaks.',
            'Sudden sick leave requires a phone call before 10:00 AM.',
        ],
    },
    {
        id: '06-dress-code',
        sectionNumber: '06',
        title: 'Dress Code',
        category: 'DRESS',
        calloutRule: {
            label: 'RECOMMENDED',
            text: 'Formal is recommended. Smart or semi-formal is welcome. Never over-casual.',
        },
        paragraphs: [
            'Formal dress is recommended. Smart or semi-formal clothes are equally welcome. Whatever you choose, your dress should never be too casual for a professional office. We meet clients and other professionals, so our appearance should show respect for the profession. If a medical, religious or personal need affects how you can dress, speak to your manager. A first lapse gets a private reminder, and repeated lapses follow section 12.',
            'Never allowed, in the office or at a client site:',
            '• Shorts, track pants, ripped jeans, joggers\n• T-shirts with slogans or large prints\n• Flip-flops, crocs\n• Any other clothing that is too casual for a professional office.',
            'Casual Friday (Optional, once per week):',
            'Neat, clean jeans, collared or plain T-shirts and smart casual footwear are fine. Still not allowed: shorts, flip-flops, torn clothes, offensive prints. Casual Friday does not apply on days when you have a client meeting, a site visit, or an external visitor.',
        ],
        rules: [
            'Personal Hygiene: Neat grooming and clean clothes, every single day.',
            'Client visits always require standard formal / smart attire regardless of day of the week.',
        ],
    },
    {
        id: '07-lunch-and-tea-breaks',
        sectionNumber: '07',
        title: 'Lunch and Tea Breaks',
        category: 'BREAKS',
        paragraphs: [
            'Lunch: 1 hour, 1:30 PM to 2:30 PM, as shown in section 03. Teams may stagger lunch so that tight deadlines can be managed.',
            'Lunch location: lunch is to be taken in the pantry or outside. Please avoid eating at the workstation with strong-smelling food, and never at the desk in front of clients.',
            'Overstaying lunch repeatedly is treated like late arrival.',
            'No waste: do not waste food in the office.',
            'Tea and coffee: short breaks are welcome. Please avoid long group gatherings in the pantry during working hours.',
            'Tea breaks: keep them short (about 10 minutes) and no more than two a day, and make sure the workstation is never left unattended by the whole table.',
        ],
        calloutRule: {
            label: 'MEDICAL OR PERSONAL NEEDS',
            text: 'Speak to your manager. Reasonable flexibility will always be granted.',
        },
    },
    {
        id: '08-rsa-workstation-training',
        sectionNumber: '08',
        title: 'RSA Workstation, Training and Development',
        category: 'WORKSTATION',
        paragraphs: [
            'The RSA Workstation is the shared working floor of the firm. It is structured into three experience-based tables to establish clear leadership, peer support, and systematic training.',
        ],
        calloutRule: {
            label: 'THE WORKSTATION RULE',
            text: 'Table 1 leads Table 2 and Table 3. Table 2 leads Table 3. Table 3 is where we invest most in training.',
        },
        subsections: [
            {
                id: '8.1-seating-arrangement',
                title: '8.1 Seating Arrangement & Issue Escalation',
                subtitle: 'Floor layout, seat leadership and how technical doubts are resolved',
                paragraphs: [
                    'The tables are arranged by level of experience. They show who leads, who supports and who is being trained at the workstation. They work together with the reporting hierarchy in section 10.2, and they are for clarity and learning, not for status.',
                    'Table 1 (4 most senior Audit Associates): leads Table 2 and Table 3. They plan work, give direction, review files, and report to Audit Managers.',
                    'Table 2 (Third-year and second-year articles): leads Table 3. They guide juniors in daily work, check work first, and escalate unresolved doubts to Table 1.',
                    'Table 3 (First-year articles, interns and trainees): the training priority of the firm. The most patience, structured mentorship and guidance is invested here.',
                    'Every seat has its own leader based on experience. Your seat leader is the tablemate just ahead of you. A doubt is never sent straight to another table—it is first discussed with tablemates in order of experience.',
                ],
                rules: [
                    'No Skipping: Tablemates first. Then Table Leader. Only then the next table up. Then Manager.',
                    'Clean Desk Policy: At the end of the day, working papers are locked away, client files secured, and computer screens locked whenever leaving your seat.',
                    'Personal Belongings: Bags, helmets, cups go in designated shelf slots, not left lying around.',
                    'Meeting Room: May be used for team discussions or training when vacant. Always leave clean.',
                ],
            },
            {
                id: '8.2-running-workstation',
                title: '8.2 Running the RSA Workstation',
                subtitle: 'Daily workflow, engagement in-charge roles, and pending assignment rules',
                paragraphs: [
                    'Start of day: Be at your seat on time. Take the day’s tasks from your seat leader or Table Leader and clarify the deadline for each item.',
                    'Engagement in-charge: For every engagement the manager names a Table 1 member as in-charge and lists the team in writing, with budgeted hours and deliverables.',
                    'Direct instructions: Table 1 may give instructions directly to Table 3 when work requires. The Table Leader of Table 2 must be kept informed.',
                    'Written handovers: When work passes between tables, note what is done, pending, and file locations in writing.',
                    'Reviews with comments: Reviewed work must be returned with clear written comments on the same working day so juniors can correct and learn.',
                    'Pending and overdue assignments ("No one stays stuck"): If an assignment is taking unusually long or remains open after two working days without clear progress, raise it on the same day with your seat leader. Do not wait for the deadline. The senior table will guide, split, or reassign. Raising blockers early is responsible behavior, never penalized.',
                ],
                rules: [
                    'Assignments open for >2 days without progress must be escalated immediately.',
                    'Reviewed files must be returned with written comments on the same day.',
                    'No blame culture: Early escalation of blockers is rewarded; hiding delays is penalized.',
                ],
            },
            {
                id: '8.3-training-and-development',
                title: '8.3 Training and Development System',
                subtitle: 'Onboarding buddies, bi-monthly presentations and capacity development',
                paragraphs: [
                    'Training at RSA is a daily habit, not a one-time event. Every table trains the table below it.',
                    'Newcomer induction & buddy system: Every new joiner is assigned a Table 2 Buddy for the first 3 months. The buddy reviews work daily and conducts weekly 15-minute check-ins. A formal 3-month review is held with the Manager.',
                    'Bi-monthly presentations: Held twice a month (minimum 1 in busy season). Presenters rotate across all tables. Table 2 and Table 3 members present at least once per quarter on auditing standards, tax laws, or tools like Excel. Table 1 guides and gives written feedback.',
                    'Capacity development training: Quarterly technical sessions (NSA, NFRS, tax amendments, ICAN exam revisions) and leadership workshops for Tables 1 and 2.',
                ],
                rules: [
                    'Trainees maintain a continuous learning log reviewed weekly by buddy and monthly by Table 1.',
                    'All employees must participate in bi-monthly technical presentations.',
                    'Each team member sets 1 quarterly personal development goal with their senior.',
                ],
            },
        ],
    },
    {
        id: '09-professional-conduct-and-ethics',
        sectionNumber: '09',
        title: 'Professional Conduct and Ethics',
        category: 'ETHICS',
        calloutRule: {
            label: 'THE GOLDEN RULE',
            text: 'Client information never leaves the firm.',
        },
        paragraphs: [
            'As members and students of ICAN, we strictly follow the ICAN Code of Ethics and Nepal Standards on Auditing.',
            'Confidentiality: Do not share client data, working papers or financials outside the firm, including on WhatsApp groups, personal email or social media. Your duty of confidentiality continues even after leaving the firm.',
            'Respect & Non-Discrimination: No shouting, humiliation, discrimination, bullying or harassment. The firm has zero tolerance for sexual harassment or discrimination based on gender, caste, ethnicity, religion or disability.',
            'Professional Language: Polite, professional language at all times with clients and colleagues. Use Nepali or English respectfully.',
            'Independence and Conflicts: Disclose in writing any financial, family or personal interest in a client before engagement assignment. Do not accept gifts or hospitality from clients beyond small courtesies.',
            'Suspected Wrongdoing: Report suspected fraud, illegality or ethical breaches to your manager or the Partner. Reports made in good faith are strictly protected.',
            'Grievance Redressal: Raise concerns with your manager, HR Coordinator or Partner. Complaints are kept confidential; receiver acknowledges within 3 working days and outlines next steps.',
        ],
        rules: [
            'Breach of client confidentiality is grounds for immediate termination and ICAN reporting.',
            'Strict zero-tolerance policy against sexual harassment and discrimination.',
            'Independence declarations must be signed prior to client assignments.',
            'Grievance acknowledgments guaranteed within 3 working days.',
        ],
    },
    {
        id: '10-organisational-structure-and-hierarchy',
        sectionNumber: '10',
        title: 'Organisational Structure & Reporting Hierarchy',
        category: 'STRUCTURE',
        paragraphs: [
            'Clear communication keeps work moving and keeps everyone informed. The hierarchy exists for clarity, efficiency and learning, not for status.',
            'Communication Flow Principles:',
            '• Go through your line: Instructions come down the reporting line and queries go up the same line.',
            '• No bypassing: Do not skip your senior on routine work. If a partner gives direct instructions, inform your senior immediately.',
            '• Escalate directly when needed: Ethics concerns, harassment, grievances and personal emergencies can go straight to the Manager or Partner.',
            '• Acting Partner: For absences of >1 working day, the Partner names an acting authority in writing so decisions are never stalled.',
            '• Official Channels: Use official email and dedicated engagement group chats. Client work must NEVER be sent over personal chat apps or personal cloud drives.',
            '• Disagree respectfully: Express differing viewpoints politely and privately with technical reasoning. Once decided, follow through.',
        ],
    },
    {
        id: '11-daily-reporting-before-leaving',
        sectionNumber: '11',
        title: 'Daily Reporting Before Leaving',
        tagline: 'Timesheet first. Then report. Then leave.',
        category: 'REPORTING',
        calloutRule: {
            label: 'THE DAILY RULE',
            text: 'Timesheet first. Then report. Then leave.',
        },
        tables: [
            {
                title: 'Daily Report Structure (2 to 5 minutes)',
                headers: ['Section', 'Contents to Report'],
                rows: [
                    ['Done', 'Work completed today with client and task references.'],
                    ['Pending', 'Work still open, and the specific reason why.'],
                    ['Blockers', 'Any technical problems, missing client documents or assistance needed.'],
                    ['Tomorrow', 'Clear plan of action and priorities for the next working day.'],
                ],
            },
        ],
        paragraphs: [
            'Every day ends with a short report. This is not about surveillance—it keeps work visible, identifies blockers early before deadlines, and helps seniors plan resource allocation.',
            'Report in person before leaving: Every team member reports to their senior or manager in person before leaving the office premises.',
            'Table Leaders consolidate: Each Table Leader sends the manager one combined summary for the table (Done, Pending, Blockers, Tomorrow) so managers have a clean bird’s-eye view.',
            'Timesheet first: Complete your timesheet entries before submitting your report, and log out of the attendance system last.',
            'Field days: Call or message your senior before departing client premises.',
            'Seniors’ responsibility: Assign work early in the day so closing time is never used to dump unexpected new work on team members.',
        ],
        rules: [
            'Never leave premises without submitting daily report and logging timesheets.',
            'Log out of attendance system LAST after reporting is concluded.',
            'Table Leaders consolidate and deliver combined table report to Manager.',
        ],
    },
    {
        id: '12-etiquette-and-discipline',
        sectionNumber: '12',
        title: 'Etiquette and Discipline',
        tagline: 'Small habits create the culture of a firm. The way you behave shows your state of mind.',
        category: 'DISCIPLINE',
        paragraphs: [
            'Greet and respect: Greet colleagues and visitors warmly. Address partners, managers and clients respectfully (Sir / Madam, or name with “ji”). Knock before entering cabins or meeting rooms.',
            'Meetings etiquette: Be on time, bring a notepad and pen, keep phones on silent, one person speaks at a time, and record clear action points with owners and deadlines.',
            'Say "I will check": If you do not know something, say so honestly and find out. Never guess an answer to a senior or a client.',
            'Report mistakes early: An honest error reported early can be fixed. Hidden errors become disasters. Honest mistakes are treated as learning opportunities.',
            'No gossip & no office politics: Do not discuss colleagues’ salary, performance or personal matters. Divisive behavior directly conflicts with our values.',
            'Disciplinary Escalation Ladder:',
            '1. Private verbal conversation.\n2. Written reminder recorded by the Audit Manager.\n3. Formal written warning approved by the Partner.\n4. Further disciplinary action up to termination of article contract or employment.',
            'Immediate formal escalation: Serious breaches such as client confidentiality violation, dishonesty, harassment, or falsifying timesheets/records skip informal steps directly to formal warning or termination. In every case, the person is given a fair hearing first.',
        ],
        rules: [
            'Say "I will check" instead of guessing answers to clients or seniors.',
            'Honest mistakes reported early are supported; hidden mistakes lead to discipline.',
            'Zero tolerance for compensation gossip or office politics.',
            'Formal 4-step disciplinary procedure ensures fairness and documented hearings.',
        ],
    },
    {
        id: '13-technology-data-workplace',
        sectionNumber: '13',
        title: 'Technology, Data and Workplace Use',
        category: 'TECHNOLOGY',
        paragraphs: [
            'Phones: Keep phones on silent mode during working hours and meetings. Personal calls should be brief and taken outside the open workstation area.',
            'Social Media: Do not post about clients, engagements, audit findings or internal firm matters on social media. Always maintain professional discretion.',
            'Wi-Fi Security: The Staff Wi-Fi network is strictly for employees and firm devices. Never share the staff Wi-Fi password with clients or visitors. Guests must connect to the separate Guest Wi-Fi network.',
            'Office Devices: Take care of laptops, monitors and peripherals assigned to you. Use office computers for professional firm work and avoid personal software or storage.',
            'Passwords & Screen Locking: Use strong, unique passwords. Never share login credentials. Always lock your screen (Win + L) whenever stepping away from your workstation.',
        ],
        rules: [
            'Staff Wi-Fi password must NEVER be shared with clients or visitors.',
            'Lock your screen whenever leaving your seat (Clean Screen Policy).',
            'No client or working paper mentions on personal social media accounts.',
        ],
    },
    {
        id: '14-cleanliness-and-facilities',
        sectionNumber: '14',
        title: 'Office Cleanliness and Facilities',
        category: 'FACILITIES',
        paragraphs: [
            'Workstation hygiene: Keep your desk and surrounding workstation area tidy and organized throughout the day.',
            'Waste management: Dispose of paper, food packaging and waste in the designated waste bins.',
            'No smoking: Smoking is strictly prohibited inside the entire office premises and building corridors.',
            'Noise control: Keep conversation voices low in the open workstation area. Move lengthy discussions to the meeting room.',
            'Energy Saving & Air Conditioning (AC) Etiquette:',
            '• Before leaving: Switch off your PC, monitors, desk lights, fans and AC units. Unplug phone chargers and extension strips.',
            '• Keep doors closed: Keep office and cabin doors closed when the AC is operating to avoid wasting electricity.',
            '• Last person out: The last person leaving the office must verify all lights, ACs, monitors and appliances are switched off, windows shut, and doors securely locked.',
        ],
        rules: [
            'Keep doors closed when Air Conditioning is active.',
            'Last person leaving must do a complete security and energy shut-down check.',
            'Strict no-smoking policy across all firm premises.',
        ],
    },
    {
        id: '15-performance-learning-growth',
        sectionNumber: '15',
        title: 'Performance, Learning and Growth',
        category: 'PERFORMANCE',
        paragraphs: [
            'Every employee is expected to maintain professional standards, take ownership of assigned work, and continuously pursue growth. The firm fosters a culture of constructive feedback, accountability, and merit-based recognition.',
        ],
        subsections: [
            {
                id: '15.1-expectations',
                title: '15.1 Four Pillars of Performance Evaluation',
                paragraphs: [
                    '1. Technical Competence & Knowledge: Practical understanding of NSA, NFRS, tax laws and ability to complete assigned procedures independently.',
                    '2. Quality of Work & Accuracy: Documentation completeness, referenced working papers, attention to detail and incorporating review comments.',
                    '3. Timeliness, Accountability & Proactivity: Delivering work within budgeted hours, meeting deadlines, anticipating requirements and escalating delays early.',
                    '4. Learning & Development: Applying review feedback, active participation in presentations and mastering new audit areas.',
                ],
            },
            {
                id: '15.2-review-cadence',
                title: '15.2 Review Cadence & Feedback',
                paragraphs: [
                    'Daily Monitoring: Seniors and managers review timesheets, working paper quality and daily task execution.',
                    'Quarterly Formal Reviews: Structured quarterly discussions to assess performance, strengths, areas for improvement and next quarter goals.',
                ],
            },
            {
                id: '15.4-recognition-and-promotion',
                title: '15.4 Recognition, Promotion & Career Growth',
                paragraphs: [
                    'Merit-based advancement: Good performance, consistent improvement, technical capability and professional conduct are recognized with advanced assignments and additional leadership responsibilities.',
                    'Promotions and revisions: Promotions, article stipend revisions and incentives are considered on merit and firm requirements, subject to Partner approval.',
                    'Length of service alone does not guarantee promotion or advancement.',
                ],
            },
        ],
        calloutRule: {
            label: 'IN PRACTICE',
            text: 'Quarterly check-ins with your manager; Timesheets filled daily and honestly; Good work recognized publicly, mistakes guided privately.',
        },
    },
    {
        id: '16-team-culture-and-balance',
        sectionNumber: '16',
        title: 'Team Culture and Work-Life Balance',
        category: 'CULTURE',
        paragraphs: [
            'Saturday is the weekly off: Work calls and messages outside office operating hours are avoided, except for urgent matters during peak audit season.',
            'Public recognition: Good work, exemplary teamwork, and client appreciation are celebrated openly in team forums.',
            'Busy season recovery: Extended hours during Ashwin and Poush peaks are announced in advance. Once peak deadlines conclude, staff members are actively encouraged to rest and utilize accrued leave.',
        ],
        rules: [
            'Saturdays are respected as complete rest days.',
            'Good work is recognized publicly; coaching and corrections happen privately.',
            'Rest and recovery leave supported following peak busy seasons.',
        ],
    },
    {
        id: '17-acknowledgement',
        sectionNumber: '17',
        title: 'Acknowledgement and Declaration',
        category: 'ACKNOWLEDGEMENT',
        paragraphs: [
            'I confirm that I have received, read, and understood the R. Sapkota & Associates Employee Handbook. I understand its standards and agree to follow them in my daily conduct and professional engagements.',
            'I understand that the firm may update this handbook as needed, and that any amendments will be communicated in writing with an updated version number.',
            'All team members are required to complete the official acknowledgment declaration via the firm’s Google Form. The Admin and HR Coordinator maintains the master compliance register.',
        ],
        calloutRule: {
            label: 'DECLARATION REQUIRED',
            text: 'Click the declaration link below to submit your official acknowledgment record.',
        },
    },
];
