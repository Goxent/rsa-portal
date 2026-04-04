import { useQuery } from '@tanstack/react-query';
import { TemplateService } from '../services/templates';

export const templateKeys = {
    all: ['templates'] as const,
};

export const useTemplates = () => {
    return useQuery({
        queryKey: templateKeys.all,
        queryFn: () => TemplateService.getAllTemplates(),
        staleTime: 1000 * 60, // 1 minute (Ensures Task Creation sees new Resource Library templates)
    });
};
