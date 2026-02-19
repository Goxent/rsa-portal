import { useQuery } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';

export const userKeys = {
    all: ['users'] as const,
};

export const useUsers = () => {
    return useQuery({
        queryKey: userKeys.all,
        queryFn: AuthService.getAllUsers,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};
