const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'TasksPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Imports
if (!code.includes("import { debounce }")) {
    code = code.replace(
        "import { useMedia, useIntersection } from 'react-use';",
        "import { useMedia, useIntersection } from 'react-use';\nimport { debounce } from 'lodash';"
    );
}
// Import SkeletonCard
if (!code.includes("SkeletonCard")) {
    code = code.replace(
        "import TaskTimelineView from '../components/tasks/TaskTimelineView';",
        "import TaskTimelineView from '../components/tasks/TaskTimelineView';\nimport { SkeletonCard } from '../components/common/SkeletonCard';"
    );
}

// 2. Fetching & State
code = code.replace(
    "    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: tasksLoading } = useInfiniteTasks();\n    const tasks = data?.pages.flatMap(page => page.tasks) ?? [];",
    `    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        setTasksLoading(true);
        setIsLive(false);
        const unsubscribe = AuthService.subscribeToTasks(
            (liveTasks) => {
                setTasks(liveTasks);
                setTasksLoading(false);
                setIsLive(true);
            },
            (err) => {
                toast.error('Real-time sync failed. ' + err.message);
                setIsLive(false);
            }
        );
        return () => unsubscribe();
    }, []);`
);

// 3. Filters to URL Params
code = code.replace(
    /const \[filterPriority, setFilterPriority\] = useState.*?;([\s\S]*?)const \[filterTaskType, setFilterTaskType\] = useState.*?;/m,
    `    const [filterPriority, setFilterPriority] = useState<string>(() => searchParams.get('priority') || localStorage.getItem('rsa_filter_priority') || 'ALL');
    const [filterStatus, setFilterStatus] = useState<string>(() => searchParams.get('status') || localStorage.getItem('rsa_filter_status') || 'ALL');
    const [filterClient, setFilterClient] = useState<string>(() => searchParams.get('client') || localStorage.getItem('rsa_filter_client') || 'ALL');
    const [groupBy, setGroupBy] = useState<'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE'>(() => (searchParams.get('groupby') as any) || (localStorage.getItem('rsa_filter_groupby') as any) || 'NONE');
    
    // Search is handled separately for debouncing
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    
    const [filterStaff, setFilterStaff] = useState<string>(() => searchParams.get('staff') || localStorage.getItem('rsa_filter_staff') || 'ALL');
    const [filterAuditor, setFilterAuditor] = useState<string>(() => searchParams.get('auditor') || localStorage.getItem('rsa_filter_auditor') || 'ALL');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [filterTaskType, setFilterTaskType] = useState<TaskType | 'ALL'>(() => (searchParams.get('type') as any) || (localStorage.getItem('rsa_filter_tasktype') as any) || 'ALL');
    
    // View mode from URL
    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN' | 'TIMELINE'>(() => (searchParams.get('view') as any) || (isMobile ? 'LIST' : 'KANBAN'));

    // Synchronize to URL Params
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        if (filterPriority !== 'ALL') params.set('priority', filterPriority); else params.delete('priority');
        if (filterStatus !== 'ALL') params.set('status', filterStatus); else params.delete('status');
        if (filterClient !== 'ALL') params.set('client', filterClient); else params.delete('client');
        if (groupBy !== 'NONE') params.set('groupby', groupBy); else params.delete('groupby');
        if (filterStaff !== 'ALL') params.set('staff', filterStaff); else params.delete('staff');
        if (filterAuditor !== 'ALL') params.set('auditor', filterAuditor); else params.delete('auditor');
        if (filterTaskType !== 'ALL') params.set('type', filterTaskType); else params.delete('type');
        if (viewMode) params.set('view', viewMode);
        
        setSearchParams(params, { replace: true });
    }, [filterPriority, filterStatus, filterClient, groupBy, filterStaff, filterAuditor, filterTaskType, viewMode]);

    // Debounced Search Sync
    const debouncedSearchSync = useCallback(
        debounce((q: string) => {
            setSearchParams(prev => {
                const params = new URLSearchParams(prev);
                if (q) params.set('q', q); else params.delete('q');
                return params;
            }, { replace: true });
        }, 300),
        []
    );

    useEffect(() => {
        debouncedSearchSync(searchTerm);
    }, [searchTerm, debouncedSearchSync]);`
);

// 4. Update the viewMode definition if it was outside
code = code.replace(
    /const \[viewMode, setViewMode\] = useState<'LIST' \| 'KANBAN' \| 'TIMELINE'>\(isMobile \? 'LIST' : 'KANBAN'\);/g,
    ""
);

// 5. Update Clear Filters
code = code.replace(
    /setFilterStatus\('ALL'\);([\s\S]*?)setDateRange\(\{ start: '', end: '' \}\);/m,
    `setFilterStatus('ALL');
            setFilterPriority('ALL');
            setFilterTaskType('ALL');
            setFilterClient('ALL');
            setFilterStaff('ALL');
            setFilterAuditor('ALL');
            setSearchTerm('');
            setDateRange({ start: '', end: '' });
            setSearchParams(new URLSearchParams(), { replace: true });`
);

// 6. Fix infinite scroll intersection logic
code = code.replace(
    /if \(intersection\?\.isIntersecting && hasNextPage && !isFetchingNextPage\) \{[\s\S]*?\}/m,
    `// Infinite scroll removed for real-time sync`
);

fs.writeFileSync(filePath, code);
console.log("TasksPage.tsx updated successfully.");
