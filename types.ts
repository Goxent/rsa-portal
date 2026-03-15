
export enum UserRole {
  MASTER_ADMIN = 'MASTER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  photoURL?: string;
  phoneNumber?: string;
  isSetupComplete?: boolean;
  // Extended Fields for Staff Directory
  address?: string;
  dateOfJoining?: string;
  position?: string;
  status?: 'Active' | 'Inactive' | 'Pending Approval';
  gender?: 'Male' | 'Female' | 'Other';
  leaveAdjustment?: number; // Manual correction for leave balance
}

export interface StaffDirectoryProfile {
  uid: string;
  displayName: string;
  email: string; // Official email is usually public within org
  role: UserRole;
  department: string;
  position?: string;
  phoneNumber?: string; // Optional, maybe business phone?
  status?: 'Active' | 'Inactive' | 'Pending Approval';
  photoURL?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfJoining?: string; // Often harmless, but can be omitted if super strict
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // ISO Date YYYY-MM-DD
  clockIn: string; // ISO Timestamp
  clockOut?: string; // ISO Timestamp
  notes?: string; // Used for Late Reason or Admin correction notes
  location?: { lat: number; lng: number };
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'CORRECTED' | 'ON LEAVE';
  workHours: number; // in hours
  // New Reporting Fields
  clientId?: string;
  clientName?: string;
  clientIds?: string[]; // Multiple clients
  workDescription?: string;
  workLogs?: WorkLog[]; // Detailed work breakdown
}

export interface WorkLog {
  id: string;
  clientId: string;
  clientName: string;
  description: string;
  duration: number;   // in hours
  billable: boolean;
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  HALTED = 'HALTED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export interface TaskStatusConfig {
  status: TaskStatus;
  label: string;
  color: string;
  isEmailEnabled?: boolean;
  emailTemplateId?: 'DEFAULT' | 'ASSIGNMENT' | 'STATUS_CHANGE' | 'URGENT_REMINDER';
  autoAssignTo?: string[];
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'FILE' | 'LINK';
}

export interface SubTask {
  id: string;
  title: string;
  minimumRequirement?: string; // e.g., "Check invoices > 10k"
  isCompleted: boolean;
  createdBy: string; // Name of user who added it
  createdAt: string;
  assignedTo?: string; // NEW: Specific staff member assigned to this checklist item
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string[]; // Array of User UIDs
  assignedToNames: string[]; // Array of Names for display
  createdBy: string; // User UID
  clientId?: string; // DEPRECATED: Single client (kept for backward compatibility)
  clientIds?: string[]; // NEW: Multiple clients support
  clientName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  estimatedDays?: number; // For Resource Planning
  driveFolderLink?: string;
  sopLink?: string;
  createdAt: string;
  completedAt?: string;
  attachments?: Attachment[];
  subtasks?: SubTask[];
  teamLeaderId?: string; // UID of the designated team leader
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: TaskComment[];

  // Advanced Workflow Features (TaxDome-style)
  tags?: string[]; // Custom status/category tags
  totalTimeSpent?: number; // Total minutes logged on this task
}

export interface TaskComment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: string;
  mentions?: string[]; // userIds
}

export interface Client {
  id: string;
  name: string;
  code: string;
  pan?: string;       // New from previous refactor
  phone?: string;     // New from previous refactor
  email?: string;     // New from previous refactor
  address?: string;   // New from previous refactor

  // Services / Types
  serviceType: 'Statutory Audit' | 'Tax Filing' | 'Compliance Audit' | 'Internal Audit' | 'Advisory Services' | 'Bookkeeping' | 'VAT Filing' | 'ITR Filing' | 'Other';
  industry: 'Airlines' | 'Consulting' | 'Co-operatives' | 'Courier' | 'Education' | 'Hotel & Restaurant' | 'Hydropower' | 'Investment' | 'IT Consulting' | 'Joint Venture' | 'Manufacturing' | 'NGO/INGO' | 'NPO' | 'Others' | 'Securities Broker' | 'Trading';
  category: 'A' | 'B' | 'C';
  status: 'Active' | 'Inactive' | 'Pending';

