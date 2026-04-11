import { TaskType, AuditPhase } from '../types';

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
