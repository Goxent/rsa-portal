import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Checks whether the user is accessing the portal from the office network
 * by comparing their current public IP against the VITE_OFFICE_IP env variable.
 *
 * Configuration:
 *   Add VITE_OFFICE_IP=<your-office-public-ip> to .env.local
 *   If VITE_OFFICE_IP is not set, the check is bypassed (returns true) to avoid
 *   locking out admins during local development.
 *
 * Polling: Re-checks every 2 minutes and on tab focus change so that disconnecting
 * from the office network mid-session locks the user out promptly.
 */

export type WifiCheckState = 'CHECKING' | 'OFFICE' | 'REMOTE' | 'ERROR';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useOfficeWifiCheck() {
    const [status, setStatus] = useState<WifiCheckState>('CHECKING');
    const [publicIp, setPublicIp] = useState<string | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const officeIp = import.meta.env.VITE_OFFICE_IP as string | undefined;

    const check = useCallback(async () => {
        // Only show CHECKING on first load; subsequent polls should silently update
        setStatus(prev => prev === null ? 'CHECKING' : prev);

        // If no office IP is configured, skip the gate (dev mode safety net)
        if (!officeIp) {
            setStatus('OFFICE');
            setLastChecked(new Date());
            return;
        }

        try {
            const res = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(5000),
            });
            const data: { ip: string } = await res.json();
            setPublicIp(data.ip);
            setStatus(data.ip === officeIp ? 'OFFICE' : 'REMOTE');
            setLastChecked(new Date());
        } catch {
            setStatus('ERROR');
            setLastChecked(new Date());
        }
    }, [officeIp]);

    useEffect(() => {
        // Initial check
        check();

        // Poll every 2 minutes
        intervalRef.current = setInterval(check, POLL_INTERVAL_MS);

        // Re-check when tab becomes visible again (user switches back to tab)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [check]);

    return { status, publicIp, retry: check, officeIp, lastChecked };
}
