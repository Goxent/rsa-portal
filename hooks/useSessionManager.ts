import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import toast from 'react-hot-toast';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

export const useSessionManager = () => {
    const { user, logout } = useAuth();

    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as UserProfile;
                const localSessionId = localStorage.getItem('sessionId');
                
                // [REMOVED] Concurrent Login Check disabled per request
                /*
                if (userData.currentSessionId && localSessionId && userData.currentSessionId !== localSessionId) {
                    toast.error('You were logged out because your account was accessed from another device.', {
                        duration: 8000,
                        icon: '⚠️'
                    });
                    
                    // Force logout on this device
                    await logout();
                    return;
                }
                */

                // 2. Check for Session Expiration (30 Days)
                if (userData.sessionCreatedAt) {
                    const sessionAge = Date.now() - userData.sessionCreatedAt;
                    if (sessionAge > SESSION_MAX_AGE_MS) {
                        toast.error('Your session has expired. Please log in again.', {
                            duration: 5000,
                            icon: '⏱️'
                        });
                        await logout();
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [user, logout]);
};
