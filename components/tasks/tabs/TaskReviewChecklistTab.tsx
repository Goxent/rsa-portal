import React from 'react';

export interface TaskReviewChecklistTabProps {
    renderReviewerChecklist: () => React.ReactNode;
}

const TaskReviewChecklistTab: React.FC<TaskReviewChecklistTabProps> = ({
    renderReviewerChecklist
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-black/20">
            <div className="max-w-[1600px] w-full mx-auto pb-32">
                {renderReviewerChecklist()}
            </div>
        </div>
    );
};

export default TaskReviewChecklistTab;
