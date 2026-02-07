
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
    sendEmailVerification
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
    orderBy
} from 'firebase/firestore';
import { UserRole, UserProfile, Client, Task, AttendanceRecord, TaskStatus, TaskPriority, CalendarEvent, LeaveRequest, Resource } from '../types';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper to convert Firestore doc to Typed Object
const docConverter = <T>(doc: any): T => ({ id: doc.id, ...doc.data() });

export const AuthService = {
    // --- AUTHENTICATION ---

    login: async (email: string, pass: string): Promise<UserProfile> => {
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
                displayName: 'Staff Member',
                role: UserRole.STAFF, // Default role
                department: 'General',
                isSetupComplete: false,
                status: 'Active',
                phoneNumber: '',
                address: '',
                position: 'Staff',
                dateOfJoining: new Date().toISOString().split('T')[0],
                gender: 'Other'
            };
            await setDoc(doc(db, 'users', uid), newUser);
            return newUser;
        }
    },

    register: async (email: string, pass: string): Promise<UserProfile> => {
        // Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = userCredential.user.uid;

        // Create Initial Profile in Firestore
        const newUser: UserProfile = {
            uid,
            email,
            displayName: 'New Staff',
            role: UserRole.STAFF, // Default role
            department: 'General',
            isSetupComplete: false,
            status: 'Active',
            phoneNumber: '',
            address: '',
            position: 'Staff',
            dateOfJoining: new Date().toISOString().split('T')[0],
            gender: 'Other'
        };

        await setDoc(doc(db, 'users', uid), newUser);

        // Send Verification Email
        try {
            await sendEmailVerification(userCredential.user);
        } catch (e) {
            console.error("Failed to send verification email", e);
        }

        return newUser;
    },

    loginWithGoogle: async (): Promise<any> => {
        const provider = new GoogleAuthProvider();
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
                role: UserRole.STAFF, // Default
                department: 'General',
                isSetupComplete: false,
                status: 'Active',
                phoneNumber: '',
                address: '',
                position: 'Staff',
                dateOfJoining: new Date().toISOString().split('T')[0],
                gender: 'Other'
            };
            await setDoc(userDocRef, newUser);
            return newUser;
        }
    },

    logout: async () => {
        await signOut(auth);
    },

    sendVerification: async () => {
        if (auth.currentUser) {
            await sendEmailVerification(auth.currentUser);
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
        // In real Firebase, we can't create an Auth user without their password.
        // Option 1: Create a profile doc and let them "Claim" it on signup?
        // Option 2: Use a Secondary Auth App to create users (Complex)
        // For simplicity: We will just create a "Profile Document". 
        // When the user actually Signs Up with that email, we merge it? 
        // OR: We just assume this is a record keeping entry until they signup.

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
        await deleteDoc(doc(db, 'clients', id));
    },

    // --- TASKS ---
    getAllTasks: async (): Promise<Task[]> => {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<Task>(d));
    },

    saveTask: async (task: Task) => {
        if (task.id && !task.id.startsWith('t_')) { // Existing ID (Firestore ID)
            const { id, ...data } = task;
            await updateDoc(doc(db, 'tasks', id), data);
        } else {
            // New Task (ignore temp ID)
            const { id, ...data } = task; // drop temp ID
            await addDoc(collection(db, 'tasks'), { ...data, createdAt: new Date().toISOString() });
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
        // Sort in memory or add index
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

            // Logic similar to mock: preventing double check-in
            if (!record.clockOut && existing.clockIn && !existing.clockOut && (!record.id || record.id === 'temp_id')) {
                throw new Error("Attendance already recorded for today.");
            }

            await updateDoc(doc(db, 'attendance', docId), record);
        } else {
            // Create New
            const { id, ...data } = record; // drop temp ID
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
        await updateDoc(doc(db, 'leaves', id), { status });
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
    }
};

export const isDemoMode = false;
