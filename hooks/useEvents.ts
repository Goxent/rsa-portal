import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { CalendarEvent } from '../types';
import { toast } from 'react-hot-toast';

export const eventKeys = {
    all: ['events'] as const,
};

export const useEvents = () => {
    return useQuery({
        queryKey: eventKeys.all,
        queryFn: AuthService.getAllEvents,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};

export const useCreateEvent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (event: CalendarEvent) => AuthService.saveEvent(event), // Assuming saveEvent exists, need to verify
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: eventKeys.all });
            toast.success('Event created');
        },
        onError: (error: Error) => {
            toast.error(`Failed to create event: ${error.message}`);
        }
    });
};
