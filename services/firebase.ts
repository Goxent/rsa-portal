import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    ActionCodeSettings,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from 'firebase/firestore';
import { UserRole, UserProfile, Client, Task, AttendanceRecord, TaskStatus, TaskPriority, CalendarEvent, LeaveRequest, Resource, AppNotification } from '../types';

// Load Config from Environment Variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase Config
const validateConfig = () => {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
    const missing = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

    if (missing.length > 0) {
        console.error('Missing Firebase configuration:', missing);
        throw new Error(`Missing Firebase config: ${missing.join(', ')}. Please check your .env.local file.`);
    }
};

validateConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Action Code Settings for Email Verification
const getActionCodeSettings = (): ActionCodeSettings => {
    // Get the current URL or use a default
    const url = window.location.origin;
    return {
        url: `${url}/#/verify-email`,
        handleCodeInApp: true,
    };
};

// Helper to convert Firestore doc to Typed Object
const docConverter = <T>(doc: any): T => ({ id: doc.id, ...doc.data() });

export const AuthService = {
    // --- AUTHENTICATION ---

    login: async (email: string, pass: string): Promise<UserProfile> => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const uid = userCredential.user.uid;

            // Fetch Profile from Firestore
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                return { uid, ...userDoc.data() } as UserProfile;
            } else {
                // Fallback: If Auth successful but no Profile, create one!
                const newUser: UserProfile = {
                    uid,
                    email,
                    displayName: email.split('@')[0],
                    role: UserRole.STAFF,
                    department: 'General',
                    isSetupComplete: false,
                    status: 'Active',
                    phoneNumber: '',
                    address: '',
                    position: 'Staff',
                    dateOfJoining: new Date().toLocaleDateString('en-CA'),
                    gender: 'Other'
                };
                await setDoc(doc(db, 'users', uid), newUser);
                return newUser;
            }
        } catch (error: any) {
            // Provide user-friendly error messages
            if (error.code === 'auth/user-not-found') {
                throw new Error('No account found with this email. Please sign up first.');
            } else if (error.code === 'auth/wrong-password') {
                throw new Error('Incorrect password. Please try again.');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email address format.');
            } else if (error.code === 'auth/too-many-requests') {
                throw new Error('Too many failed attempts. Please try again later.');
            } else {
                throw new Error(error.message || 'Login failed. Please try again.');
            }
        }
    },

    register: async (email: string, pass: string): Promise<UserProfile> => {
        try {
            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const uid = userCredential.user.uid;

            // Create Initial Profile in Firestore
            const newUser: UserProfile = {
                uid,
                email,
                displayName: email.split('@')[0],
                role: UserRole.STAFF,
                department: 'General',
                isSetupComplete: false,
                status: 'Active',
                phoneNumber: '',
                address: '',
                position: 'Staff',
                dateOfJoining: new Date().toLocaleDateString('en-CA'),
                gender: 'Other'
            };

            await setDoc(doc(db, 'users', uid), newUser);

            // Send Verification Email with better error handling
            try {
                const actionCodeSettings = getActionCodeSettings();
                await sendEmailVerification(userCredential.user, actionCodeSettings);
                console.log('Verification email sent successfully');
            } catch (emailError: any) {
                console.error("Failed to send verification email:", emailError);
                // Don't throw error here - user is still created
                // They can resend verification later
            }

            return newUser;
        } catch (error: any) {
            // Provide user-friendly error messages
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('An account with this email already exists. Please login instead.');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email address format.');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password should be at least 6 characters long.');
            } else if (error.code === 'auth/operation-not-allowed') {
                throw new Error('Email/password accounts are not enabled. Please contact support.');
            } else {
                throw new Error(error.message || 'Registration failed. Please try again.');
            }
        }
    },

    resetPassword: async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
            console.error("Password Reset Error:", error);
            if (error.code === 'auth/user-not-found') {
                throw new Error('No account found with this email.');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email address format.');
            } else {
                throw new Error('Failed to send reset email. Please try again.');
            }
        }
    },

    loginWithGoogle: async (): Promise<UserProfile> => {
        try {
            const provider = new GoogleAuthProvider();
            // Add custom parameters for better UX
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Check if Profile exists
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                return { uid: user.uid, ...userDoc.data() } as UserProfile;
            } else {
                // New User via Google -> Create Profile
                const newUser: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'New User',
                    role: UserRole.STAFF,
                    department: 'General',
                    isSetupComplete: false,
                    status: 'Active',
                    phoneNumber: user.phoneNumber || '',
                    address: '',
                    position: 'Staff',
                    dateOfJoining: new Date().toLocaleDateString('en-CA'),
                    gender: 'Other'
                };
                await setDoc(userDocRef, newUser);
                return newUser;
            }
        } catch (error: any) {
            // Provide user-friendly error messages
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in cancelled. Please try again.');
            } else if (error.code === 'auth/popup-blocked') {
                throw new Error('Pop-up blocked by browser. Please allow pop-ups and try again.');
            } else if (error.code === 'auth/unauthorized-domain') {
                throw new Error('This domain is not authorized for Google sign-in. Please contact support.');
            } else if (error.code === 'auth/operation-not-allowed') {
                throw new Error('Google sign-in is not enabled. Please contact support or use email/password.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // User opened multiple popups, ignore this error
                throw new Error('Please try again.');
            } else {
                console.error('Google sign-in error:', error);
                throw new Error(error.message || 'Google sign-in failed. Please try again or use email/password.');
            }
        }
    },

    logout: async () => {
        await signOut(auth);
    },

    sendVerification: async () => {
        if (auth.currentUser) {
            try {
                const actionCodeSettings = getActionCodeSettings();
                await sendEmailVerification(auth.currentUser, actionCodeSettings);
                return { success: true, message: 'Verification email sent successfully' };
            } catch (error: any) {
                console.error('Error sending verification email:', error);
                if (error.code === 'auth/too-many-requests') {
                    throw new Error('Too many requests. Please wait a few minutes before requesting another verification email.');
                }
                throw new Error('Failed to send verification email. Please try again later.');
            }
        } else {
            throw new Error('No user logged in');
        }
    },

    // Get current profile (used for sync)
    syncUserProfile: async (fbUser: any): Promise<UserProfile> => {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
            return { uid: fbUser.uid, ...userDoc.data() } as UserProfile;
        }
        throw new Error("Profile sync failed");
    },

    updateUserProfile: async (uid: string, data: Partial<UserProfile>) => {
        await updateDoc(doc(db, 'users', uid), data);
    },

    // Admin creating a placeholder user (profile only)
    createStaffUser: async (staffData: Partial<UserProfile>) => {
        // We'll create a profile with a temporary ID if no UID exists
        const tempId = 'pending_' + Date.now();
        await setDoc(doc(db, 'users', tempId), {
            ...staffData,
            uid: tempId,
            status: 'Pending Signup'
        });
    },

    // Fetch All Users (Staff Directory)
    getAllUsers: async (): Promise<UserProfile[]> => {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<UserProfile>(d));
    },

    getAllStaff: async (): Promise<UserProfile[]> => {
        const q = query(collection(db, 'users'), where('role', '!=', UserRole.ADMIN));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<UserProfile>(d));
    },

    updateUserRole: async (uid: string, role: UserRole) => {
        await updateDoc(doc(db, 'users', uid), { role });
    },

    seedDemoData: async () => {
        const demoClients: Partial<Client>[] = [
            { name: 'Apple Inc.', code: 'CL-001', serviceType: 'Audit' as any, status: 'Active' as any, category: 'A' as any, industry: 'Trading' as any },
            { name: 'Tesla Motors', code: 'CL-002', serviceType: 'Tax' as any, status: 'Active' as any, category: 'A' as any, industry: 'Manufacturing' as any },
            { name: 'Upper Tamakoshi', code: 'CL-003', serviceType: 'Consulting' as any, status: 'Active' as any, category: 'B' as any, industry: 'Hydropower' as any }
        ];

        for (const c of demoClients) {
            await addDoc(collection(db, 'clients'), c);
        }
    },

    // --- CLIENTS ---
    getAllClients: async (): Promise<Client[]> => {
        const q = query(collection(db, 'clients'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<Client>(d));
    },

    addClient: async (client: Client) => {
        const ref = await addDoc(collection(db, 'clients'), client);
        return ref.id;
    },

    updateClient: async (client: Client) => {
        const { id, ...data } = client;
        await updateDoc(doc(db, 'clients', id), data);
    },

    deleteClient: async (id: string) => {
        // Soft delete: Mark as Inactive
        await updateDoc(doc(db, 'clients', id), { status: 'Inactive' });
    },

    // --- TASKS ---
    getAllTasks: async (): Promise<Task[]> => {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<Task>(d));
    },

    saveTask: async (task: Task) => {
        let taskId = task.id;
        if (task.id && !task.id.startsWith('t_')) {
            const { id, ...data } = task;
            await updateDoc(doc(db, 'tasks', id), data);
        } else {
            const { id, ...data } = task;
            const docRef = await addDoc(collection(db, 'tasks'), { ...data, createdAt: new Date().toISOString() });
            taskId = docRef.id;
        }

        // Notify assigned users
        if (task.assignedTo && task.assignedTo.length > 0) {
            for (const uid of task.assignedTo) {
                await AuthService.createNotification({
                    userId: uid,
                    title: 'New Task Assignment',
                    message: `You have been assigned to: ${task.title}`,
                    type: 'INFO',
                    category: 'TASK',
                    link: '/workflow'
                });
            }
        }
    },

    deleteTask: async (taskId: string) => {
        await deleteDoc(doc(db, 'tasks', taskId));
    },

    // --- ATTENDANCE ---
    getAttendanceHistory: async (userId?: string): Promise<AttendanceRecord[]> => {
        let q;
        if (userId) {
            q = query(collection(db, 'attendance'), where('userId', '==', userId));
        } else {
            q = query(collection(db, 'attendance'));
        }
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(d => docConverter<AttendanceRecord>(d));
        return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    recordAttendance: async (record: AttendanceRecord) => {
        // Check today's record for duplication
        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', record.userId),
            where('date', '==', record.date)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing
            const docId = snapshot.docs[0].id;
            const existing = snapshot.docs[0].data() as AttendanceRecord;

            if (!record.clockOut && existing.clockIn && !existing.clockOut && (!record.id || record.id === 'temp_id')) {
                throw new Error("Attendance already recorded for today.");
            }

            const { id, ...updateData } = record;
            await updateDoc(doc(db, 'attendance', docId), updateData);
        } else {
            // Create New
            const { id, ...data } = record;
            await addDoc(collection(db, 'attendance'), data);
        }
    },

    getLateCountLast30Days: async (userId: string): Promise<number> => {
        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            where('status', '==', 'LATE')
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    },

    // --- EVENTS ---
    getAllEvents: async (): Promise<CalendarEvent[]> => {
        const snapshot = await getDocs(collection(db, 'events'));
        return snapshot.docs.map(d => docConverter<CalendarEvent>(d));
    },

    saveEvent: async (event: CalendarEvent) => {
        const { id, ...data } = event;
        await addDoc(collection(db, 'events'), data);
    },

    // --- LEAVES ---
    getAllLeaves: async (userId?: string): Promise<LeaveRequest[]> => {
        let q;
        if (userId) {
            q = query(collection(db, 'leaves'), where('userId', '==', userId));
        } else {
            q = query(collection(db, 'leaves'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<LeaveRequest>(d));
    },

    requestLeave: async (leave: LeaveRequest) => {
        const { id, ...data } = leave;
        await addDoc(collection(db, 'leaves'), data);
    },

    updateLeaveStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const leaveDoc = doc(db, 'leaves', id);
        const leaveData = (await getDoc(leaveDoc)).data() as LeaveRequest;
        await updateDoc(leaveDoc, { status });

        // Notify user about leave status
        await AuthService.createNotification({
            userId: leaveData.userId,
            title: `Leave ${status}`,
            message: `Your leave request for ${leaveData.startDate} has been ${status.toLowerCase()}.`,
            type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
            category: 'LEAVE',
            link: '/leaves'
        });
    },

    // --- RESOURCES ---
    getAllResources: async (): Promise<Resource[]> => {
        const snapshot = await getDocs(collection(db, 'resources'));
        return snapshot.docs.map(d => docConverter<Resource>(d));
    },

    addResource: async (resource: Resource) => {
        const { id, ...data } = resource;
        await addDoc(collection(db, 'resources'), data);
    },

    deleteResource: async (id: string) => {
        await deleteDoc(doc(db, 'resources', id));
    },

    updateResource: async (resource: Resource) => {
        const { id, ...data } = resource;
        await updateDoc(doc(db, 'resources', id), data);
    },

    // --- NOTIFICATIONS ---
    createNotification: async (notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
        await addDoc(collection(db, 'notifications'), {
            ...notification,
            read: false,
            createdAt: new Date().toISOString()
        });
    },

    markAsRead: async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    },

    // Real-time listener
    subscribeToNotifications: (userId: string, callback: (notifications: AppNotification[]) => void) => {
        const q = query(
            collection(db, 'notifications'),
            where('userId', 'in', [userId, 'ALL']), // 'ALL' for global events
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q,
            (snapshot) => {
                const notifs = snapshot.docs.map(d => docConverter<AppNotification>(d));
                callback(notifs);
            },
            (error) => {
                console.error("Firestore Notification Listener Error:", error);
                if (error.code === 'failed-precondition') {
                    console.warn("Notification index is still building. Please wait...");
                }
            }
        );
    }
};

export const isDemoMode = false;