  // Tax & Compliance
  vatReturn?: boolean; // New: Needs VAT Return (Every Nepali 25th)
  itrReturn?: boolean; // New: Needs Income Tax Return

  // Management
  signingAuthorityId?: string; // UID of the signee (Partner/Manager)
  signingAuthority?: string; // Display Name (Partner/Manager)
  contactPerson?: string;
  contactPersonRole?: string;

  // Billing (New)
  billingAmount?: number;
  paymentStatus?: 'Paid' | 'Pending' | 'Partial' | 'Overdue';

  // Management
  auditorId?: string;
  createdAt?: string;
  updatedAt?: string;

  // Nepal Specific Context (Statutory)
  registrationNumber?: string;
  registrationDate?: string; // BS or AD string
  vatNumber?: string;
  wardNumber?: string;
  vdcMunicipality?: string;
  district?: string;
  taxClearanceUntil?: string; // Fiscal Year e.g., "2080/81"
  fiscalYearEnd?: string;

  // Knowledge Base / KYC Documents
  documents?: {
    id: string;
    title: string;
    url: string;
    category: 'KYC' | 'Legal' | 'Tax' | 'Audit' | 'Other';
    uploadedAt: string;
    uploadedBy: string;
  }[];
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'Sick' | 'Casual' | 'Annual' | 'Unpaid' | 'Exam' | 'Home' | 'Other';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// Event visibility levels
export type EventVisibility = 'PRIVATE' | 'PUBLIC' | 'TEAM' | 'DEPARTMENT';

// Event types
export type EventType = 'MEETING' | 'DEADLINE' | 'GENERAL' | 'PERSONAL' | 'FIRM_EVENT' | 'HOLIDAY';

// RSVP status
export type RSVPStatus = 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

// Recurrence rule for recurring events
export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number; // Every X days/weeks/months/years
  endDate?: string; // When recurrence stops (YYYY-MM-DD)
  daysOfWeek?: number[]; // For weekly recurrence (0=Sunday, 6=Saturday)
}

// Event reminder configuration
export interface EventReminder {
  type: 'EMAIL' | 'IN_APP';
  minutesBefore: number; // Minutes before event to send reminder
}

// Enhanced CalendarEvent interface
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  endTime?: string; // HH:MM (for duration)
  description?: string;
  type: EventType;

  // NEW: Event ownership and visibility
  createdBy: string; // User UID who created the event
  visibility: EventVisibility; // Who can see this event
  teamIds?: string[]; // For TEAM visibility - array of user UIDs
  department?: string; // For DEPARTMENT visibility

  // NEW: Recurring events
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  parentEventId?: string; // For instances of recurring events

  // NEW: Participants and RSVP
  participants?: string[]; // Array of user UIDs invited to event
  rsvpRequired?: boolean;
  rsvpResponses?: {
    [userId: string]: RSVPStatus;
  };

  // NEW: Reminders
  reminders?: EventReminder[];

  // NEW: Additional metadata
  color?: string; // Hex color for event category
  location?: string; // Physical or virtual location
  attachments?: string[]; // File URLs or references
  createdAt?: string; // ISO timestamp when created
  updatedAt?: string; // ISO timestamp when last modified
}

export interface AppNotification {
  id: string;
  userId: string; // The user who should see this notification
  title: string;
  message: string;
  type: 'WARNING' | 'INFO' | 'SUCCESS';
  category: 'TASK' | 'LEAVE' | 'EVENT' | 'SYSTEM';
  link?: string; // Optional navigation link (e.g., /tasks)
  read: boolean;
  createdAt: string; // ISO Timestamp
}

