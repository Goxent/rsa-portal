import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { Client } from '../types';
import { toast } from 'react-hot-toast';

export const clientKeys = {
    all: ['clients'] as const,
};

export const useClients = () => {
    return useQuery({
        queryKey: clientKeys.all,
        queryFn: AuthService.getAllClients,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
};

export const useAddClient = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (client: Client) => AuthService.addClient(client),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
            toast.success('Client added successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to add client: ${error.message}`);
        }
    });
};

export const useUpdateClient = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (client: Client) => AuthService.updateClient(client),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
            toast.success('Client updated successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update client: ${error.message}`);
        }
    });
};

export const useDeleteClient = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => AuthService.deleteClient(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
            toast.success('Client deleted');
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete client: ${error.message}`);
        }
    });
};
