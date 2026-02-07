
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
  clientId?: string; // Link to Client Database
  clientName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  driveFolderLink?: string;
  sopLink?: string;
  createdAt: string;
  attachments?: Attachment[];
  subtasks?: SubTask[];
}

export interface Client {
  id: string;
  name: string;
  code: string;
  serviceType: 'Audit' | 'Tax' | 'Accounting' | 'Consulting';
  folderLink: string;
  assignedStaffId?: string;
  status: 'Active' | 'Inactive';
  email?: string;
  phone?: string;
  contactPerson?: string;
  notes?: string;
  // New Fields
  category?: 'A' | 'B' | 'C';
  industry?: 'Hydropower' | 'Manufacturing' | 'Trading' | 'Consulting' | 'Security Broker' | 'Other';
  address?: string;
  panNumber?: string;
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

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  type: 'MEETING' | 'DEADLINE' | 'GENERAL';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'WARNING' | 'INFO' | 'SUCCESS';
  read: boolean;
  createdAt: string;
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
