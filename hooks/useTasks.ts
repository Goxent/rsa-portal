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

export const useInfiniteTasks = () => {
    return useInfiniteQuery({
        queryKey: taskKeys.all,
        queryFn: ({ pageParam }) => AuthService.getPaginatedTasks(pageParam, 30),
        getNextPageParam: (lastPage) => lastPage.lastVisible ?? undefined,
        initialPageParam: undefined as any,
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
            const previous = queryClient.getQueryData(taskKeys.all);

            queryClient.setQueryData(taskKeys.all, (old: any) => {
                if (!old) return old;
                // If it's an array (from useTasks)
                if (Array.isArray(old)) {
                    return old.map(t => (t.id === id ? { ...t, ...updates } : t));
                }
                // If it's an infinite query structure (from useInfiniteTasks)
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            tasks: page.tasks.map((t: any) => (t.id === id ? { ...t, ...updates } : t))
                        }))
                    };
                }
                return old;
            });

            return { previous };
        },

        onSuccess: (_data, { updates }) => {
            // Only show toast for non-drag updates (status-only drags are silent)
            if (Object.keys(updates).length > 1 || !updates.status) {
                toast.success('Task updated');
            }
        },

        onError: (error: Error, _variables, context: any) => {
            // Roll back to previous state on failure
            if (context?.previous) {
                queryClient.setQueryData(taskKeys.all, context.previous);
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
            const previous = queryClient.getQueryData(taskKeys.all);
            
            queryClient.setQueryData(taskKeys.all, (old: any) => {
                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map(t => t.id === id ? { ...t, status } : t);
                }
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            tasks: page.tasks.map((t: any) => t.id === id ? { ...t, status } : t)
                        }))
                    };
                }
                return old;
            });
            return { previous };
        },
        onError: (_err, _vars, context: any) => {
            if (context?.previous) queryClient.setQueryData(taskKeys.all, context.previous);
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
            const previous = queryClient.getQueryData(taskKeys.all);

            queryClient.setQueryData(taskKeys.all, (old: any) => {
                const patchTask = (t: any) => t.id === taskId
                    ? { ...t, comments: [...(t.comments || []), comment] }
                    : t;

                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map(patchTask);
                }
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            tasks: page.tasks.map(patchTask)
                        }))
                    };
                }
                return old;
            });

            return { previous };
        },

        onError: (_err, _vars, context: any) => {
            if (context?.previous) {
                queryClient.setQueryData(taskKeys.all, context.previous);
            }
            toast.error('Failed to add comment');
        },

        onSettled: (_, __, { taskId }) => {
            // Only invalidate the specific task, not all tasks
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
        },
    });
};
