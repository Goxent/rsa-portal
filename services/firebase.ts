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
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    confirmPasswordReset,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
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
    onSnapshot,
    enableIndexedDbPersistence,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    arrayUnion,
    writeBatch
} from 'firebase/firestore';
import { UserRole, UserProfile, Client, Task, AttendanceRecord, TaskStatus, TaskPriority, CalendarEvent, LeaveRequest, Resource, AppNotification, RiskAreaDocument, AttendanceLogRequest, AuditPhase, WorkLog } from '../types';
import { getNepaliFiscalYear } from '../utils/nepaliDate';
import { getCurrentDateUTC } from '../utils/dates';
import { EmailService } from './email';
import { toast } from 'react-hot-toast';
import { logClientAction, logUserAction, logTaskAction, logLeaveAction, AuditAction, AuditLog, createAuditLog } from './auditLog';
import { fetchClientIPInfo, getActiveSessions, getStaleSessions, SessionMetadata } from './sessionService';

// Load Config from Environment Variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
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
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    console.error('Firebase initialization failed:', error);
    toast.error('System failed to initialize. Please check your network or configuration.');
}

export const auth = getAuth(app!);

// Use local persistence so the session survives new tabs; inactivity timeout is handled in AuthContext
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Initialize Firestore with Persistent Cache (New API)

// Prevent re-initialization error during Vite HMR
let dbInstance;
try {
    // Check if firestore is already initialized for this app
    dbInstance = getFirestore(app!);
} catch (e) {
    // If not, initialize with custom settings
    dbInstance = initializeFirestore(app!, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
}

export const db = dbInstance;

import { getStorage } from 'firebase/storage';
export const storage = getStorage(app!);

// Action Code Settings for Email Verification
const getActionCodeSettings = (): ActionCodeSettings => {
    // Get the current URL or use a default
    const url = window.location.origin;
    return {
        url: `${url}/#/verify-email`,
        handleCodeInApp: true,
    };
};

// Helper to convert Firestore doc to Typed Object - Ensure doc.id is prioritized and not overwritten by data.id
const docConverter = <T>(doc: any): T => {
    const data = doc.data();
    return { ...data, id: doc.id } as T;
};

// Helper to classify device for session control
const getDeviceType = (): 'MOBILE' | 'DESKTOP' => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'MOBILE';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
        return 'MOBILE';
    }
    return 'DESKTOP';
};

// Helper for persistent device identification (cleared only on browser data wipe)
const getDeviceId = (): string => {
    let id = localStorage.getItem('rsa_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('rsa_device_id', id);
    }
    return id;
};

