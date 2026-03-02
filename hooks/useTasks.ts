import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { Task, TaskStatus } from '../types';
import { toast } from 'react-hot-toast';

// Keys
export const taskKeys = {
    all: ['tasks'] as const,
    lists: () => [...taskKeys.all, 'list'] as const,
    list: (filters: string) => [...taskKeys.lists(), { filters }] as const,
    details: () => [...taskKeys.all, 'detail'] as const,
    detail: (id: string) => [...taskKeys.details(), id] as const,
};

// --- QUERIES ---

export const useTasks = () => {
    return useQuery({
        queryKey: taskKeys.all,
        queryFn: AuthService.getAllTasks,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// --- MUTATIONS ---

export const useCreateTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newTask: Task) => AuthService.saveTask(newTask),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            toast.success('Task created successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to create task: ${error.message}`);
        }
    });
};

export const useUpdateTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
            AuthService.updateTask(id, updates),

        // ── Optimistic update: patch local cache immediately ─────────────────
        onMutate: async ({ id, updates }) => {
            // Cancel any in-flight refetches so they don't overwrite our optimistic data
            await queryClient.cancelQueries({ queryKey: taskKeys.all });

            // Snapshot previous value for rollback
            const previous = queryClient.getQueryData<Task[]>(taskKeys.all);

            // Optimistically patch the task in the cache
            queryClient.setQueryData<Task[]>(taskKeys.all, (old = []) =>
                old.map(t => (t.id === id ? { ...t, ...updates } : t))
            );

            return { previous };
        },

        onSuccess: (_data, { updates }) => {
            // Only show toast for non-drag updates (status-only drags are silent)
            if (Object.keys(updates).length > 1 || !updates.status) {
                toast.success('Task updated');
            }
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },

        onError: (error: Error, _variables, context: any) => {
            // Roll back to previous state on failure
            if (context?.previous) {
                queryClient.setQueryData(taskKeys.all, context.previous);
            }
            toast.error(`Failed to update task: ${error.message}`);
        },
    });
};

export const useDeleteTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskId: string) => AuthService.deleteTask(taskId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            toast.success('Task deleted');
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete task: ${error.message}`);
        }
    });
};

export const useAddTaskComment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, comment }: { taskId: string; comment: any }) => AuthService.addTaskComment(taskId, comment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            toast.success('Comment added');
        },
        onError: (error: Error) => {
            toast.error(`Failed to add comment: ${error.message}`);
        }
    });
};
