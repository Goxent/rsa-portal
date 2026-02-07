
import { UserRole, UserProfile, Client, Task, AttendanceRecord, TaskStatus, TaskPriority, CalendarEvent, LeaveRequest, Resource } from '../types';

// --- MOCK DATA GENERATORS ---

const MOCK_USERS: UserProfile[] = [
  { 
    uid: 'admin_1', 
    email: 'anil99sunar@gmail.com', 
    displayName: 'Anil Sunar', 
    role: UserRole.ADMIN, 
    department: 'Management',
    isSetupComplete: true,
    phoneNumber: '9800000001',
    status: 'Active',
    position: 'Admin',
    dateOfJoining: '2020-01-01',
    address: 'Kathmandu, Nepal',
    gender: 'Male'
  },
  { 
    uid: 'admin_2', 
    email: 'anil99senchury@gmail.com', 
    displayName: 'Anil Senchury', 
    role: UserRole.ADMIN, 
    department: 'Management',
    isSetupComplete: true,
    phoneNumber: '9800000002',
    status: 'Active',
    position: 'Admin',
    dateOfJoining: '2020-01-01',
    address: 'Lalitpur, Nepal',
    gender: 'Male'
  },
  { 
    uid: 'staff_1', 
    email: 'staff1@rsa.com', 
    displayName: 'Ram Thapa', 
    role: UserRole.STAFF, 
    department: 'Audit',
    isSetupComplete: true,
    phoneNumber: '9811111111',
    status: 'Active',
    position: 'Staff',
    dateOfJoining: '2022-05-15',
    address: 'Bhaktapur, Nepal',
    gender: 'Male'
  },
  { 
    uid: 'staff_2', 
    email: 'staff2@rsa.com', 
    displayName: 'Sita Sharma', 
    role: UserRole.STAFF, 
    department: 'Tax',
    isSetupComplete: true,
    phoneNumber: '9822222222',
    status: 'Active',
    position: 'Staff',
    dateOfJoining: '2023-02-10',
    address: 'Koteshwor, Kathmandu',
    gender: 'Female'
  }
];

const MOCK_CLIENTS: Client[] = [
    { 
      id: 'c1', name: 'Alpha Industries', code: 'CL-001', serviceType: 'Audit', status: 'Active', 
      contactPerson: 'John Doe', phone: '9851000000', folderLink: '#', email: 'contact@alpha.com',
      category: 'A', industry: 'Manufacturing', address: 'Balaju, Kathmandu', panNumber: '600000001'
    },
    { 
      id: 'c2', name: 'Beta Health Services', code: 'CL-002', serviceType: 'Consulting', status: 'Active', 
      contactPerson: 'Jane Smith', phone: '9841000000', folderLink: '#', email: 'info@beta.com',
      category: 'B', industry: 'Consulting', address: 'Putalisadak, Kathmandu', panNumber: '600000002'
    },
    { 
      id: 'c3', name: 'Gamma Hydropower', code: 'CL-003', serviceType: 'Tax', status: 'Inactive', 
      contactPerson: 'Hari Gopal', phone: '9802000000', folderLink: '#', email: 'hari@gamma.com',
      category: 'A', industry: 'Hydropower', address: 'Butwal, Rupandehi', panNumber: '600000003'
    }
];

const MOCK_TASKS: Task[] = [
    { 
        id: 't1', 
        title: 'Q3 Financial Audit', 
        description: 'Complete the quarterly audit report for Alpha.', 
        assignedTo: ['staff_1'], 
        assignedToNames: ['Ram Thapa'], 
        createdBy: 'admin_1', 
        clientId: 'c1', 
        clientName: 'Alpha Industries', 
        status: TaskStatus.IN_PROGRESS, 
        priority: TaskPriority.HIGH, 
        dueDate: '2023-11-15', 
        createdAt: '2023-10-25',
        subtasks: []
    },
    { 
        id: 't2', 
        title: 'VAT Return Filing', 
        description: 'File VAT return for Beta Health.', 
        assignedTo: ['staff_2'], 
        assignedToNames: ['Sita Sharma'], 
        createdBy: 'admin_1', 
        clientId: 'c2', 
        clientName: 'Beta Health Services', 
        status: TaskStatus.NOT_STARTED, 
        priority: TaskPriority.URGENT, 
        dueDate: '2023-10-30', 
        createdAt: '2023-10-26',
        subtasks: []
    }
];