export interface Resource {
  id: string;
  title: string;
  type: 'folder' | 'pdf' | 'doc' | 'sheet' | 'article' | 'image';
  category: string; // Keep for legacy/filtering
  updatedAt: string;
  link?: string; // Optional for folders/articles
  content?: string; // HTML/Markdown for articles
  parentId?: string | null; // For hierarchy
  previewLink?: string;
  fileId?: string;
  downloadUrl?: string; // For documents that need direct download
  fileSize?: number; // File size in bytes
  createdBy?: string; // UID of the uploader
  createdByName?: string; // Display name of the uploader
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  category: string;
  subtasks: string[]; // Deprecated: Use subtaskDetails instead if available
  subtaskDetails?: { title: string; minimumRequirement?: string; }[]; // Enhanced subtasks
  expectedDays?: number;
  createdAt: string;
  updatedAt?: string;
  documentLink?: string;
  // Status-based automatic subtasks
  statusSubtasks?: {
    [key in TaskStatus]?: { title: string; minimumRequirement?: string; }[];
  };
  // Auto-Apply Rules
  autoApplyRules?: {
    industryType?: string;
    serviceType?: string; // e.g., Audit, Tax
  };
  // New fields for Template Library Upgrade
  attachments?: Attachment[];
  tags?: string[];
  isPublic?: boolean;
  usageCount?: number;
  type?: string;
  content?: string;
  createdBy?: string;
}

export type Template = TaskTemplate;

export interface Category {
  id: string;
  label: string;
  icon: string; // Helper to map to Lucide icons (e.g., 'Book', 'FileText')
  color?: string; // Hex or Tailwind class for styling
  createdAt: string;
}

// --- Performance Evaluation System Types ---

export interface ScoringComponents {
  completion_rate: number;
  on_time_delivery: number;
  punctuality: number;
  task_quality: number;
  task_difficulty: number;
}

export interface FinalizedPerformanceScore {
  user_id: string;
  user_name: string;
  total_score: number;
  rank: number;
  components: ScoringComponents;
  eligibility: {
    qualified: boolean;
    reason?: string;
    failed_criteria?: string[];
  };
}

export interface PerformanceCycle {
  id: string;
  tenant_id: string;
  month: string; // "2026-02"
  status: 'ACTIVE' | 'FINALIZED' | 'ARCHIVED';
  finalized_at: string; // ISO Timestamp
  staff_scores: Record<string, FinalizedPerformanceScore>;
  staff_of_month: {
    user_id: string;
    score: number;
    rank: 1;
    reason: string;
  };
  team_stats: {
    avg_score: number;
    median_score: number;
    total_tasks: number;
  };
}

export interface PerformanceGoal {
  id: string;
  user_id: string;
  month: string;
  metric: 'TOTAL_SCORE' | 'COMPLETION_RATE' | 'PUNCTUALITY' | 'ON_TIME_RATE';
  target: number;
  current: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';
  progress: number; // 0-100%
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  points: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  icon: string;
  earnedAt?: string;
}

export interface PointsBreakdown {
  user_id: string;
  month: string;
  total_points: number;
  breakdown: {
    tasks_completed: number;
    early_completions: number;
    perfect_weeks: number;
    helping_others: number;
    learning_activities: number;
    zero_late_days: number;
  };
}

export interface Streaks {
  user_id: string;
  perfect_days: {
    current: number;
    longest: number;
    started_at: string;
  };
  on_time_tasks: {
    current: number;
    longest: number;
  };
  zero_late_attendance: {
    current: number;
    longest: number;
  };
}

export interface PeerReview {
  id: string;
  cycle_id: string;
  reviewer_id: string;
  reviewee_id: string;
  ratings: {
    teamwork: number;         // 1-5
    communication: number;    // 1-5
    technical_skills: number; // 1-5
    reliability: number;      // 1-5
    helpfulness: number;      // 1-5
  };
  strengths: string[];
  areas_for_improvement: string[];
  specific_feedback: string;
  would_work_with_again: boolean;
  is_anonymous: boolean;
  submitted_at: string;
}

export interface PeerFeedbackSummary {
  reviewee_id: string;
  cycle_id: string;
  total_reviews: number;
  avg_ratings: {
    teamwork: number;
    communication: number;
    technical_skills: number;
    reliability: number;
    helpfulness: number;
  };
  common_strengths: string[];
  common_improvements: string[];
  overall_sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}
