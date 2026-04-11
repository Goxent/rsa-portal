import { useState, useEffect, useCallback } from 'react';

/**
 * Checks whether the user is accessing the portal from the office network
 * by comparing their current public IP against the VITE_OFFICE_IP env variable.
 *
 * Configuration:
 *   Add VITE_OFFICE_IP=<your-office-public-ip> to .env.local
 *   If VITE_OFFICE_IP is not set, the check is bypassed (returns true) to avoid
 *   locking out admins during local development.
 *
 * Future: replace the ipify fetch with a call to your own NAS health endpoint
 * for a more reliable office-network check.
 */

export type WifiCheckState = 'CHECKING' | 'OFFICE' | 'REMOTE' | 'ERROR';

export function useOfficeWifiCheck() {
    const [status, setStatus] = useState<WifiCheckState>('CHECKING');
    const [publicIp, setPublicIp] = useState<string | null>(null);

    const officeIp = import.meta.env.VITE_OFFICE_IP as string | undefined;

    const check = useCallback(async () => {
        setStatus('CHECKING');

        // If no office IP is configured, skip the gate (dev mode safety net)
        if (!officeIp) {
            setStatus('OFFICE');
            return;
        }

        try {
            const res = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(5000),
            });
            const data: { ip: string } = await res.json();
            setPublicIp(data.ip);
            setStatus(data.ip === officeIp ? 'OFFICE' : 'REMOTE');
        } catch {
            setStatus('ERROR');
        }
    }, [officeIp]);

    useEffect(() => {
        check();
    }, [check]);

    return { status, publicIp, retry: check, officeIp };
}