// Helper to get a friendly device name from user-agent
const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
    else if (/wv/.test(ua) || /App/.test(ua)) browser = 'App/Webview';
    else if (/Chrome\//.test(ua) && !/Chromium\/|Edg\/|OPR\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

    // Detect OS & handle desktop mode spoofing on mobile devices
    const isTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
    
    if (/Android/.test(ua)) {
        os = 'Android';
    } else if (/iPhone|iPad|iPod/.test(ua) || (isTouch && /Macintosh/.test(ua))) {
        os = 'iOS';
    } else if (/Windows/.test(ua)) {
        // If it claims Windows but has touch and narrow screen, it's likely a mobile phone requesting desktop site
        if (isTouch && window.innerWidth < 800) {
            os = 'Mobile (Desktop Mode)';
        } else {
            os = 'Windows';
        }
    } else if (/Macintosh|Mac OS/.test(ua)) {
        os = 'Mac';
    } else if (/Linux/.test(ua)) {
        os = 'Linux';
    }

    // Attempt to grab device model (for Androids)
    let model = '';
    const match = ua.match(/\(Linux; U; Android.+; (.+?) Build/i) || ua.match(/\(Linux; Android.+; (.+?) Build/i);
    if (match && match[1]) {
        model = match[1].split(';')[0].trim();
    }

    // Enhanced identification: Add browser detail to distinguish multiple sessions on same OS
    return model ? `${model} (${browser})` : `${browser} on ${os}`;
};

// Custom error class for session limit — now includes full session metadata
export class SessionLimitError extends Error {
    sessions: Array<SessionMetadata>;
    uid: string;
    constructor(sessions: SessionMetadata[], uid: string) {
        super('SESSION_LIMIT_REACHED');
        this.name = 'SessionLimitError';
        this.sessions = sessions;
        this.uid = uid;
    }
}

// Helper to set up a new session on login
const setupUserSession = async (uid: string, email: string, method: string, forceSessionId?: string) => {
    const sessionId = crypto.randomUUID();
    const sessionCreatedAt = Date.now();
    const deviceType = getDeviceType();
    const deviceName = getDeviceName();
    const deviceId = getDeviceId();

    // Fetch IP + geolocation (non-blocking, best-effort)
    const ipInfo = await fetchClientIPInfo();

    // Read existing sessions from Firestore
    const userSnap = await getDoc(doc(db, 'users', uid));
    const existingSessions: Record<string, SessionMetadata> = userSnap.exists()
        ? (userSnap.data().activeSessions || {})
        : {};

    // --- Stale session pruning ---
    // Sessions whose tab was closed (no heartbeat for >5 min) are removed automatically.
    // This is the key mechanism that prevents old closed tabs from blocking new logins.
    const stale = getStaleSessions(existingSessions);
    const activeSessions = getActiveSessions(existingSessions);

    // Build the updated sessions map, starting by removing all stale ones
    const updatedSessions: Record<string, SessionMetadata> = {};
    for (const s of activeSessions) {
        updatedSessions[s.sessionId] = s;
    }

    // If there are already ≥2 ACTIVE sessions and the user hasn't chosen to remove one, block.
    if (activeSessions.length >= 2 && !forceSessionId) {
        throw new SessionLimitError(activeSessions, uid);
    }

    // If user chose to kick a specific session, remove it
    if (forceSessionId) {
        delete updatedSessions[forceSessionId];
    }

    // Register the new session
    const newSession: SessionMetadata = {
        sessionId,
        deviceId,
        deviceName,
        deviceType,
        ip: ipInfo.ip,
        city: ipInfo.city,
        region: ipInfo.region,
        country: ipInfo.country,
        loggedInAt: sessionCreatedAt,
        lastActive: sessionCreatedAt,
    };
    updatedSessions[sessionId] = newSession;

    // Persist locally so heartbeat and logout can reference it
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('deviceType', deviceType);

    // Write to Firestore
    await updateDoc(doc(db, 'users', uid), {
        currentSessionId: sessionId,
        sessionCreatedAt,
        activeSessions: updatedSessions,
    });

    // Audit log
    await createAuditLog({
        userId: uid,
        userName: email,
        action: AuditAction.LOGIN_SUCCESS,
        targetType: 'system',
        targetId: uid,
        targetName: 'Auth',
        details: { method, newSessionId: sessionId, deviceType, deviceName, ip: ipInfo.ip, city: ipInfo.city, country: ipInfo.country }
    });

    return { currentSessionId: sessionId, sessionCreatedAt };
};

export const AuthService = {
    // --- SESSION MANAGEMENT ---
    removeSession: async (uid: string, sessionId: string): Promise<void> => {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (!userSnap.exists()) return;
        const existing: Record<string, any> = userSnap.data().activeSessions || {};
        const updated: Record<string, any> = {};
        for (const key of Object.keys(existing)) {
            if (existing[key]?.sessionId !== sessionId) {
                updated[key] = existing[key];
            }
        }
        await updateDoc(doc(db, 'users', uid), { activeSessions: updated });
    },

    // --- AUTHENTICATION ---
    isAdmin: (role?: UserRole): boolean => {
        if (!role) return false;
        return role === UserRole.ADMIN || role === UserRole.MASTER_ADMIN;
    },

    login: async (email: string, pass: string, forceSessionId?: string): Promise<UserProfile> => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const uid = userCredential.user.uid;

            // Fetch Profile from Firestore
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                const sessionData = await setupUserSession(uid, email, 'Email/Password', forceSessionId);
                return { uid, ...userDoc.data(), ...sessionData } as UserProfile;
            } else {
                // Orphaned Auth Account recovery
                // If the user's Auth account survived a deletion but an admin re-added them to the directory
                const normalizedEmail = email.toLowerCase().trim();
                const usersSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
                
                if (!usersSnapshot.empty) {
                    const existingDoc = usersSnapshot.docs[0];
                    const existingData = existingDoc.data() as UserProfile;
                    
                    const newUser = {
                        ...existingData,
                        uid,
                        isSetupComplete: false,
                        status: 'Active' as any,
                    };
                    
                    await setDoc(doc(db, 'users', uid), newUser);
                    await AuthService.migrateUserTasks(existingDoc.id, uid);
                    await deleteDoc(doc(db, 'users', existingDoc.id));
                    
                    return newUser;
                } else {
                    throw new Error("No staff profile found for this account. Please contact your administrator.");
                }
            }
        } catch (error: any) {
            // IMPORTANT: Re-throw SessionLimitError as-is so LoginPage can show device chooser
            if (error instanceof SessionLimitError || error.name === 'SessionLimitError') {
                throw error;
            }
            // Log failure
            await createAuditLog({
                userId: 'anonymous',
                userName: email,
                action: AuditAction.LOGIN_FAILURE,
                targetType: 'system',
                targetId: 'auth',
                targetName: 'Login Attempt',
                details: { error: error.message, email }
            });
            // Provide user-friendly error messages
            if (error.code === 'auth/user-not-found') {
                throw new Error('No account found with this email. Please sign up first.');
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                throw new Error('Invalid email or password. Please try again.');
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
        let userCredential;
        try {
            const normalizedInputEmail = email.toLowerCase().trim();

            // STEP 1: Create Auth User FIRST (to bypass unauthenticated Firestore rules)
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                console.log(`[Auth] Firebase account created for ${normalizedInputEmail}`);
            } catch (authErr: any) {
                if (authErr.code === 'auth/email-already-in-use') {
                    // Seamless auto-recovery for orphaned testing accounts
                    try {
                        userCredential = await signInWithEmailAndPassword(auth, email, pass);
                        console.log(`[Auth] Intercepted orphaned account for ${normalizedInputEmail}. Merging profile.`);
                    } catch (loginErr: any) {
                        if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/invalid-credential') {
                            throw new Error('This institutional email is already registered. If you forgot your password, please use the Password Reset option on the Login page.');
                        }
                        throw authErr; 
                    }
                } else {
                    throw authErr;
                }
            }
            const uid = userCredential.user.uid;

            // STEP 3: Validate email is in users directory (Staff Directory)
            // Fix: Use direct lookup with deterministic "invited_" prefix to bypass "List" permission errors
            const invitedDocRef = doc(db, 'users', 'invited_' + normalizedInputEmail);
            const invitedDocSnap = await getDoc(invitedDocRef);

            let existingUserData: UserProfile | null = null;
            let existingDocId: string | null = null;

            if (invitedDocSnap.exists()) {
                existingUserData = invitedDocSnap.data() as UserProfile;
                existingDocId = invitedDocSnap.id;
            } else {
                // Fallback for transition period or different ID schemes
                try {
                    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedInputEmail)));
                    if (!usersSnapshot.empty) {
                        existingUserData = usersSnapshot.docs[0].data() as UserProfile;
                        existingDocId = usersSnapshot.docs[0].id;
                    }
                } catch (fallbackError) {
                    console.log(`[Auth] Note: Could not scan legacy users collection for ${normalizedInputEmail} due to security rules.`);
                }
            }

            let newUser: UserProfile;

            try {
                if (existingUserData && existingDocId) {
                    console.log(`[Auth] Found matching invite profile: ${existingDocId}`);

                    // Check if already registered
                    if (existingUserData.uid && !existingUserData.uid.startsWith('pending_') && !existingUserData.uid.startsWith('invited_')) {
                        // If it's the same UID we just logged into, it's fine (retry case)
                        if (existingUserData.uid !== uid) {
                            await userCredential.user.delete();
                            throw new Error('This invitation has already been claimed and set up. Please log in with your existing credentials.');
                        }
                    }

                    if (existingUserData.status === 'Inactive') {
                        await userCredential.user.delete();
                        throw new Error('This staff account has been deactivated. Please contact your system administrator.');
                    }

                    // MERGE: Use existing data, update UID and Status
                    newUser = {
                        ...existingUserData,
                        uid,
                        displayName: existingUserData.displayName || email.split('@')[0],
                        email: normalizedInputEmail, // Ensure normalized email
                        isSetupComplete: false,
                        isOnboardingComplete: false, // Force them through the new onboarding flow
                        status: 'Active',
                        registeredAt: new Date().toISOString()
                    };

                    // Create/Update the doc with the real UID
                    await setDoc(doc(db, 'users', uid), newUser);

                    // Set up session
                    const sessionData = await setupUserSession(uid, email, 'Institutional Registration');
                    newUser = { ...newUser, ...sessionData };

                    // Migrate Tasks from Old ID (pending_... or invited_...) to New UID
                    await AuthService.migrateUserTasks(existingDocId, uid);

                    // Delete the old placeholder doc
                    if (existingDocId !== uid) {
                        await deleteDoc(doc(db, 'users', existingDocId));
                    }
                } else {
                    console.error(`[Auth] Critial Error: ${normalizedInputEmail} in allowlist but no user record found.`);
                    throw new Error("Invitation record mismatch. Please request a new invitation from your administrator.");
                }

                // Send Verification Email
                try {
                    const actionCodeSettings = getActionCodeSettings();
                    await sendEmailVerification(userCredential.user, actionCodeSettings);
                } catch (emailError) {
                    console.error("Failed to send verification email:", emailError);
                }

                return newUser;

            } catch (firestoreError: any) {
                // If the error was thrown by our own validations (e.g. Account already set up)
                if (firestoreError.message && (firestoreError.message.includes('Account already set up') || firestoreError.message.includes('Inactive'))) {
                    throw firestoreError;
                }

                // ROLLBACK FOR DB ISSUES
                console.error("Firestore profile creation failed. Rolling back Auth User.", firestoreError);
                try {
                    await deleteDoc(doc(db, 'users', uid));
                } catch (e) {
                    console.error("Failed to clean up isolated profile", e);
                }
                await userCredential.user.delete();
                throw new Error("Registration failed due to system error. Please try again.");
            }
        } catch (error: any) {
            // Provide user-friendly error messages
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('An account with this email already exists. Please login instead.');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email address format.');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password should be at least 6 characters long.');
            } else {
                // Check if we need to clean up an orphaned auth account due to some unexpected error
                if (userCredential && userCredential.user) {
                    try {
                        await userCredential.user.delete();
                    } catch (e) {
                        console.error("Failed to clean up user after error", e);
                    }
                }
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
    
    verifyResetCode: async (code: string) => {
        try {
            return await verifyPasswordResetCode(auth, code);
        } catch (error: any) {
            console.error("Reset Code Verification Error:", error);
            throw new Error('Invalid or expired reset link. Please request a new one.');
        }
    },

    confirmResetPassword: async (code: string, newPass: string) => {
        try {
            await confirmPasswordReset(auth, code, newPass);
        } catch (error: any) {
            console.error("Password Confirm Error:", error);
            throw new Error('Failed to reset password. Please try again.');
        }
    },

    loginWithGoogle: async (): Promise<UserProfile> => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            const email = user.email || '';

            // 1. Check if Profile exists for this UID (Already Registered)
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.status === 'Inactive') {
                    await signOut(auth);
                    throw new Error('Your account is Inactive. Please contact support.');
                }
                const sessionData = await setupUserSession(user.uid, email, 'Google OAuth');
                return { uid: user.uid, ...userData, ...sessionData } as UserProfile;
            }

            // 2. Not Registered yet? Check Staff Directory by Email
            const usersSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email)));

            if (!usersSnapshot.empty) {
                // FOUND IN DIRECTORY -> MERGE ACCOUNT
                const existingUserDoc = usersSnapshot.docs[0];
                const existingUserData = existingUserDoc.data() as UserProfile;

                if (existingUserData.status === 'Inactive') {
                    await user.delete();
                    throw new Error('This account is marked as Inactive. Please contact the administrator.');
                }

                // Merge
                const newUser: UserProfile = {
                    ...existingUserData,
                    uid: user.uid,
                    displayName: existingUserData.displayName || user.displayName || 'Staff',
                    photoURL: user.photoURL || undefined,
                    isSetupComplete: false,
                    status: 'Active',
                };

                // Save to new UID doc
                await setDoc(userDocRef, newUser);

                const sessionData = await setupUserSession(user.uid, email, 'Google OAuth (Registration)');
                
                // Migrate Tasks
                await AuthService.migrateUserTasks(existingUserDoc.id, user.uid);

                // Delete old placeholder
                await deleteDoc(doc(db, 'users', existingUserDoc.id));

                return { ...newUser, ...sessionData };
            } else {
                // 3. NOT IN DIRECTORY -> ACCESS DENIED
                await user.delete(); // Remove the auth user we just created
                throw new Error('Access Denied: Your email is not listed in the Staff Directory. Please contact the administrator to be added.');
            }

        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in cancelled.');
            } else {
                console.error('Google sign-in error:', error);
                throw new Error(error.message || 'Google sign-in failed.');
            }
        }
    },

    logout: async (reason: 'MANUAL' | 'SESSION_EXPIRED' | 'SESSION_TERMINATED' = 'MANUAL') => {
        if (auth.currentUser) {
            const uid = auth.currentUser.uid;
            const sessionId = localStorage.getItem('sessionId');
            
            // Remove the specific session from the activeSessions map by its sessionId key
            if (sessionId) {
                try {
                    const userSnap = await getDoc(doc(db, 'users', uid));
                    if (userSnap.exists()) {
                        const existing = userSnap.data().activeSessions || {};
                        const updated: Record<string, any> = {};
                        for (const [key, val] of Object.entries(existing)) {
                            if (val && (val as any).sessionId !== sessionId) {
                                updated[key] = val;
                            }
                        }
                        await updateDoc(doc(db, 'users', uid), {
                            activeSessions: updated,
                            currentSessionId: null,
                            sessionCreatedAt: null,
                        });
                    }
                } catch (e) {
                    console.error('Failed to clear session from DB during logout', e);
                }
            }

            await createAuditLog({
                userId: uid,
                userName: auth.currentUser.email || 'User',
                action: reason === 'MANUAL' ? AuditAction.LOGOUT :
                        AuditAction.SESSION_EXPIRED,
                targetType: 'system',
                targetId: uid,
                targetName: 'Auth',
                details: { reason, sessionId }
            });
        }
        localStorage.removeItem('sessionId');
        localStorage.removeItem('deviceType');
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
        if (auth.currentUser) {
            const adminDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'System';
            await logUserAction(
                AuditAction.USER_UPDATED,
                auth.currentUser.uid,
                adminName,
                uid,
                data.displayName || 'Unknown',
                { updates: data }
            );
        }
    },

    updateTheme: async (uid: string, theme: 'light' | 'dark') => {
        await updateDoc(doc(db, 'users', uid), { theme });
    },

    // Admin creating a placeholder user (profile only)
    createStaffUser: async (staffData: Partial<UserProfile>) => {
        // Prevent duplicate staff records for the same email
        if (staffData.email) {
            const normalizedEmail = staffData.email.toLowerCase().trim();
            const existingUsers = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
            if (!existingUsers.empty) {
                throw new Error(`A system user with the email ${normalizedEmail} already exists.`);
            }
        }

        // We'll create a profile with a deterministic ID for direct lookup during signup
        const inviteId = 'invited_' + staffData.email.toLowerCase().trim();
        await setDoc(doc(db, 'users', inviteId), {
            ...staffData,
            uid: inviteId,
            status: 'Pending Signup',
            isSetupComplete: false,
            isOnboardingComplete: false,
            registeredAt: new Date().toISOString(),
            registeredBy: auth.currentUser?.uid || 'admin',
            pendingWorkLogs: []
        });

        if (staffData.email) {
            const normalizedEmail = staffData.email.toLowerCase().trim();
            await setDoc(doc(db, 'staffAllowlist', normalizedEmail), {
                email: normalizedEmail,
                addedBy: auth.currentUser?.uid || 'admin',
                addedAt: new Date().toISOString(),
                displayName: staffData.displayName || '',
                role: staffData.role || UserRole.STAFF,
                department: staffData.department || 'General',
            });

            // Send Invitation Email
            try {
                const adminDoc = await getDoc(doc(db, 'users', auth.currentUser?.uid || ''));
                const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'Admin';
                
                const emailSent = await EmailService.sendStaffInvitation(
                    normalizedEmail,
                    staffData.displayName || 'Team Member',
                    adminName
                );

                if (!emailSent) {
                    throw new Error("The invitation email could not be delivered. Please check the recipient email and try again.");
                }
            } catch (emailError: any) {
                console.error("Failed to send invitation email:", emailError);
                // We re-throw this error so the UI (StaffPage.tsx) can show the error toast
                throw new Error(emailError.message || "Failed to send invitation email.");
            }

            if (auth.currentUser) {
                const adminDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'Admin';
                await logUserAction(
                    AuditAction.USER_CREATED,
                    auth.currentUser.uid,
                    adminName,
                    inviteId,
                    staffData.displayName || staffData.email,
                    { staffData }
                );
            }
        }
    },

    deleteStaffUser: async (uid: string, email: string) => {
        if (uid) {
            await deleteDoc(doc(db, 'users', uid));
        }
        if (email) {
            await deleteDoc(doc(db, 'staffAllowlist', email.toLowerCase().trim()));
        }
        if (auth.currentUser) {
            const adminDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'Admin';
            await logUserAction(
                AuditAction.USER_DELETED,
                auth.currentUser.uid,
                adminName,
                uid,
                email,
                { email }
            );
        }
    },

    /**
     * Checks if an email is in the staff allowlist and whether they have registered.
     */
    checkInvitationStatus: async (email: string): Promise<{ isInvited: boolean; isRegistered: boolean }> => {
        const normalizedEmail = email.toLowerCase().trim();
        
        // 1. Check staffAllowlist
        const allowlistRef = doc(db, 'staffAllowlist', normalizedEmail);
        const allowlistSnap = await getDoc(allowlistRef);
        
        if (!allowlistSnap.exists()) {
            return { isInvited: false, isRegistered: false };
        }
        
        // 2. Check if user is registered (non-pending doc in users)
        const q = query(
            collection(db, 'users'),
            where('email', '==', normalizedEmail)
        );
        const usersSnap = await getDocs(q);
        
        const isRegistered = usersSnap.docs.some(d => {
            const data = d.data();
            return data.uid && !data.uid.startsWith('pending_');
        });
        
        return { 
            isInvited: true, 
            isRegistered 
        };
    },

    migrateExistingStaffToAllowlist: async () => {
        const usersSnap = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);

        usersSnap.forEach(userDoc => {
            const userData = userDoc.data() as UserProfile;
            if (userData.email && userData.status !== 'Inactive') {
                const allowlistRef = doc(db, 'staffAllowlist', userData.email.toLowerCase().trim());
                batch.set(allowlistRef, {
                    email: userData.email.toLowerCase().trim(),
                    addedBy: 'migration',
                    addedAt: new Date().toISOString(),
                    displayName: userData.displayName || '',
                    role: userData.role || UserRole.STAFF,
                    department: userData.department || 'General',
                }, { merge: true }); // merge: true avoids overwriting manual entries
            }
        });

        await batch.commit();
    },

    // Fetch All Users (Staff Directory)
    getAllUsers: async (): Promise<UserProfile[]> => {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => docConverter<UserProfile>(d))
            .filter(u => u.role !== UserRole.MASTER_ADMIN)
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    },

    getAllStaff: async (): Promise<UserProfile[]> => {
        const q = query(collection(db, 'users'), where('role', '!=', UserRole.ADMIN));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => docConverter<UserProfile>(d))
            .filter(u => u.role !== UserRole.MASTER_ADMIN && u.role !== UserRole.ADMIN)
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    },

    updateClientPermissions: async (clientId: string, staffIds: string[]) => {
        await updateDoc(doc(db, 'clients', clientId), { permittedStaff: staffIds });
        if (auth.currentUser) {
            const adminDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'Admin';
            await logClientAction(
                AuditAction.CLIENT_UPDATED,
                auth.currentUser.uid,
                adminName,
                clientId,
                'Client Permissions',
                { permittedStaff: staffIds }
            );
        }
    },

    updateUserRole: async (uid: string, role: UserRole) => {
        await updateDoc(doc(db, 'users', uid), { role });
        if (auth.currentUser) {
            const adminDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const adminName = adminDoc.exists() ? adminDoc.data().displayName : 'Admin';
            await logUserAction(
                AuditAction.USER_ROLE_CHANGED,
                auth.currentUser.uid,
                adminName,
                uid,
                'User',
                { newRole: role }
            );
        }
    },

    // Grant/revoke task-creation permission (Master Admin only)
    grantTaskCreation: async (uid: string) => {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { taskCreationAuthorized: true });
    },

    revokeTaskCreation: async (uid: string) => {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { taskCreationAuthorized: false });
    },

    grantComplianceCreation: async (uid: string) => {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { complianceCreationAuthorized: true });
    },

    revokeComplianceCreation: async (uid: string) => {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { complianceCreationAuthorized: false });
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

    seedClients: async (clientNames: string[]) => {
        let addedCount = 0;
        let skippedCount = 0;

        // Get all existing clients first to minimize reads in loop
        const existingSNAPSHOT = await getDocs(collection(db, 'clients'));
        const existingClients = existingSNAPSHOT.docs.map(d => d.data() as Client);
        const existingNames = new Set(existingClients.map(c => c.name.toLowerCase()));

        // Calculate next code number
        const existingCodes = existingClients.map(c => c.code).filter(c => c && c.startsWith('C-'));
        const numbers = existingCodes.map(c => parseInt(c.replace(/\D/g, ''))).filter(n => !isNaN(n));
        let nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

        for (const name of clientNames) {
            if (existingNames.has(name.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const code = `C-${String(nextNum).padStart(3, '0')}`;
            nextNum++;

            const newClient: Partial<Client> = {
                name: name.trim(),
                code: code,
                serviceType: 'Statutory Audit', // Default
                status: 'Active',
                industry: 'Others',
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'clients'), newClient);
            addedCount++;
        }

        return { added: addedCount, skipped: skippedCount };
    },

    // --- CLIENTS ---
    getAllClients: async (): Promise<Client[]> => {
        const q = query(collection(db, 'clients'));
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(d => docConverter<Client>(d));
        return clients.sort((a, b) => a.name.localeCompare(b.name));
    },

    addClient: async (client: Client) => {
        const { id, ...data } = client;
        const ref = await addDoc(collection(db, 'clients'), {
            ...data,
            createdAt: new Date().toISOString()
        });
        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logClientAction(
                AuditAction.CLIENT_CREATED,
                auth.currentUser.uid,
                userName,
                ref.id,
                data.name,
                { clientData: data }
            );
        }
        return ref.id;
    },

    updateClient: async (client: Client) => {
        const { id, ...data } = client;
        await updateDoc(doc(db, 'clients', id), data);
        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logClientAction(
                AuditAction.CLIENT_UPDATED,
                auth.currentUser.uid,
                userName,
                id,
                data.name,
                { updates: data }
            );
        }
    },

    deleteClient: async (id: string) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");

        // Permission Check
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role !== UserRole.ADMIN && role !== UserRole.MASTER_ADMIN) {
                throw new Error("Unauthorized: Only Admins can delete clients.");
            }
        }

        // Soft delete: Mark as Inactive
        await updateDoc(doc(db, 'clients', id), { status: 'Inactive' });
        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'Admin';
            await logClientAction(
                AuditAction.CLIENT_DELETED,
                auth.currentUser.uid,
                userName,
                id,
                'Client',
                { status: 'Inactive' }
            );
        }
    },

    // --- TASKS ---

    /**
     * Clock In Logic
     */
    clockIn: async (userId: string, method: 'WEB' | 'MOBILE' = 'WEB', location?: string, notes?: string, workLogs?: WorkLog[], clientIds?: string[]) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        const dateStr = now.toLocaleDateString('en-CA');

        // Fetch User Profile for display name
        let userName = 'User';
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                userName = userDoc.data().displayName || 'User';
            }
        } catch (e) {
            console.warn("Failed to fetch user name for attendance", e);
        }

        const newRecord: AttendanceRecord = {
            id: '', // Generated by Firebase
            userId,
            userName,
            date: dateStr,
            clockIn: timeStr,
            status: 'PRESENT',
            notes: notes || '',
            workHours: 0,
            workLogs: workLogs || [],
            clientIds: clientIds || []
        };
        
        return AuthService.recordAttendance(newRecord);
    },

    /**
     * Clock Out Logic
     */
    clockOut: async (userId: string, recordId: string, notes?: string, workLogs?: WorkLog[]) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

        // We need to fetch the existing record to calculate duration?
        // For now, simpler: Update with clockOut time.
        // The duration calculation happens in the component or backend function. 
        // But for client-side simplicity:

        const recordRef = doc(db, 'attendance', recordId);
        const recordSnap = await getDoc(recordRef);

        if (recordSnap.exists()) {
            const data = recordSnap.data() as AttendanceRecord;
            const [h, m, s] = data.clockIn.split(':').map(Number);
            const start = new Date();
            start.setHours(h, m, s || 0, 0);
            const diff = (now.getTime() - start.getTime()) / 1000 / 3600;
            const workHours = Number(diff.toFixed(2));

            await updateDoc(recordRef, {
                clockOut: timeStr,
                workHours,
                status: 'COMPLETED',
                notes: notes || data.notes,
                workLogs: workLogs || data.workLogs
            });
        }
    },

    updateAttendance: async (recordId: string, data: Partial<AttendanceRecord>) => {
        await updateDoc(doc(db, 'attendance', recordId), data);
    },

    getAllTasks: async (): Promise<Task[]> => {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => docConverter<Task>(d));
    },

    getPaginatedTasks: async (lastDoc?: QueryDocumentSnapshot | null, pageSize: number = 20): Promise<{ tasks: Task[], lastVisible: QueryDocumentSnapshot | null }> => {
        let q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(pageSize));

        if (lastDoc) {
            q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map(d => docConverter<Task>(d));
        const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

        return { tasks, lastVisible };
    },

    saveTask: async (task: Task, isNew: boolean) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");

        let taskId = task.id;
        if (!isNew) {
            const { id, ...data } = task;
            await updateDoc(doc(db, 'tasks', id!), data);
        } else {
            const { id, ...data } = task;
            const docRef = await addDoc(collection(db, 'tasks'), {
                ...data,
                createdAt: new Date().toISOString()
            });
            taskId = docRef.id;
            isNew = true;
        }

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logTaskAction(
                isNew ? AuditAction.TASK_CREATED : AuditAction.TASK_UPDATED,
                auth.currentUser.uid,
                userName,
                taskId!,
                task.title,
                { taskData: task, isNew }
            );
        }

        // Notify assigned users (Only on creation for now to avoid spam)
        if (isNew && task.assignedTo && task.assignedTo.length > 0) {
            // New Task: Notify all assignees
            for (const uid of task.assignedTo) {
                await AuthService.sendTaskNotification(uid, task, isNew);
            }
        } else if (!isNew && task.assignedTo && task.assignedTo.length > 0) {
            // Existing Task: Notify ONLY NEW assignees
            try {
                const oldTaskDoc = await getDoc(doc(db, 'tasks', taskId));
                const oldTask = oldTaskDoc.exists() ? (oldTaskDoc.data() as Task) : null;
                const oldAssignedTo = oldTask?.assignedTo || [];

                // Find users who are in the new list but NOT in the old list
                const newAssignees = task.assignedTo.filter(uid => !oldAssignedTo.includes(uid));

                if (newAssignees.length > 0) {
                    console.log(`Sending notifications to ${newAssignees.length} new assignees`);
                    for (const uid of newAssignees) {
                        await AuthService.sendTaskNotification(uid, task, true); // Treat as "New Assignment" for them
                    }
                }
            } catch (error) {
                console.error("Error checking for new assignees:", error);
            }
        }
    },

    // Helper to handle assignee changes and notifications
    handleAssigneeNotifications: async (taskId: string, currentTask: Partial<Task>, isNew: boolean) => {
        if (!currentTask.assignedTo || currentTask.assignedTo.length === 0) return;

        if (isNew) {
            // New Task: Notify all assignees
            for (const uid of currentTask.assignedTo) {
                await AuthService.sendTaskNotification(uid, currentTask as Task, true);
            }
        } else {
            // Existing Task: Notify ONLY NEW assignees
            try {
                const oldTaskDoc = await getDoc(doc(db, 'tasks', taskId));
                if (!oldTaskDoc.exists()) return;
                
                const oldTask = oldTaskDoc.data() as Task;
                const oldAssignedTo = oldTask.assignedTo || [];
                // Compare with current updates
                const newAssignees = currentTask.assignedTo.filter(uid => !oldAssignedTo.includes(uid));

                if (newAssignees.length > 0) {
                    for (const uid of newAssignees) {
                        const taskToNotify = { ...oldTask, ...currentTask } as Task;
                        await AuthService.sendTaskNotification(uid, taskToNotify, true);
                    }
                }
            } catch (error) {
                console.error("Error checking for new assignees:", error);
            }
        }
    },

    // Helper to send notifications (Internal & Email)
    sendTaskNotification: async (uid: string, task: Task, isNewRel: boolean) => {
        // In-App Notification
        await AuthService.createNotification({
            userId: uid,
            title: 'New Task Assignment',
            message: `You have been assigned to: ${task.title}`,
            type: 'INFO',
            category: 'TASK',
            link: '/tasks'
        });

        // Email Notification
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.email) {
                    const emailSent = await EmailService.sendTaskAssignment(
                        userData.email,
                        userData.displayName || 'Staff Member',
                        task.title,
                        `${window.location.origin}/#/tasks`,
                        task.clientName || 'Internal',
                        task.dueDate,
                        task.priority,
                        task.description
                    );

                    if (!emailSent) {
                        toast.error(`Task saved, but email to ${userData.displayName || 'User'} failed.`);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to send email notif", err);
        }
    },

    // Migrates tasks from a temporary/pending UID to a real UID
    migrateUserTasks: async (oldUid: string, newUid: string) => {
        console.log(`Migrating tasks from ${oldUid} to ${newUid}...`);
        try {
            // 1. Find all tasks where oldUid is assigned
            const q = query(collection(db, 'tasks'), where('assignedTo', 'array-contains', oldUid));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                console.log("No tasks found to migrate.");
                return;
            }

            console.log(`Found ${snapshot.size} tasks to migrate.`);

            const batch = import('firebase/firestore').then(async ({ writeBatch }) => {
                const firebaseBatch = writeBatch(db);

                snapshot.docs.forEach(docSnap => {
                    const task = docSnap.data() as Task;
                    const newAssignedTo = task.assignedTo.map(uid => uid === oldUid ? newUid : uid);

                    // Remove duplicates just in case
                    const uniqueAssignedTo = [...new Set(newAssignedTo)];

                    firebaseBatch.update(docSnap.ref, { assignedTo: uniqueAssignedTo });
                });

                await firebaseBatch.commit();
                console.log("Task migration completed successfully.");
            });

            await batch;

        } catch (error) {
            console.error("Error migrating user tasks:", error);
            throw error; // Rethrow to trigger rollback in register
        }
    },

    // --- WIDGET PERSISTENCE ---
    saveWidgetConfig: async (userId: string, config: any[]) => {
        try {
            await setDoc(doc(db, 'users', userId, 'settings', 'dashboard'), {
                widgets: config,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Failed to save widget config:", error);
            // Don't throw, just log. It's a preference, not critical data.
        }
    },

    getWidgetConfig: async (userId: string): Promise<any[] | null> => {
        try {
            const docSnap = await getDoc(doc(db, 'users', userId, 'settings', 'dashboard'));
            if (docSnap.exists()) {
                return docSnap.data().widgets;
            }
            return null;
        } catch (error: any) {
            if (error.code !== 'permission-denied') {
                console.warn("Failed to fetch widget config:", error);
            }
            return null;
        }
    },

    deleteTask: async (taskId: string) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");

        // Permission Check
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role !== UserRole.ADMIN && role !== UserRole.MASTER_ADMIN) {
                throw new Error("Unauthorized: Only Admins can delete tasks.");
            }
        }

        await deleteDoc(doc(db, 'tasks', taskId));
        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'Admin';
            await logTaskAction(
                AuditAction.TASK_DELETED,
                auth.currentUser.uid,
                userName,
                taskId,
                'Task',
                {}
            );
        }
    },

    updateTask: async (taskId: string, updates: Partial<Task>) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");

        // Handle Status Change Workflow
        if (updates.status) {
            try {
                const oldTaskDoc = await getDoc(doc(db, 'tasks', taskId));
                const oldTask = oldTaskDoc.exists() ? (oldTaskDoc.data() as Task) : null;

                if (oldTask && oldTask.status !== updates.status) {
                    await AuthService.handleStatusChange(oldTask, updates.status);
                }
            } catch (err) {
                console.error("Workflow trigger failed:", err);
            }
        }

        // Deep sanitize: remove all undefined values recursively to avoid Firestore crash
        const sanitizeDeep = (obj: any): any => {
            if (obj === undefined) return undefined;
            if (obj === null) return null;
            if (Array.isArray(obj)) {
                return obj.map(v => sanitizeDeep(v)).filter(v => v !== undefined);
            }
            if (typeof obj === 'object') {
                const result: any = {};
                for (const [k, v] of Object.entries(obj)) {
                    const cleanVal = sanitizeDeep(v);
                    if (cleanVal !== undefined) {
                        result[k] = cleanVal;
                    }
                }
                return result;
            }
            return obj;
        };

        const sanitizedUpdates = sanitizeDeep(updates);


        await updateDoc(doc(db, 'tasks', taskId), {
            ...sanitizedUpdates,
            updatedAt: new Date().toISOString()
        });

        // Handle Assignee Change Notifications
        if (updates.assignedTo) {
            await AuthService.handleAssigneeNotifications(taskId, updates, false);
        }

        // --- AUTO-ARCHIVING LOGIC (NEW) ---
        // Auto-archiving was removed as per user request to provide manual/bulk control to admins
        /*
        try {
            const finalTaskDoc = await getDoc(doc(db, 'tasks', taskId));
            const task = finalTaskDoc.data() as Task;
            
            if (task.status === TaskStatus.COMPLETED && 
                task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION && 
                task.fiscalYear) {
                
                const currentFY = getNepaliFiscalYear(new Date());
                if (currentFY > task.fiscalYear) {
                    await updateDoc(doc(db, 'tasks', taskId), {
                        status: TaskStatus.ARCHIVED,
                        archivedFiscalYear: task.fiscalYear,
                        archivedAt: new Date().toISOString()
                    });
                }
            }
        } catch (archErr) {
            console.error("Auto-archiving check failed:", archErr);
        }
        */

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logTaskAction(
                AuditAction.TASK_UPDATED,
                auth.currentUser.uid,
                userName,
                taskId,
                updates.title || 'Task',
                { updates }
            );
        }
    },

    updateTaskStatusOnly: async (taskId: string, newStatus: TaskStatus): Promise<void> => {
        if (!auth.currentUser) throw new Error("Unauthenticated");
        await updateDoc(doc(db, 'tasks', taskId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logTaskAction(
                AuditAction.TASK_UPDATED,
                auth.currentUser.uid,
                userName,
                taskId,
                `Status changed to ${newStatus}`,
                { newStatus }
            );
        }
    },

    handleStatusChange: async (task: Task, newStatus: TaskStatus) => {
        // 1. Internal Notification for all assignees & creator
        const recipients = new Set([...(task.assignedTo || []), task.createdBy]);
        if (task.teamLeaderId) recipients.add(task.teamLeaderId);

        for (const uid of recipients) {
            // Don't notify the person who made the change?
            // Actually, usually helpful to confirm.

            await AuthService.createNotification({
                userId: uid,
                title: 'Task Status Updated',
                message: `"${task.title}" status changed from ${task.status} to ${newStatus}`,
                type: 'INFO',
                category: 'TASK',
                link: '/tasks'
            });

            // 2. Email Notification (Branded) - ONLY on Completion
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data() as UserProfile;
                    if (userData.email && newStatus === TaskStatus.COMPLETED && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) {
                        await EmailService.sendWorkflowStatusChange(
                            userData.email,
                            userData.displayName,
                            task.title,
                            task.status,
                            newStatus,
                            `${window.location.origin}/#/tasks`
                        );
                    }
                }
            } catch (emailErr) {
                console.error("Status Change Email failed", emailErr);
            }
        }
    },

    addTaskComment: async (taskId: string, comment: any) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");

        await updateDoc(doc(db, 'tasks', taskId), {
            comments: arrayUnion(comment)
        });

        // --- MENTION LOGIC ---
        try {
            const commentText = comment.text || "";
            const mentionRegex = /@(\w+)/g;
            const mentionedNames: string[] = [];
            let match;

            while ((match = mentionRegex.exec(commentText)) !== null) {
                mentionedNames.push(match[1]); // e.g., "Anil"
            }

            if (mentionedNames.length > 0) {
                // Fetch Task Data to check assignments
                const taskDoc = await getDoc(doc(db, 'tasks', taskId));
                const task = taskDoc.data() as Task;

                // Fetch All Users to resolve names to UIDs
                const users = await AuthService.getAllUsers();

                for (const name of mentionedNames) {
                    // Find user by First Name (Case insensitive)
                    const targetUser = users.find(u =>
                        u.displayName.toLowerCase().startsWith(name.toLowerCase()) ||
                        u.displayName.split(' ')[0].toLowerCase() === name.toLowerCase()
                    );

                    if (targetUser && targetUser.email) {
                        // PERMISSION CHECK:
                        // User must constitute "Team" (Assigned to Task) OR be an Admin
                        const isAssigned = task.assignedTo?.includes(targetUser.uid);
                        const isAdmin = targetUser.role === UserRole.ADMIN || targetUser.role === UserRole.MASTER_ADMIN;

                        if (isAssigned || isAdmin) {
                            console.log(`Sending mention notification to ${targetUser.displayName}`);

                            // Send Email
                            await EmailService.sendCommentMention(
                                targetUser.email,
                                targetUser.displayName,
                                comment.userName || 'A Colleague',
                                task.title,
                                task.clientName || 'Internal Project',
                                commentText,
                                `${window.location.origin}/#/tasks`
                            );

                            // Send In-App Notification
                            await AuthService.createNotification({
                                userId: targetUser.uid,
                                title: 'You were mentioned',
                                message: `${comment.userName || 'A Colleague'} mentioned you in ${task.title} and ${task.clientName || 'Internal Project'} along with the message: "${commentText}"`,
                                type: 'INFO',
                                category: 'TASK',
                                link: '/tasks'
                            });
                        } else {
                            console.warn(`User ${name} mentioned but not authorized to view task.`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error processing mentions:", error);
            // Don't fail the comment save just because notification failed
        }
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

            // Idempotency Check: If checking within an unexpected state
            if (!record.clockOut && existing.clockIn && !existing.clockOut) {
                // User is trying to Clock In, but session is ALREADY open.
                // Instead of error, we just treat it as success (sync).
                console.log("Session already active. Syncing...");
                return;
            }

            const { id, ...updateData } = record;

            // Fix: Don't overwrite clockIn if it is set to 'KEEP_EXISTING'
            if (updateData.clockIn === 'KEEP_EXISTING') {
                delete (updateData as any).clockIn;
            }

            await updateDoc(doc(db, 'attendance', docId), updateData);
        } else {
            // Create New
            const { id, ...data } = record;
            await addDoc(collection(db, 'attendance'), data);
        }
    },

    requestManualAttendance: async (requestData: Omit<AttendanceLogRequest, 'id' | 'requestStatus' | 'requestedAt'>) => {
        const newRequest: Omit<AttendanceLogRequest, 'id'> = {
            ...requestData,
            requestStatus: 'PENDING',
            requestedAt: new Date().toISOString()
        };
        const ref = await addDoc(collection(db, 'attendanceRequests'), newRequest);
        
        // ── Notify Admins ──────────────────────────────────────────────
        try {
            const users = await AuthService.getAllUsers();
            const admins = users.filter(u => 
                u.role === UserRole.ADMIN || 
                u.role === UserRole.MASTER_ADMIN || 
                u.role === UserRole.MANAGER
            );

            for (const admin of admins) {
                await AuthService.createNotification({
                    userId: admin.uid,
                    title: 'New Attendance Request',
                    message: `${requestData.userName} requested a manual log for ${requestData.date}`,
                    type: 'INFO',
                    category: 'ATTENDANCE',
                    link: '/attendance'
                });
            }
        } catch (error) {
            console.error("Failed to notify admins of attendance request:", error);
        }

        // Log the action
        if (auth.currentUser) {
            await createAuditLog({
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || 'User',
                action: AuditAction.LEAVE_REQUESTED, 
                targetType: 'attendance',
                targetId: ref.id,
                targetName: `Manual Log Request for ${requestData.date}`,
                details: { request: newRequest }
            });
        }
        return ref.id;
    },

    getPendingAttendanceRequests: async (): Promise<AttendanceLogRequest[]> => {
        const q = query(
            collection(db, 'attendanceRequests'),
            where('requestStatus', '==', 'PENDING')
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(d => docConverter<AttendanceLogRequest>(d));
        // Sort in-memory to avoid composite index requirement
        return results.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
    },

    approveAttendanceRequest: async (requestId: string, adminId: string, adminName: string) => {
        const reqRef = doc(db, 'attendanceRequests', requestId);
        const reqSnap = await getDoc(reqRef);
        
        if (!reqSnap.exists()) throw new Error("Request not found");
        
        const reqData = reqSnap.data() as AttendanceLogRequest;
        
        // 1. Create or Update actual attendance record
        const attendanceRecord: AttendanceRecord = {
            id: '', // Will be handled by recordAttendance
            userId: reqData.userId,
            userName: reqData.userName,
            date: reqData.date,
            clockIn: reqData.clockIn,
            clockOut: reqData.clockOut,
            status: reqData.status,
            notes: reqData.notes,
            workHours: reqData.workHours,
            workLogs: reqData.workLogs,
            clientIds: reqData.clientIds,
            clientId: reqData.clientId,
            clientName: reqData.clientName
        };
        
        await AuthService.recordAttendance(attendanceRecord);
        
        // 2. Update request status
        await updateDoc(reqRef, {
            requestStatus: 'APPROVED',
            adminNotes: `Approved by ${adminName}`
        });

        // 3. Notify User via Email
        try {
            const userDoc = await getDoc(doc(db, 'users', reqData.userId));
            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.email) {
                    await EmailService.sendAttendanceStatusChange(
                        userData.email,
                        userData.displayName,
                        reqData.date,
                        'APPROVED',
                        `Approved by ${adminName}`
                    );
                }
            }
        } catch (err) {
            console.error("Failed to send attendance approval email:", err);
        }

        // 4. Log Audit
        await createAuditLog({
            userId: adminId,
            userName: adminName,
            action: AuditAction.USER_UPDATED,
            targetType: 'attendance',
            targetId: requestId,
            targetName: 'Manual Log Approval',
            details: { approvedFor: reqData.userName, date: reqData.date }
        });
    },

    rejectAttendanceRequest: async (requestId: string, adminId: string, adminName: string, reason: string) => {
        const reqRef = doc(db, 'attendanceRequests', requestId);
        const reqSnap = await getDoc(reqRef);
        
        if (!reqSnap.exists()) throw new Error("Request not found");
        const reqData = reqSnap.data() as AttendanceLogRequest;

        await updateDoc(reqRef, {
            requestStatus: 'REJECTED',
            adminNotes: reason
        });

        // Notify User via Email
        try {
            const userDoc = await getDoc(doc(db, 'users', reqData.userId));
            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.email) {
                    await EmailService.sendAttendanceStatusChange(
                        userData.email,
                        userData.displayName,
                        reqData.date,
                        'REJECTED',
                        reason
                    );
                }
            }
        } catch (err) {
            console.error("Failed to send attendance rejection email:", err);
        }

        // Log Audit
        await createAuditLog({
            userId: adminId,
            userName: adminName,
            action: AuditAction.USER_UPDATED,
            targetType: 'attendance',
            targetId: requestId,
            targetName: 'Manual Log Rejection',
            details: { reason }
        });
    },

    getLateCountLast30Days: async (userId: string): Promise<number> => {
        // Calculate date 30 days ago
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const dateStr = date.toISOString().split('T')[0];

        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            where('date', '>=', dateStr)
        );

        const snapshot = await getDocs(q);
        // Filter for 'LATE' status in memory to avoid complex index requirements
        const lateDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            return data.status === 'LATE';
        });

        return lateDocs.length;
    },

    // --- EVENTS (Enhanced) ---

    /**
     * Get all events visible to a specific user based on visibility rules
     */
    getAllEventsForUser: async (userId: string, userRole: UserRole, userDept: string): Promise<CalendarEvent[]> => {
        const snapshot = await getDocs(collection(db, 'events'));
        const allEvents = snapshot.docs.map(d => docConverter<CalendarEvent>(d));

        // Filter based on visibility
        const visibleEvents = allEvents.filter(event => {
            // PUBLIC events visible to all
            if (event.visibility === 'PUBLIC') return true;

            // PRIVATE events only visible to creator
            if (event.visibility === 'PRIVATE') {
                return event.createdBy === userId;
            }

            // TEAM events visible to team members
            if (event.visibility === 'TEAM') {
                return event.teamIds?.includes(userId) || event.createdBy === userId;
            }

            // DEPARTMENT events visible to department members
            if (event.visibility === 'DEPARTMENT') {
                return event.department === userDept || event.createdBy === userId;
            }

            // Admins can see all events
            if (userRole === UserRole.ADMIN || userRole === UserRole.MASTER_ADMIN) {
                return true;
            }

            return false;
        });

        return visibleEvents;
    },

    /**
     * Legacy function for backwards compatibility
     * Returns all PUBLIC events
     */
    getAllEvents: async (): Promise<CalendarEvent[]> => {
        const snapshot = await getDocs(collection(db, 'events'));
        const allEvents = snapshot.docs.map(d => docConverter<CalendarEvent>(d));
        // Return only public events for backwards compatibility
        return allEvents.filter(e => e.visibility === 'PUBLIC' || !e.visibility);
    },

    /**
     * Resolve the set of user UIDs to notify based on event visibility rules.
     * Returns { uids: string[] } — the creator is excluded (they already know).
     */
    resolveEventRecipients: async (
        event: Partial<CalendarEvent>,
        creatorId: string,
        allUsers?: UserProfile[]
    ): Promise<UserProfile[]> => {
        // Fetch all users only once (caller can pass them in to avoid extra read)
        const users: UserProfile[] = allUsers || await AuthService.getAllUsers();
        const activeUsers = users.filter(u => u.uid !== creatorId && u.status === 'Active');

        const { visibility, teamIds, department } = event as CalendarEvent;

        // TEAM  → only the selected teamIds
        if (visibility === 'TEAM' && teamIds && teamIds.length > 0) {
            return activeUsers.filter(u => teamIds.includes(u.uid));
        }

        // PUBLIC, FIRM_EVENT, HOLIDAY → everyone
        if (visibility === 'PUBLIC') {
            return activeUsers;
        }

        // DEPARTMENT → same department
        if (visibility === 'DEPARTMENT' && department) {
            return activeUsers.filter(u => u.department === department);
        }

        // PRIVATE → no one else
        return [];
    },

    /**
     * Save a new event with metadata and validation.
     * Sends in-app and email notifications to all relevant recipients.
     */
    saveEvent: async (event: CalendarEvent) => {
        const { id, ...data } = event;

        // Filter out undefined values (Firestore doesn't accept undefined)
        const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        // Add metadata
        const eventData = {
            ...cleanedData,
            createdAt: cleanedData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, 'events'), eventData);
        const eventId = docRef.id;
        const calendarLink = `${window.location.origin}/#/calendar`;
        const dateLabel = event.date + (event.time ? ' at ' + event.time : '');

        // ── Determine recipients ──────────────────────────────────────────────
        // 1. Visibility-based recipients (TEAM / PUBLIC / DEPARTMENT)
        const visibilityRecipients = await AuthService.resolveEventRecipients(event, event.createdBy);

        // 2. Explicit participant invitees (RSVP list) — merge without duplicates
        const participantIds = new Set(event.participants || []);
        const visibilityIds = new Set(visibilityRecipients.map(u => u.uid));
        const allRecipientIds = new Set([...visibilityIds, ...participantIds]);

        // For participant-only lookups we may need their profiles too
        const allUserProfiles: Record<string, UserProfile> = {};
        visibilityRecipients.forEach(u => { allUserProfiles[u.uid] = u; });

        // Fetch profiles for any extra participants not already in visibilityRecipients
        const missingIds = [...participantIds].filter(pid => !allUserProfiles[pid]);
        for (const pid of missingIds) {
            try {
                const pDoc = await getDoc(doc(db, 'users', pid));
                if (pDoc.exists()) allUserProfiles[pid] = { uid: pid, ...pDoc.data() } as UserProfile;
            } catch { /* skip bad refs */ }
        }

        // ── Send notifications and emails ─────────────────────────────────────
        const notifTitle = event.type === 'FIRM_EVENT' || event.type === 'HOLIDAY'
            ? `📅 ${event.type === 'HOLIDAY' ? 'Holiday' : 'Firm Event'}: ${event.title}`
            : `New Event: ${event.title}`;

        for (const uid of allRecipientIds) {
            const isRsvpInvitee = participantIds.has(uid);
            let message = isRsvpInvitee
                ? `You've been invited to "${event.title}" on ${dateLabel}`
                : `"${event.title}" has been added to the calendar on ${dateLabel}`;
            
            if (event.type === 'HOLIDAY') {
                message = `Holiday Notice: ${event.title} on ${dateLabel}. Office will remain closed.`;
            }

            // In-app notification
            await AuthService.createNotification({
                userId: uid,
                title: notifTitle,
                message,
                type: 'INFO',
                category: 'EVENT',
                link: '/calendar'
            });

            // Email notification
            try {
                const profile = allUserProfiles[uid];
                if (profile?.email) {
                    await EmailService.sendEventInvitation(
                        profile.email,
                        profile.displayName || 'Colleague',
                        event.title,
                        dateLabel,
                        calendarLink,
                        event.type
                    );
                }
            } catch (err) {
                console.error(`Failed to send event email to ${uid}`, err);
            }
        }

        return eventId;
    },

    /**
     * Update an existing event
     * Permission check: only creator or admin can update
     */
    updateEvent: async (eventId: string, updates: Partial<CalendarEvent>, userId: string, userRole: UserRole) => {
        const eventDoc = await getDoc(doc(db, 'events', eventId));

        if (!eventDoc.exists()) {
            throw new Error('Event not found');
        }

        const existingEvent = eventDoc.data() as CalendarEvent;

        // Permission check
        const isCreator = existingEvent.createdBy === userId;
        const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.MASTER_ADMIN;

        if (!isCreator && !isAdmin) {
            throw new Error('You do not have permission to edit this event');
        }

        // Filter out undefined values
        const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        // Update with timestamp
        const updateData = {
            ...cleanedUpdates,
            updatedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'events', eventId), updateData);

        // Notify participants of update if significant changes
        if (existingEvent.participants && (updates.date || updates.time || updates.title)) {
            for (const participantId of existingEvent.participants) {
                await AuthService.createNotification({
                    userId: participantId,
                    title: 'Event Updated',
                    message: `Event "${existingEvent.title}" has been updated`,
                    type: 'INFO',
                    category: 'EVENT',
                    link: '/calendar'
                });
            }
        }
    },

    /**
     * Delete an event
     * Permission check: only creator or admin can delete
     */
    deleteEvent: async (eventId: string, userId: string, userRole: UserRole) => {
        const eventDoc = await getDoc(doc(db, 'events', eventId));

        if (!eventDoc.exists()) {
            throw new Error('Event not found');
        }

        const event = eventDoc.data() as CalendarEvent;

        // Permission check
        const isCreator = event.createdBy === userId;
        const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.MASTER_ADMIN;

        if (!isCreator && !isAdmin) {
            throw new Error('You do not have permission to delete this event');
        }

        // Delete the event
        await deleteDoc(doc(db, 'events', eventId));

        // Notify participants of cancellation
        if (event.participants) {
            for (const participantId of event.participants) {
                await AuthService.createNotification({
                    userId: participantId,
                    title: 'Event Cancelled',
                    message: `Event "${event.title}" has been cancelled`,
                    type: 'WARNING',
                    category: 'EVENT',
                    link: '/calendar'
                });
            }
        }
    },

    /**
     * Respond to event RSVP
     */
    respondToEventRSVP: async (eventId: string, userId: string, response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
        const eventDoc = doc(db, 'events', eventId);
        const eventData = (await getDoc(eventDoc)).data() as CalendarEvent;

        if (!eventData.rsvpRequired) {
            throw new Error('RSVP not required for this event');
        }

        // Update RSVP responses
        const rsvpResponses = eventData.rsvpResponses || {};
        rsvpResponses[userId] = response;

        await updateDoc(eventDoc, {
            rsvpResponses,
            updatedAt: new Date().toISOString()
        });

        // Notify event creator of RSVP
        await AuthService.createNotification({
            userId: eventData.createdBy,
            title: 'RSVP Response',
            message: `Someone ${response.toLowerCase()} your event "${eventData.title}"`,
            type: 'INFO',
            category: 'EVENT',
            link: '/calendar'
        });
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
        const ref = await addDoc(collection(db, 'leaves'), {
            ...leave,
            createdAt: new Date().toISOString()
        });

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await logLeaveAction(
                AuditAction.LEAVE_REQUESTED,
                auth.currentUser.uid,
                userName,
                ref.id,
                leave.type,
                { leave }
            );

            // ── Notify Admins ──────────────────────────────────────────────
            try {
                const users = await AuthService.getAllUsers();
                const admins = users.filter(u => 
                    u.role === UserRole.ADMIN || 
                    u.role === UserRole.MASTER_ADMIN || 
                    u.role === UserRole.MANAGER
                );

                for (const admin of admins) {
                    await AuthService.createNotification({
                        userId: admin.uid,
                        title: 'New Leave Request',
                        message: `${userName} has requested ${leave.type} leave from ${leave.startDate} to ${leave.endDate}.`,
                        type: 'INFO',
                        category: 'LEAVE',
                        link: '/leaves'
                    });
                }
            } catch (error) {
                console.error("Failed to notify admins of leave request:", error);
            }
        }
    },

    updateLeaveStatus: async (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
        const leaveDoc = doc(db, 'leaves', id);
        const leaveSnap = await getDoc(leaveDoc);
        if (!leaveSnap.exists()) throw new Error("Leave request not found");
        
        const leaveData = leaveSnap.data() as LeaveRequest;
        
        await updateDoc(leaveDoc, { 
            status,
            rejectionReason: reason || null
        });

        // Notify User
        try {
            const userDoc = await getDoc(doc(db, 'users', leaveData.userId));
            if (userDoc.exists()) {
                const userData = userDoc.data() as UserProfile;
                if (userData.email) {
                    await EmailService.sendLeaveStatusChange(
                        userData.email,
                        userData.displayName,
                        leaveData.type,
                        leaveData.startDate,
                        leaveData.endDate,
                        status,
                        reason
                    );
                }
            }
        } catch (err) {
            console.error("Failed to send leave notification email:", err);
        }

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'Admin';
            await logLeaveAction(
                status === 'APPROVED' ? AuditAction.LEAVE_APPROVED : AuditAction.LEAVE_REJECTED,
                auth.currentUser.uid,
                userName,
                id,
                'Leave Request',
                { status }
            );
        }

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
        const { id, ...data } = resource; // Destructure to exclude 'id' if present in the input object
        const ref = await addDoc(collection(db, 'resources'), {
            ...data, // Use 'data' which excludes 'id'
            createdAt: new Date().toISOString()
        });

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'User';
            await createAuditLog({
                userId: auth.currentUser.uid,
                userName: userName,
                action: AuditAction.RESOURCE_CREATED,
                targetType: 'resource',
                targetId: ref.id,
                targetName: resource.title,
                details: { type: resource.type }
            });
        }
    },

    // Soft-delete: move to trash (sets isDeleted + deletedAt, does NOT remove doc)
    deleteResource: async (id: string) => {
        const resourceDoc = await getDoc(doc(db, 'resources', id));
        const resourceData = resourceDoc.exists() ? resourceDoc.data() as Resource : null;

        const deletedAt = new Date().toISOString();
        const deletedBy = auth.currentUser?.uid || '';

        await updateDoc(doc(db, 'resources', id), {
            isDeleted: true,
            deletedAt,
            deletedBy,
        });

        if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userName = userDoc.exists() ? userDoc.data().displayName : 'Admin';
            await createAuditLog({
                userId: auth.currentUser.uid,
                userName: userName,
                action: AuditAction.RESOURCE_DELETED,
                targetType: 'resource',
                targetId: id,
                targetName: resourceData?.title || 'Resource',
                details: { trashedAt: deletedAt }
            });
        }
    },

    // Restore a trashed resource back to the library
    restoreResource: async (id: string) => {
        await updateDoc(doc(db, 'resources', id), {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
        });
    },

    // Permanently delete a single resource (for Master Admin "empty trash" or force-purge)
    purgeResource: async (id: string) => {
        await deleteDoc(doc(db, 'resources', id));
    },

    // Auto-purge resources that have been in trash for more than 30 days
    purgeExpiredTrashResources: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffISO = cutoff.toISOString();

        const snapshot = await getDocs(collection(db, 'resources'));
        const expired = snapshot.docs.filter(d => {
            const data = d.data();
            return data.isDeleted === true && data.deletedAt && data.deletedAt < cutoffISO;
        });

        await Promise.all(expired.map(d => deleteDoc(d.ref)));
        return expired.length;
    },

    updateResource: async (resource: Resource) => {
        const { id, ...data } = resource;
        await updateDoc(doc(db, 'resources', id), data);
    },

    // --- TASK ARCHIVING ---
    archiveTasksByFiscalYear: async (fiscalYear: string) => {
        if (!auth.currentUser) throw new Error("Unauthenticated");
        
        // Get all completed tasks
        const q = query(collection(db, 'tasks'), where('status', '==', TaskStatus.COMPLETED));
        const snapshot = await getDocs(q);
        
        const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        
        // Filter those that belong to the target fiscal year
        const toArchive = tasks.filter(t => {
            if (!t.completedAt) return false;
            return getNepaliFiscalYear(t.completedAt) === fiscalYear;
        });
        
        if (toArchive.length === 0) return 0;
        
        const batch = writeBatch(db);
        toArchive.forEach(t => {
            const ref = doc(db, 'tasks', t.id);
            batch.update(ref, {
                status: TaskStatus.ARCHIVED,
                archivedFiscalYear: fiscalYear
            });
        });
        
        await batch.commit();
        
        // Log action
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userName = userDoc.exists() ? userDoc.data().displayName : 'Admin';
        await createAuditLog({
            userId: auth.currentUser.uid,
            userName: userName,
            action: AuditAction.TASK_UPDATED,
            targetType: 'task',
            targetId: 'multiple',
            targetName: `FY ${fiscalYear} Archive`,
            details: { action: 'archived_by_fy', count: toArchive.length, fiscalYear }
        });
        
        return toArchive.length;
    },

    getArchivedTasks: async (fiscalYear: string): Promise<Task[]> => {
        const q = query(
            collection(db, 'tasks'), 
            where('status', '==', TaskStatus.ARCHIVED)
        );
        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        
        return tasks
            .filter(t => t.archivedFiscalYear === fiscalYear)
            .sort((a, b) => {
                const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return dateB - dateA;
            });
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

    markAllAsRead: async (notificationIds: string[]) => {
        if (!notificationIds || notificationIds.length === 0) return;

        // Firestore batch limit is 500 operations
        const batchSize = 500;
        const batches = [];

        for (let i = 0; i < notificationIds.length; i += batchSize) {
            const chunk = notificationIds.slice(i, i + batchSize);
            const batch = import('firebase/firestore').then(async ({ writeBatch }) => {
                const firebaseBatch = writeBatch(db);
                chunk.forEach(id => {
                    const ref = doc(db, 'notifications', id);
                    firebaseBatch.update(ref, { read: true });
                });
                await firebaseBatch.commit();
            });
            batches.push(batch);
        }

        await Promise.all(batches);
    },

    /**
     * Delete notifications older than 30 days
     */
    cleanupOldNotifications: async (userId: string, isAdmin: boolean = false) => {
        try {
            const date = new Date();
            date.setDate(date.getDate() - 30);
            const cutoffDate = date.toISOString();

            // 1. Query for this user's old notifications
            const qUser = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                where('createdAt', '<', cutoffDate)
            );

            // 2. If admin, also scan for shared 'ALL' notifications to keep the feed clean
            let qAll = null;
            if (isAdmin) {
                qAll = query(
                    collection(db, 'notifications'),
                    where('userId', '==', 'ALL'),
                    where('createdAt', '<', cutoffDate)
                );
            }

            const [userSnap, allSnap] = await Promise.all([
                getDocs(qUser),
                qAll ? getDocs(qAll) : Promise.resolve({ docs: [], empty: true })
            ]);

            const allDocs = [...userSnap.docs, ...(allSnap as any).docs];
            if (allDocs.length === 0) return;

            console.log(`[NotificationCleanup] Purging ${allDocs.length} notifications older than 30 days.`);

            const batchSize = 500;
            for (let i = 0; i < allDocs.length; i += batchSize) {
                const chunk = allDocs.slice(i, i + batchSize);
                const batch = writeBatch(db);
                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
        } catch (error: any) {
            // Silently ignore permission errors for background cleanup tasks
            if (error.code !== 'permission-denied') {
                console.error("Failed to cleanup old notifications:", error);
            }
        }
    },

    /**
     * Delete audit logs older than 90 days.
     * Uses batching to overcome Firestore transaction limits.
     */
    cleanupOldAuditLogs: async () => {
        try {
            const date = new Date();
            date.setDate(date.getDate() - 90);
            const cutoffDate = date.toISOString();

            const q = query(
                collection(db, 'auditLogs'),
                where('timestamp', '<', cutoffDate)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) return;

            console.log(`Cleaning up ${snapshot.size} old audit logs`);

            const batchSize = 500;
            const batches = [];

            for (let i = 0; i < snapshot.docs.length; i += batchSize) {
                const chunk = snapshot.docs.slice(i, i + batchSize);
                const batch = import('firebase/firestore').then(async ({ writeBatch }) => {
                    const firebaseBatch = writeBatch(db);
                    chunk.forEach(doc => {
                        firebaseBatch.delete(doc.ref);
                    });
                    await firebaseBatch.commit();
                });
                batches.push(batch);
            }

            await Promise.all(batches);
        } catch (error: any) {
            if (error.code !== 'permission-denied') {
                console.error("Failed to cleanup old audit logs:", error);
            }
        }
    },

    getLastAuditCleanup: (): string | null => {
        return localStorage.getItem('lastAuditCleanupDate');
    },

    setLastAuditCleanup: (dateStr: string) => {
        localStorage.setItem('lastAuditCleanupDate', dateStr);
    },

    // Real-time listener
    // Real-time listener with Retry Logic
    subscribeToNotifications: (userId: string, callback: (notifications: AppNotification[]) => void) => {
        let unsubscribe: () => void = () => { };
        let retryTimeout: any = null;
        let attempt = 0;
        const maxAttempts = 5;

        const setupListener = () => {
            const q = query(
                collection(db, 'notifications'),
                where('userId', 'in', [userId, 'ALL']),
                orderBy('createdAt', 'desc')
            );

            unsubscribe = onSnapshot(q,
                (snapshot) => {
                    // Reset attempts on success
                    attempt = 0;
                    const notifs = snapshot.docs.map(d => docConverter<AppNotification>(d));
                    callback(notifs);
                },
                (error) => {
                    console.error("Firestore Notification Listener Error:", error);

                    if (error.code === 'failed-precondition') {
                        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s delay

                        if (attempt < maxAttempts) {
                            console.warn(`Index building... Retrying in ${delay}ms (Attempt ${attempt + 1}/${maxAttempts})`);
                            toast.loading(`System updating indexes. Retrying in ${Math.round(delay / 1000)}s...`, { id: 'auth-index-building' });

                            retryTimeout = setTimeout(() => {
                                attempt++;
                                setupListener();
                            }, delay);
                        } else {
                            toast.error("System update taking longer than expected. Please refresh later.", { id: 'auth-index-building' });
                        }
                    } else {
                        toast.error("Connection interrupted. Reconnecting...");
                    }
                }
            );
        };

        setupListener();

        // Return a wrapper unsubscribe that cleans up everything
        return () => {
            if (unsubscribe) unsubscribe();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }
};

export const isDemoMode = false;

// ── New Query Methods (added to AuthService above via object spread workaround) ──
// These are standalone exports that delegate to AuthService-style patterns

export const getAuditLogsByClientId = async (clientId: string): Promise<AuditLog[]> => {
    const q = query(
        collection(db, 'auditLogs'),
        where('targetId', '==', clientId),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as AuditLog));
};