const MOCK_LEAVES: LeaveRequest[] = [
    {
        id: '1',
        userId: 'staff_1',
        userName: 'Ram Thapa',
        type: 'Casual',
        startDate: '2023-10-12',
        endDate: '2023-10-13',
        reason: 'Family Function',
        status: 'APPROVED',
        createdAt: '2023-10-10'
    },
    {
        id: '2',
        userId: 'staff_2',
        userName: 'Sita Sharma',
        type: 'Sick',
        startDate: '2023-11-01',
        endDate: '2023-11-01',
        reason: 'Doctor Appointment',
        status: 'PENDING',
        createdAt: '2023-10-24'
    }
];

const MOCK_RESOURCES: Resource[] = [
    { id: '1', title: 'Nepal Standards on Auditing 2024', type: 'folder', category: 'Audit', updatedAt: '2024-01-15', link: 'https://drive.google.com/drive/u/0/folders/1' },
    { id: '7', title: 'Nepal Financial Reporting Standards 2024', type: 'folder', category: 'Audit', updatedAt: '2024-02-01', link: '#' },
    { id: '2', title: 'Tax Rates FY 2081/82', type: 'pdf', category: 'Tax', updatedAt: '2024-07-16', link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: '3', title: 'Employee Handbook', type: 'doc', category: 'HR', updatedAt: '2023-08-20', link: 'https://docs.google.com/document/d/1' },
    { id: '4', title: 'VAT Calculation Template', type: 'sheet', category: 'Tax', updatedAt: '2023-10-05', link: 'https://docs.google.com/spreadsheets/d/1' },
    { id: '5', title: 'Client Onboarding Checklist', type: 'doc', category: 'Management', updatedAt: '2023-09-01', link: '#' },
];

// --- LOCAL STORAGE HELPERS ---
const KEYS = {
    USER_SESSION: 'rsa_mock_session',
    USERS: 'rsa_mock_users',
    CLIENTS: 'rsa_mock_clients',
    TASKS: 'rsa_mock_tasks',
    ATTENDANCE: 'rsa_mock_attendance',
    EVENTS: 'rsa_mock_events',
    LEAVES: 'rsa_mock_leaves',
    RESOURCES: 'rsa_mock_resources'
};

const getStorage = <T>(key: string, defaultData: T[]): T[] => {
    const stored = localStorage.getItem(key);
    if (!stored) {
        localStorage.setItem(key, JSON.stringify(defaultData));
        return defaultData;
    }
    return JSON.parse(stored);
};

const setStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// --- MOCK AUTH OBJECT (To satisfy imports) ---
export const auth = {
    currentUser: null as any, // Managed by AuthService internally
    signOut: async () => {}
};

export const db = {}; // Dummy export
export const googleProvider = {}; // Dummy export

// --- MOCK SERVICE IMPLEMENTATION ---

