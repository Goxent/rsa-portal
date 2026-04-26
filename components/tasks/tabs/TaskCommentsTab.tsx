import React from 'react';
import { TaskComment, UserProfile } from '../../../types';
import TaskComments from '../../TaskComments';

export interface TaskCommentsTabProps {
    comments?: TaskComment[];
    users: UserProfile[];
    onAddComment: (comment: TaskComment) => void;
}

const TaskCommentsTab: React.FC<TaskCommentsTabProps> = ({ comments, users, onAddComment }) => {
    return (
        <div className="flex-1 overflow-hidden flex flex-col p-2">
            <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col bg-[#0c1218]/40 border border-white/5 rounded-[32px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                <div className="flex-1 overflow-hidden p-4 md:p-6">
                    <TaskComments 
                        comments={comments} 
                        users={users} 
                        onAddComment={onAddComment} 
                    />
                </div>
            </div>
        </div>
    );
};

export default TaskCommentsTab;
