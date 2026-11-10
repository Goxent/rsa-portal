import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { AttendanceRecord, WorkLog } from '../types';
import { toast } from 'react-hot-toast';

export const attendanceKeys = {
    all: ['attendance'] as const,
    user: (userId: string) => [...attendanceKeys.all, userId] as const,
    history: (userId: string) => [...attendanceKeys.user(userId), 'history'] as const,
    today: (userId: string) => [...attendanceKeys.user(userId), 'today'] as const,
    lateCountBS: (userId: string) => [...attendanceKeys.user(userId), 'lateCountBS'] as const,
};

export const useAttendanceHistory = (userId: string | undefined) => {
    return useQuery({
        queryKey: attendanceKeys.history(userId || ''),
        queryFn: () => userId ? AuthService.getAttendanceHistory(userId) : Promise.resolve([]),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

/**
 * Live, fast-sync today's attendance record (D4 fix).
 * Low staleTime ensures mobile check-ins reflect immediately on desktop.
 */
export const useTodayAttendance = (userId: string | undefined) => {
    return useQuery({
        queryKey: attendanceKeys.today(userId || ''),
        queryFn: () => userId ? AuthService.getTodayAttendance(userId) : Promise.resolve(null),
        enabled: !!userId,
        staleTime: 1000 * 15, // 15 seconds
        refetchOnWindowFocus: true,
    });
};

/**
 * Late counter per Bikram Sambat (BS) month (A1 fix).
 * Tracks 6-late threshold per Nepali month according to the RSA Employee Handbook.
 */
export const useCurrentBSMonthLateCount = (userId: string | undefined) => {
    return useQuery({
        queryKey: attendanceKeys.lateCountBS(userId || ''),
        queryFn: () => userId ? AuthService.getLateCountInCurrentBSMonth(userId) : Promise.resolve({ count: 0, justifiedCount: 0, records: [] }),
        enabled: !!userId,
        staleTime: 1000 * 60 * 2,
    });
};

export const useClockIn = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            userId: string;
            method?: 'WEB' | 'MOBILE';
            location?: string;
            notes?: string;
            workLogs?: WorkLog[];
            clientIds?: string[];
            checkInType?: 'OFFICE' | 'CLIENT_SITE' | 'REMOTE';
            clientAtCheckIn?: string;
        }) =>
            AuthService.clockIn(
                data.userId,
                data.method || 'WEB',
                data.location,
                data.notes,
                data.workLogs,
                data.clientIds,
                data.checkInType || 'OFFICE',
                data.clientAtCheckIn
            ),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
            queryClient.invalidateQueries({ queryKey: attendanceKeys.today(variables.userId) });
            queryClient.invalidateQueries({ queryKey: attendanceKeys.history(variables.userId) });
            queryClient.invalidateQueries({ queryKey: attendanceKeys.lateCountBS(variables.userId) });
            toast.success('Clocked in successfully');
        },
        onError: (error: Error) => {
            toast.error(`Clock in failed: ${error.message}`);
        }
    });
};

export const useClockOut = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            userId: string;
            recordId: string;
            notes?: string;
            workLogs?: WorkLog[];
            dailyReport?: { done: string; pending: string; blockers?: string; tomorrow: string; };
        }) =>
            AuthService.clockOut(data.userId, data.recordId, data.notes, data.workLogs, data.dailyReport),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
            queryClient.invalidateQueries({ queryKey: attendanceKeys.today(variables.userId) });
            queryClient.invalidateQueries({ queryKey: attendanceKeys.history(variables.userId) });
            toast.success('Clocked out successfully');
        },
        onError: (error: Error) => {
            toast.error(`Clock out failed: ${error.message}`);
        }
    });
};
