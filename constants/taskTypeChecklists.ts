import { TaskType, AuditPhase } from '../types';

export const TASK_TYPE_CHECKLISTS: Record<
  TaskType,
  Partial<Record<AuditPhase, { title: string; minimumRequirement?: string; daysOffset?: number }[]>>
> = {

  [TaskType.STATUTORY_AUDIT]: {
    [AuditPhase.ONBOARDING]: [
      { title: 'Obtain engagement letter signed by client', minimumRequirement: 'Signed original', daysOffset: 1 },
      { title: 'Collect prior year audit report and financial statements', minimumRequirement: 'Last 2 years', daysOffset: 2 },
      { title: 'Verify PAN/VAT registration of client', daysOffset: 1 },
      { title: 'Obtain Board resolution authorizing audit', minimumRequirement: 'Certified copy', daysOffset: 3 },
      { title: 'Complete client KYC and risk assessment', minimumRequirement: 'KYC form filled', daysOffset: 2 },
      { title: 'Assess independence and conflict of interest', daysOffset: 1 },
      { title: 'Confirm audit fee and payment terms', daysOffset: 2 },
      { title: 'Prepare and share document request list with client', daysOffset: 3 },
    ],
    [AuditPhase.PLANNING_AND_EXECUTION]: [
      { title: 'Prepare audit planning memorandum', minimumRequirement: 'APM approved by partner', daysOffset: 5 },
      { title: 'Assess materiality threshold', daysOffset: 3 },
      { title: 'Evaluate internal control environment', minimumRequirement: 'Internal control questionnaire', daysOffset: 5 },
      { title: 'Prepare risk assessment matrix', daysOffset: 4 },
      { title: 'Verify opening balances with prior year closing balances', daysOffset: 3 },
      { title: 'Vouch revenue transactions (sample per materiality)', minimumRequirement: 'Minimum 25 samples', daysOffset: 7 },
      { title: 'Vouch expense transactions', minimumRequirement: 'Minimum 20 samples', daysOffset: 7 },
      { title: 'Reconcile bank statements with ledger', minimumRequirement: 'All bank accounts', daysOffset: 4 },
      { title: 'Verify fixed assets register and depreciation', daysOffset: 5 },
      { title: 'Check debtors aging and confirmation letters sent', minimumRequirement: 'Top 10 debtors', daysOffset: 6 },
      { title: 'Verify creditors balance and obtain confirmations', daysOffset: 6 },
      { title: 'Check payroll and staff-related transactions', daysOffset: 5 },
      { title: 'Verify tax compliance (VAT, TDS, Income Tax)', minimumRequirement: 'All returns filed', daysOffset: 5 },
      { title: 'Prepare audit working papers for each head', minimumRequirement: 'Per NSSA standards', daysOffset: 8 },
      { title: 'Document audit observations and findings', daysOffset: 3 },
    ],
    [AuditPhase.REVIEW_AND_CONCLUSION]: [
      { title: 'Draft management letter with findings', daysOffset: 3 },
      { title: 'Obtain management responses on audit observations', minimumRequirement: 'Written responses', daysOffset: 5 },
      { title: 'Prepare draft financial statements (if applicable)', daysOffset: 5 },
      { title: 'Review draft audit report with senior/partner', daysOffset: 3 },
      { title: 'Obtain legal letter / lawyers confirmation', daysOffset: 4 },
      { title: 'Complete subsequent events review', minimumRequirement: 'Up to report date', daysOffset: 2 },
      { title: 'Issue final audit report', minimumRequirement: 'Partner-signed original', daysOffset: 2 },
      { title: 'Collect signed management representation letter', minimumRequirement: 'Date-matched to report', daysOffset: 1 },
      { title: 'File audit report with regulator (if required)', daysOffset: 3 },
      { title: 'Archive all working papers in DMS', minimumRequirement: 'Complete file', daysOffset: 2 },
    ],
  },

  [TaskType.INTERNAL_AUDIT]: {
    [AuditPhase.ONBOARDING]: [
      { title: 'Obtain internal audit charter / TOR from management', daysOffset: 1 },
      { title: 'Confirm scope, objectives, and timeline', daysOffset: 2 },
      { title: 'Collect organizational chart and process flowcharts', daysOffset: 3 },
      { title: 'Meet with key process owners', daysOffset: 3 },
      { title: 'Review prior internal audit reports', daysOffset: 2 },
    ],
    [AuditPhase.PLANNING_AND_EXECUTION]: [
      { title: 'Prepare internal audit plan and risk universe', minimumRequirement: 'Approved by management', daysOffset: 4 },
      { title: 'Evaluate design adequacy of internal controls', daysOffset: 5 },
      { title: 'Test operating effectiveness of key controls', minimumRequirement: '15+ samples per control', daysOffset: 7 },
      { title: 'Conduct process walkthroughs', daysOffset: 4 },
      { title: 'Test compliance with internal policies', daysOffset: 5 },
      { title: 'Document control gaps and recommendations', daysOffset: 3 },
      { title: 'Perform analytical procedures on key accounts', daysOffset: 4 },
    ],
    [AuditPhase.REVIEW_AND_CONCLUSION]: [
      { title: 'Draft internal audit report with observations', daysOffset: 3 },
      { title: 'Share draft report with process owners for response', daysOffset: 2 },
      { title: 'Conduct exit meeting with management', daysOffset: 2 },
      { title: 'Issue final internal audit report', daysOffset: 2 },
      { title: 'Prepare follow-up action plan tracking sheet', daysOffset: 2 },
      { title: 'Archive working papers', daysOffset: 1 },
    ],
  },

  [TaskType.COMPLIANCE_AUDIT]: {
    [AuditPhase.ONBOARDING]: [
      { title: 'Identify applicable laws, regulations, and standards', daysOffset: 2 },
      { title: 'Obtain compliance register from client', daysOffset: 2 },
      { title: 'Confirm scope of compliance audit', daysOffset: 1 },
      { title: 'Collect company registration and licenses', daysOffset: 2 },
    ],
    [AuditPhase.PLANNING_AND_EXECUTION]: [
      { title: 'Verify tax filing compliance (VAT, TDS, CIT)', minimumRequirement: 'All periods in scope', daysOffset: 5 },
      { title: 'Check Companies Act filing compliance', daysOffset: 4 },
      { title: 'Verify labor law compliance (SSF, CIT deductions)', daysOffset: 4 },
      { title: 'Check sector-specific regulatory compliance', daysOffset: 5 },
      { title: 'Review board meeting minutes and AGM compliance', daysOffset: 3 },
      { title: 'Verify foreign exchange compliance (if applicable)', daysOffset: 3 },
    ],
    [AuditPhase.REVIEW_AND_CONCLUSION]: [
      { title: 'Prepare compliance gap report', minimumRequirement: 'Categorized by severity', daysOffset: 3 },
      { title: 'Provide recommendations for compliance gaps', daysOffset: 3 },
      { title: 'Issue compliance certificate (if applicable)', daysOffset: 2 },
      { title: 'Archive working papers', daysOffset: 1 },
    ],
  },

  [TaskType.CERTIFICATION_SERVICE]: {
    [AuditPhase.ONBOARDING]: [
      { title: 'Understand purpose of certificate required', daysOffset: 1 },
      { title: 'Identify regulatory/recipient authority requirements', daysOffset: 1 },
      { title: 'Collect relevant financial data and documents', daysOffset: 2 },
    ],
    [AuditPhase.PLANNING_AND_EXECUTION]: [
      { title: 'Verify accuracy of data to be certified', minimumRequirement: 'Supported by source docs', daysOffset: 3 },
      { title: 'Perform agreed-upon procedures', daysOffset: 3 },
      { title: 'Cross-verify with audited financials / tax returns', daysOffset: 2 },
      { title: 'Document basis of certification', daysOffset: 2 },
    ],
    [AuditPhase.REVIEW_AND_CONCLUSION]: [
      { title: 'Draft certificate on firm letterhead', daysOffset: 1 },
      { title: 'Partner review and sign-off', minimumRequirement: 'Partner signature + seal', daysOffset: 1 },
      { title: 'Deliver certificate to client', daysOffset: 1 },
      { title: 'Archive copy of issued certificate', daysOffset: 1 },
    ],
  },

  [TaskType.FINANCIAL_MANAGEMENT]: {
    [AuditPhase.ONBOARDING]: [
      { title: 'Understand client accounting system and software', daysOffset: 1 },
      { title: 'Collect chart of accounts', daysOffset: 1 },
      { title: 'Review prior period financials', daysOffset: 2 },
      { title: 'Agree on monthly deliverables and deadlines', daysOffset: 1 },
    ],
    [AuditPhase.PLANNING_AND_EXECUTION]: [
      { title: 'Post journal entries for the period', minimumRequirement: 'All transactions posted', daysOffset: 5 },
      { title: 'Reconcile bank accounts', minimumRequirement: 'All accounts reconciled', daysOffset: 3 },
      { title: 'Process payroll entries', daysOffset: 3 },
      { title: 'Compute and post depreciation', daysOffset: 2 },
      { title: 'Prepare VAT computation and filing', daysOffset: 4 },
      { title: 'Prepare TDS computation and deposit', daysOffset: 3 },
      { title: 'Prepare trial balance', daysOffset: 3 },
    ],
    [AuditPhase.REVIEW_AND_CONCLUSION]: [
      { title: 'Prepare financial statements (BS, P&L, Cash Flow)', minimumRequirement: 'Per NFRS/NAS', daysOffset: 4 },
      { title: 'Partner review of financial statements', daysOffset: 2 },
      { title: 'Deliver management accounts to client', daysOffset: 1 },
      { title: 'File returns if applicable', daysOffset: 2 },
    ],
  },

  [TaskType.GENERAL]: {},
  [TaskType.OTHER]: {},

};
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  [TaskType.INTERNAL_AUDIT]: 'Internal Audit',
  [TaskType.STATUTORY_AUDIT]: 'Statutory Audit',
  [TaskType.COMPLIANCE_AUDIT]: 'Compliance Audit',
  [TaskType.CERTIFICATION_SERVICE]: 'Certification Service',
  [TaskType.FINANCIAL_MANAGEMENT]: 'Financial Management and Accounting',
  [TaskType.GENERAL]: 'General',
  [TaskType.OTHER]: 'Other',
};

export const TASK_TYPE_ICONS: Record<TaskType, string> = {
  [TaskType.INTERNAL_AUDIT]: 'ShieldCheck',
  [TaskType.STATUTORY_AUDIT]: 'Scale',
  [TaskType.COMPLIANCE_AUDIT]: 'ClipboardCheck',
  [TaskType.CERTIFICATION_SERVICE]: 'Award',
  [TaskType.FINANCIAL_MANAGEMENT]: 'BarChart2',
  [TaskType.GENERAL]: 'Activity',
  [TaskType.OTHER]: 'FolderOpen',
};
