import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationService } from '../services/NotificationService';
import { useAttendanceHistory } from '../hooks/useAttendance';

export const NotificationManager: React.FC = () => {
    const { user } = useAuth();
    const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uid);
    const lastCheckRef = useRef<number>(0);

    useEffect(() => {
        if (!user) return;

        // Request permission on mount if logged in
        NotificationService.requestPermission();

        const checkInterval = setInterval(() => {
            const now = new Date();
            const currentMinute = Math.floor(now.getTime() / 60000);

            // Only check once per minute
            if (currentMinute === lastCheckRef.current) return;
            lastCheckRef.current = currentMinute;

            // Determine current status
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todayRecord = attendanceHistory.find((r: any) => r.date === todayStr);

            let status: 'CLOCKED_OUT' | 'CLOCKED_IN' | 'COMPLETED' = 'CLOCKED_OUT';
            if (todayRecord) {
                status = todayRecord.clockOut ? 'COMPLETED' : 'CLOCKED_IN';
            }

            NotificationService.checkReminders(user, status);
        }, 30000); // Check every 30 seconds

        return () => clearInterval(checkInterval);
    }, [user, attendanceHistory]);

    return null; // Side-effect only component
};