export const AuthService = {
  // Mock Login: Accepts any password for prototype simplicity
  login: async (email: string, pass: string): Promise<any> => {
      // Initialize Users if needed
      const users = getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
      
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (user) {
          if (user.status === 'Inactive') {
              throw new Error("Account is inactive. Please contact Admin.");
          }
          // Simulate network delay
          await new Promise(r => setTimeout(r, 500));
          localStorage.setItem(KEYS.USER_SESSION, JSON.stringify(user));
          auth.currentUser = { ...user, emailVerified: true }; // Mock Firebase User object properties
          return user;
      } else {
          throw new Error("User not found in Staff Directory. Please ask Admin to add your email first.");
      }
  },

  register: async (email: string, pass: string): Promise<any> => {
      const users = getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!existingUser) {
          throw new Error("Access Denied: Your email is not maintained in the Staff Directory. Only authorized staff can sign up.");
      }
      
      if (existingUser.status === 'Inactive') {
          throw new Error("Account is marked Inactive. Contact Admin.");
      }

      // In a real system, this is where we'd create the Auth record.
      // Since the profile already exists (created by Admin), we just "log them in".
      // We assume this step confirms they can access their pre-provisioned account.
      
      localStorage.setItem(KEYS.USER_SESSION, JSON.stringify(existingUser));
      return existingUser;
  },

  loginWithGoogle: async (): Promise<any> => {
      // Simulates logging in as the main admin for demo
      const admin = MOCK_USERS[0];
      localStorage.setItem(KEYS.USER_SESSION, JSON.stringify(admin));
      return admin;
  },

  logout: async () => {
      localStorage.removeItem(KEYS.USER_SESSION);
      auth.currentUser = null;
  },

  // In Mock mode, simply returns the user passed in or fetches from storage
  syncUserProfile: async (fbUser: any): Promise<UserProfile> => {
      const users = getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
      const found = users.find(u => u.uid === fbUser.uid);
      return found || fbUser;
  },

  updateUserProfile: async (uid: string, data: Partial<UserProfile>) => {
      const users = getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
      const index = users.findIndex(u => u.uid === uid);
      if (index !== -1) {
          users[index] = { ...users[index], ...data };
          setStorage(KEYS.USERS, users);
          // Update session if it's the current user
          const session = JSON.parse(localStorage.getItem(KEYS.USER_SESSION) || '{}');
          if (session.uid === uid) {
              localStorage.setItem(KEYS.USER_SESSION, JSON.stringify(users[index]));
          }
      }
  },

  createStaffUser: async (staffData: Partial<UserProfile>) => {
      const users = getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
      if (users.find(u => u.email.toLowerCase() === staffData.email?.toLowerCase())) {
          throw new Error("Staff with this email already exists.");
      }
      
      const newUser: UserProfile = {
          uid: 'u_' + Date.now(),
          email: staffData.email || '',
          displayName: staffData.displayName || 'New Staff',
          role: staffData.role || UserRole.STAFF,
          department: staffData.department || 'General',
          isSetupComplete: false,
          status: 'Active',
          phoneNumber: staffData.phoneNumber,
          address: staffData.address,
          position: staffData.position,
          dateOfJoining: staffData.dateOfJoining,
          gender: staffData.gender || 'Other',
          photoURL: staffData.photoURL
      };
      
      users.push(newUser);
      setStorage(KEYS.USERS, users);
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
      return getStorage<UserProfile>(KEYS.USERS, MOCK_USERS);
  },

  // --- CLIENTS ---
  getAllClients: async (): Promise<Client[]> => {
      return getStorage<Client>(KEYS.CLIENTS, MOCK_CLIENTS);
  },

  addClient: async (client: Client) => {
      const clients = getStorage<Client>(KEYS.CLIENTS, MOCK_CLIENTS);
      const newClient = { ...client, id: 'c_' + Date.now() };
      clients.unshift(newClient);
      setStorage(KEYS.CLIENTS, clients);
      return newClient.id;
  },

  updateClient: async (client: Client) => {
      const clients = getStorage<Client>(KEYS.CLIENTS, MOCK_CLIENTS);
      const idx = clients.findIndex(c => c.id === client.id);
      if (idx !== -1) {
          clients[idx] = client;
          setStorage(KEYS.CLIENTS, clients);
      }
  },

  deleteClient: async (id: string) => {
      let clients = getStorage<Client>(KEYS.CLIENTS, MOCK_CLIENTS);
      clients = clients.filter(c => c.id !== id);
      setStorage(KEYS.CLIENTS, clients);
  },

  // --- TASKS ---
  getAllTasks: async (): Promise<Task[]> => {
      return getStorage<Task>(KEYS.TASKS, MOCK_TASKS);
  },

  saveTask: async (task: Task) => {
      const tasks = getStorage<Task>(KEYS.TASKS, MOCK_TASKS);
      if (task.id.startsWith('t_') || !tasks.find(t => t.id === task.id)) {
          // Create
           const newTask = { ...task, id: task.id || 't_' + Date.now() };
           tasks.unshift(newTask);
      } else {
          // Update
          const idx = tasks.findIndex(t => t.id === task.id);
          if (idx !== -1) tasks[idx] = task;
      }
      setStorage(KEYS.TASKS, tasks);
  },

  deleteTask: async (taskId: string) => {
      let tasks = getStorage<Task>(KEYS.TASKS, MOCK_TASKS);
      tasks = tasks.filter(t => t.id !== taskId);
      setStorage(KEYS.TASKS, tasks);
  },

  // --- ATTENDANCE ---
  getAttendanceHistory: async (userId?: string): Promise<AttendanceRecord[]> => {
      const all = getStorage<AttendanceRecord>(KEYS.ATTENDANCE, []);
      if (userId) {
          return all.filter(r => r.userId === userId);
      }
      return all;
  },

  recordAttendance: async (record: AttendanceRecord) => {
      const records = getStorage<AttendanceRecord>(KEYS.ATTENDANCE, []);
      
      // Check if record exists for this user and date
      const idx = records.findIndex(r => r.userId === record.userId && r.date === record.date);

      if (idx !== -1) {
          // Logic 1: Existing Record Found
          const existing = records[idx];
          
          // Safety: If regular user is trying to clock in again (no clockOut in request, but existing has In)
          if (!record.clockOut && existing.clockIn && !existing.clockOut && record.id === 'temp_id') {
               throw new Error("Attendance already recorded for today.");
          }

          // Update/Merge existing record
          // This handles:
          // 1. Clock Out (updating an open record)
          // 2. Admin Correction (updating any fields)
          records[idx] = { ...existing, ...record };
          setStorage(KEYS.ATTENDANCE, records);
      } else {
          // Logic 2: No Record Found -> Create New
          // This handles:
          // 1. First Clock In of the day
          // 2. Admin Manual Entry (creating a past record)
          const newRecord = { ...record, id: record.id || 'att_' + Date.now() };
          // For manually added records where ID might be 'temp_id' but passed as full record
          if (newRecord.id === 'temp_id') newRecord.id = 'att_' + Date.now();
          
          records.unshift(newRecord);
          setStorage(KEYS.ATTENDANCE, records);
      }
  },

  getLateCountLast30Days: async (userId: string): Promise<number> => {
      const records = getStorage<AttendanceRecord>(KEYS.ATTENDANCE, []);
      return records.filter(r => r.userId === userId && r.status === 'LATE').length;
  },

  // --- EVENTS ---
  getAllEvents: async (): Promise<CalendarEvent[]> => {
    return getStorage<CalendarEvent>(KEYS.EVENTS, []);
  },

  saveEvent: async (event: CalendarEvent) => {
    const events = getStorage<CalendarEvent>(KEYS.EVENTS, []);
    events.push({ ...event, id: 'evt_' + Date.now() });
    setStorage(KEYS.EVENTS, events);
  },

  // --- LEAVES ---
  getAllLeaves: async (userId?: string): Promise<LeaveRequest[]> => {
     const all = getStorage<LeaveRequest>(KEYS.LEAVES, MOCK_LEAVES);
     if (userId) return all.filter(l => l.userId === userId);
     return all;
  },

  requestLeave: async (leave: LeaveRequest) => {
      const leaves = getStorage<LeaveRequest>(KEYS.LEAVES, MOCK_LEAVES);
      leaves.unshift({ ...leave, id: 'lr_' + Date.now() });
      setStorage(KEYS.LEAVES, leaves);
  },

  updateLeaveStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
      const leaves = getStorage<LeaveRequest>(KEYS.LEAVES, MOCK_LEAVES);
      const idx = leaves.findIndex(l => l.id === id);
      if (idx !== -1) {
          leaves[idx].status = status;
          setStorage(KEYS.LEAVES, leaves);
      }
  },

  // --- RESOURCES ---
  getAllResources: async (): Promise<Resource[]> => {
      return getStorage<Resource>(KEYS.RESOURCES, MOCK_RESOURCES);
  },

  addResource: async (resource: Resource) => {
      const resources = getStorage<Resource>(KEYS.RESOURCES, MOCK_RESOURCES);
      resources.push({ ...resource, id: 'res_' + Date.now() });
      setStorage(KEYS.RESOURCES, resources);
  },
  
  deleteResource: async (id: string) => {
      let resources = getStorage<Resource>(KEYS.RESOURCES, MOCK_RESOURCES);
      resources = resources.filter(r => r.id !== id);
      setStorage(KEYS.RESOURCES, resources);
  }
};

export const isDemoMode = true;
