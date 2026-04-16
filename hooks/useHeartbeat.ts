/**
 * useHeartbeat — keeps the current session "alive" while the tab is open.
 *
 * - Pings Firestore every 2 minutes to update `lastActive` on the session.
 * - Re-pings immediately when the tab becomes visible again (user switches back).
 * - Does NOT ping when the tab is hidden in the background.
 *
 * This means: once you close a tab / navigate away for >5 minutes, that session
 * is automatically considered stale and will NOT count toward the device limit.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { HEARTBEAT_INTERVAL_MS } from '../services/sessionService';

export const useHeartbeat = () => {
    const { user } = useAuth();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const ping = useCallback(async () => {
        const sessionId = localStorage.getItem('sessionId');
        if (!user?.uid || !sessionId || document.visibilityState === 'hidden') return;

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                [`activeSessions.${sessionId}.lastActive`]: Date.now(),
            });
        } catch {
            // Silent — heartbeat failure must never disrupt the UX
        }
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;

        // Ping immediately when hook mounts (page load / login)
        ping();

        // Set up the regular heartbeat interval
        intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

        // Re-ping when the user switches back to this tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                ping();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.uid, ping]);
};
