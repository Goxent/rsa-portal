import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { AttendanceRecord } from '../types';
import { toast } from 'react-hot-toast';

export const attendanceKeys = {
    all: ['attendance'] as const,
    user: (userId: string) => [...attendanceKeys.all, userId] as const,
    history: (userId: string) => [...attendanceKeys.user(userId), 'history'] as const,
    today: (userId: string) => [...attendanceKeys.user(userId), 'today'] as const,
};

export const useAttendanceHistory = (userId: string | undefined) => {
    return useQuery({
        queryKey: attendanceKeys.history(userId || ''),
        queryFn: () => userId ? AuthService.getAttendanceHistory(userId) : Promise.resolve([]),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useClockIn = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { userId: string; method: 'WEB' | 'MOBILE'; location?: string; notes?: string }) =>
            AuthService.clockIn(data.userId, data.method, data.location, data.notes),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.user(variables.userId) });
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
        mutationFn: (data: { userId: string; recordId: string; notes?: string; workLogs?: any[] }) =>
            AuthService.clockOut(data.userId, data.recordId, data.notes, data.workLogs),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: attendanceKeys.user(variables.userId) });
            toast.success('Clocked out successfully');
        },
        onError: (error: Error) => {
            toast.error(`Clock out failed: ${error.message}`);
        }
    });
};
