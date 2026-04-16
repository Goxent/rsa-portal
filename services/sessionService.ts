/**
 * Session Service — Enterprise-grade session management
 * 
 * Key behaviours:
 * - Sessions are "active" only while the browser tab is open (heartbeat pinged every 2 min)
 * - Sessions not pinged in >5 minutes are considered STALE and do NOT count toward the device limit
 * - IP address + geolocation are captured on login
 * - Max 2 ACTIVE (non-stale) sessions are allowed simultaneously
 */

// How often the open tab pings Firestore to mark itself alive
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Sessions with no ping in this window are considered stale/inactive
export const SESSION_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionMetadata {
    sessionId: string;
    deviceId: string;
    deviceName: string;
    deviceType: 'MOBILE' | 'DESKTOP';
    ip: string;
    city: string;
    region: string;
    country: string;
    loggedInAt: number;
    lastActive: number;
}

export interface IPInfo {
    ip: string;
    city: string;
    region: string;
    country: string;
}

/**
 * Fetch the client's public IP and approximate geolocation.
 * Uses ipapi.co — free tier allows 30,000 req/month.
 * Silently returns fallback on failure.
 */
export const fetchClientIPInfo = async (): Promise<IPInfo> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            return {
                ip: data.ip || 'Unknown',
                city: data.city || 'Unknown',
                region: data.region || '',
                country: data.country_name || 'Unknown',
            };
        }
    } catch {
        // network error or timeout — silent fallback
    }
    return { ip: 'Unknown', city: 'Unknown', region: '', country: 'Unknown' };
};

/**
 * Returns true if a session's last heartbeat is older than SESSION_STALE_THRESHOLD_MS.
 * Stale sessions are NOT counted toward the concurrent device limit.
 */
export const isSessionStale = (lastActive: number): boolean => {
    return Date.now() - lastActive > SESSION_STALE_THRESHOLD_MS;
};

/**
 * From a map of activeSessions, return only the sessions that are currently active
 * (i.e., whose tab is open and has recently sent a heartbeat).
 */
export const getActiveSessions = (
    sessions: Record<string, SessionMetadata>
): SessionMetadata[] => {
    return Object.values(sessions).filter(
        (s): s is SessionMetadata => !!s && !isSessionStale(s.lastActive)
    );
};

/**
 * From a map of activeSessions, return sessions that are stale (tab is closed).
 */
export const getStaleSessions = (
    sessions: Record<string, SessionMetadata>
): SessionMetadata[] => {
    return Object.values(sessions).filter(
        (s): s is SessionMetadata => !!s && isSessionStale(s.lastActive)
    );
};
