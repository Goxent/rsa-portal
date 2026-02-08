import React from 'react';
import StaffProductivityMetrics from '../components/analytics/StaffProductivityMetrics';

const AnalyticsPage: React.FC = () => {
    return (
        <div className="space-y-6">
            <StaffProductivityMetrics />
        </div>
    );
};

export default AnalyticsPage;
