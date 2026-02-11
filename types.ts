
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
  status?: 'Active' | 'Inactive';
  gender?: 'Male' | 'Female' | 'Other';
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
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'CORRECTED';
  workHours: number; // in hours
  // New Reporting Fields
  clientId?: string;
  clientName?: string;
  clientIds?: string[]; // Multiple clients
  workDescription?: string;
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  HALTED = 'HALTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED'
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
  driveFolderLink?: string;
  sopLink?: string;
  createdAt: string;
  completedAt?: string;
  attachments?: Attachment[];
  subtasks?: SubTask[];
}

export interface Client {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  pan?: string; // Tax ID
  address?: string;
  serviceType: 'Audit' | 'Tax' | 'Accounting' | 'Consulting' | 'Other';
  status: 'Active' | 'Inactive';
  auditorId?: string; // Linked Staff ID
  signingAuthority?: string; // NEW: Signing Authority (e.g., R. Sapkota & Associates)
  fiscalYear?: string;
  folderLink?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;

  // New Fields
  industryType?: 'Hydropower' | 'Manufacturing' | 'Trading' | 'Service' | 'Bank' | 'Insurance' | 'Other';
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'Sick' | 'Casual' | 'Annual' | 'Unpaid';
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
  type: 'folder' | 'pdf' | 'doc' | 'sheet' | 'article';
  category: string; // Keep for legacy/filtering
  updatedAt: string;
  link?: string; // Optional for folders/articles
  content?: string; // HTML/Markdown for articles
  parentId?: string | null; // For hierarchy
  previewLink?: string;
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
  // Status-based automatic subtasks
  statusSubtasks?: {
    [key in TaskStatus]?: { title: string; minimumRequirement?: string; }[];
  };
  // Auto-Apply Rules
  autoApplyRules?: {
    industryType?: string;
    serviceType?: string; // e.g., Audit, Tax
  };
}