export const getAuditLogsByUserId = async (userId: string): Promise<AuditLog[]> => {
    const q = query(
        collection(db, 'auditLogs'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as AuditLog));
};

export const getAttendanceByUserId = async (userId: string, limitCount: number = 30): Promise<AttendanceRecord[]> => {
    const q = query(
        collection(db, 'attendance'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
};

export const getAttendanceByClientId = async (clientId: string): Promise<AttendanceRecord[]> => {
    const q1 = query(collection(db, 'attendance'), where('clientId', '==', clientId));
    const q2 = query(collection(db, 'attendance'), where('clientIds', 'array-contains', clientId));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const combined = new Map<string, AttendanceRecord>();
    [...snap1.docs, ...snap2.docs].forEach(d => combined.set(d.id, { id: d.id, ...d.data() } as AttendanceRecord));
    return Array.from(combined.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const updateClientRiskAreas = async (clientId: string, riskAreas: RiskAreaDocument[]): Promise<void> => {
    await updateDoc(doc(db, 'clients', clientId), {
        riskAreas,
        updatedAt: new Date().toISOString()
    });
};

export const updateClientNotes = async (clientId: string, notes: string, updatedBy: string): Promise<void> => {
    await updateDoc(doc(db, 'clients', clientId), {
        clientNotes: notes,
        updatedAt: new Date().toISOString()
    });
};