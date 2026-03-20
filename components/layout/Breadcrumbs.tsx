import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap: Record<string, string> = {
    dashboard: 'Dashboard',
    tasks: 'Task Management',
    calendar: 'Calendar',
    attendance: 'Attendance',
    leaves: 'Leave Requests',
    compliance: 'Compliance',
    clients: 'Clients',
    workload: 'Resource Planning',
    staff: 'Staff Directory',
    performance: 'Performance Evaluation',
    settings: 'System Settings',
    templates: 'Templates',
    'knowledge-base': 'Knowledge Base',
    'my-performance': 'My Performance',
    'peer-reviews': 'Peer Reviews',
    'verify-email': 'Verify Email',
    'setup-profile': 'Profile Setup'
};

const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    // Don't show on Dashboard (it's root-like)
    if (pathnames.length === 0 || pathnames[0] === 'dashboard') {
        return (
            <div className="flex items-center text-gray-500 text-sm">
                <Home size={14} className="mr-2" />
                <span className="font-medium text-white">Dashboard</span>
            </div>
        );
    }

    return (
        <div className="flex items-center text-sm text-gray-500">
            <Link to="/dashboard" className="hover:text-white transition-colors flex items-center">
                <Home size={14} />
            </Link>

            {pathnames.map((value, index) => {
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const isLast = index === pathnames.length - 1;

                // Resolve readable name
                // Heuristic: If it looks like an ID (long alphanumeric), try to keep it or use "Details"
                // ideally we'd fetch the name, but for now let's just format it
                let displayName = routeNameMap[value] || value.replace(/-/g, ' ');
                displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

                // Truncate IDs visually
                if (value.length > 20) displayName = 'Details';

                return (
                    <React.Fragment key={to}>
                        <ChevronRight size={14} className="mx-2 text-gray-600" />
                        {isLast ? (
                            <span className="font-medium text-white pointer-events-none">{displayName}</span>
                        ) : (
                            <Link to={to} className="hover:text-amber-400 transition-colors">
                                {displayName}
                            </Link>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default Breadcrumbs;
