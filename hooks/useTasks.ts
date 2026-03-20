import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { AuthService } from '../services/firebase';
import { Task, TaskStatus } from '../types';
import { toast } from 'react-hot-toast';

// Keys
export const taskKeys = {
    all: ['tasks'] as const,
    infinite: () => [...taskKeys.all, 'infinite'] as const,
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

export const useInfiniteTasks = () => {
    return useInfiniteQuery({
        queryKey: taskKeys.infinite(),
        queryFn: ({ pageParam }) => AuthService.getPaginatedTasks(pageParam, 30),
        getNextPageParam: (lastPage) => lastPage.lastVisible ?? null,
        initialPageParam: null,
    });
};

// --- MUTATIONS ---

export const useCreateTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (newTask: Task) => AuthService.saveTask(newTask, true),
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
            await queryClient.cancelQueries({ queryKey: taskKeys.all });
            
            const previousAll = queryClient.getQueryData(taskKeys.all);
            const previousInfinite = queryClient.getQueryData(taskKeys.infinite());

            queryClient.setQueryData(taskKeys.all, (old: any) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map(t => (t.id === id ? { ...t, ...updates } : t));
            });
            
            queryClient.setQueryData(taskKeys.infinite(), (old: any) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        tasks: page.tasks.map((t: any) => (t.id === id ? { ...t, ...updates } : t))
                    }))
                };
            });

            return { previousAll, previousInfinite };
        },

        onSuccess: (_data, { updates }) => {
            // Only show toast for non-drag updates (status-only drags are silent)
            if (Object.keys(updates).length > 1 || !updates.status) {
                toast.success('Task updated');
            }
        },

        onError: (error: Error, _variables, context: any) => {
            // Roll back to previous state on failure
            if (context?.previousAll !== undefined) {
                queryClient.setQueryData(taskKeys.all, context.previousAll);
            }
            if (context?.previousInfinite !== undefined) {
                queryClient.setQueryData(taskKeys.infinite(), context.previousInfinite);
            }
            toast.error(`Failed to update task: ${error.message}`);
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
};

export const useUpdateTaskStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
            AuthService.updateTaskStatusOnly(id, status),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: taskKeys.all });
            
            const previousAll = queryClient.getQueryData(taskKeys.all);
            const previousInfinite = queryClient.getQueryData(taskKeys.infinite());
            
            queryClient.setQueryData(taskKeys.all, (old: any) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map(t => t.id === id ? { ...t, status } : t);
            });
            
            queryClient.setQueryData(taskKeys.infinite(), (old: any) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        tasks: page.tasks.map((t: any) => t.id === id ? { ...t, status } : t)
                    }))
                };
            });

            return { previousAll, previousInfinite };
        },
        onError: (_err, _vars, context: any) => {
            if (context?.previousAll !== undefined) queryClient.setQueryData(taskKeys.all, context.previousAll);
            if (context?.previousInfinite !== undefined) queryClient.setQueryData(taskKeys.infinite(), context.previousInfinite);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
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
        mutationFn: ({ taskId, comment }: { taskId: string; comment: any }) =>
            AuthService.addTaskComment(taskId, comment),

        onMutate: async ({ taskId, comment }) => {
            await queryClient.cancelQueries({ queryKey: taskKeys.all });
            
            const previousAll = queryClient.getQueryData(taskKeys.all);
            const previousInfinite = queryClient.getQueryData(taskKeys.infinite());

            const patchTask = (t: any) => t.id === taskId
                ? { ...t, comments: [...(t.comments || []), comment] }
                : t;

            queryClient.setQueryData(taskKeys.all, (old: any) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map(patchTask);
            });
            
            queryClient.setQueryData(taskKeys.infinite(), (old: any) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        tasks: page.tasks.map(patchTask)
                    }))
                };
            });

            return { previousAll, previousInfinite };
        },

        onError: (_err, _vars, context: any) => {
            if (context?.previousAll !== undefined) {
                queryClient.setQueryData(taskKeys.all, context.previousAll);
            }
            if (context?.previousInfinite !== undefined) {
                queryClient.setQueryData(taskKeys.infinite(), context.previousInfinite);
            }
            toast.error('Failed to add comment');
        },

        onSettled: (_, __, { taskId }) => {
            // Only invalidate the specific task, not all tasks
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
        },
    });
};
