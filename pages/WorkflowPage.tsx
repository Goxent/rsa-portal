import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Edit, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Task, UserRole, TaskStatus } from '../types';
import { Workflow, WorkflowStage } from '../types/advanced';
import { WorkflowService } from '../services/advanced';
import { AuthService } from '../services/firebase';

const WorkflowPage: React.FC = () => {
    const { user } = useAuth();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isCreatingStage, setIsCreatingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState('#3b82f6');

    useEffect(() => {
        if (user) {
            loadWorkflows();
            loadTasks();
        }
    }, [user]);

    const loadWorkflows = async () => {
        const data = await WorkflowService.getWorkflows();
        setWorkflows(data);
        if (data.length > 0 && !activeWorkflow) {
            setActiveWorkflow(data[0]);
        }
    };

    const loadTasks = async () => {
        const allTasks = await AuthService.getAllTasks();
        setTasks(allTasks);
    };

    const handleCreateWorkflow = async () => {
        if (!user) return;

        const defaultStages: WorkflowStage[] = [
            { id: 'stage-1', name: 'Not Started', color: '#6b7280', order: 0 },
            { id: 'stage-2', name: 'In Progress', color: '#3b82f6', order: 1 },
            { id: 'stage-3', name: 'Review', color: '#f59e0b', order: 2 },
            { id: 'stage-4', name: 'Completed', color: '#10b981', order: 3 },
        ];

        const newWorkflow: Omit<Workflow, 'id'> = {
            name: 'Task Workflow',
            description: 'Manage task progression through stages',
            entityType: 'TASK',
            stages: defaultStages,
            rules: [],
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        };

        const id = await WorkflowService.createWorkflow(newWorkflow);
        await loadWorkflows();
    };

    const handleAddStage = async () => {
        if (!activeWorkflow || !newStageName.trim()) return;

        const newStage: WorkflowStage = {
            id: `stage-${Date.now()}`,
            name: newStageName,
            color: newStageColor,
            order: activeWorkflow.stages.length,
        };

        const updatedStages = [...activeWorkflow.stages, newStage];
        await WorkflowService.updateWorkflow(activeWorkflow.id, { stages: updatedStages });

        setNewStageName('');
        setIsCreatingStage(false);
        await loadWorkflows();
    };

    const handleDeleteStage = async (stageId: string) => {
        if (!activeWorkflow) return;
        if (!confirm('Delete this stage? Tasks in this stage will need to be reassigned.')) return;

        const updatedStages = activeWorkflow.stages
            .filter(s => s.id !== stageId)
            .map((s, i) => ({ ...s, order: i }));

        await WorkflowService.updateWorkflow(activeWorkflow.id, { stages: updatedStages });
        await loadWorkflows();
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination || !activeWorkflow) return;

        const { source, destination } = result;

        // Reordering stages
        if (result.type === 'STAGE') {
            const newStages = Array.from(activeWorkflow.stages);
            const [removed] = newStages.splice(source.index, 1);
            newStages.splice(destination.index, 0, removed);

            // Update order
            const updatedStages = newStages.map((stage, index) => ({
                ...stage,
                order: index,
            }));

            await WorkflowService.updateWorkflow(activeWorkflow.id, { stages: updatedStages });
            setActiveWorkflow({ ...activeWorkflow, stages: updatedStages });
        }

        // Moving tasks between stages
        if (result.type === 'TASK') {
            const taskId = result.draggableId;
            const destinationStageId = destination.droppableId;
            const task = tasks.find(t => t.id === taskId);

            if (task) {
                // Map stage to task status
                const stageIndex = activeWorkflow.stages.findIndex(s => s.id === destinationStageId);
                let newStatus: TaskStatus = TaskStatus.NOT_STARTED;

                if (stageIndex === 0) newStatus = TaskStatus.NOT_STARTED;
                else if (stageIndex === activeWorkflow.stages.length - 1) newStatus = TaskStatus.COMPLETED;
                else if (stageIndex === activeWorkflow.stages.length - 2) newStatus = TaskStatus.UNDER_REVIEW;
                else newStatus = TaskStatus.IN_PROGRESS;

                // Update task in Firestore
                const taskData = { ...task, status: newStatus };
                await AuthService.saveTask(taskData);
                await loadTasks();
            }
        }
    };

    const getTasksForStage = (stageId: string): Task[] => {
        if (!activeWorkflow) return [];

        const stageIndex = activeWorkflow.stages.findIndex(s => s.id === stageId);
        if (stageIndex === -1) return [];

        // Map stage index to task status
        if (stageIndex === 0) return tasks.filter(t => t.status === 'NOT_STARTED');
        if (stageIndex === activeWorkflow.stages.length - 1) return tasks.filter(t => t.status === 'COMPLETED');
        if (stageIndex === activeWorkflow.stages.length - 2) return tasks.filter(t => t.status === 'UNDER_REVIEW');
        return tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'HALTED');
    };

    const getPriorityColor = (priority: string) => {
        const colors = {
            HIGH: 'text-red-400 bg-red-500/20 border-red-500/30',
            MEDIUM: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
            LOW: 'text-green-400 bg-green-500/20 border-green-500/30',
        };
        return colors[priority as keyof typeof colors] || colors.MEDIUM;
    };

    if (!activeWorkflow && workflows.length === 0) {
        return (
            <div className="space-y-6">
                <div className="glass-panel p-12 rounded-xl text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Create Your First Workflow</h2>
                    <p className="text-gray-400 mb-6">Organize tasks into visual stages with drag-and-drop</p>
                    <button
                        onClick={handleCreateWorkflow}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-medium"
                    >
                        <Plus className="inline mr-2" size={20} /> Create Workflow
                    </button>
                </div>
            </div>
        );
    }

    if (!activeWorkflow) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white">{activeWorkflow.name}</h1>
                    <p className="text-sm text-gray-400">{activeWorkflow.description}</p>
                </div>
                <button
                    onClick={() => setIsCreatingStage(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 flex items-center"
                >
                    <Plus size={16} className="mr-2" /> Add Stage
                </button>
            </div>

            {/* Add Stage Modal */}
            {isCreatingStage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="glass-modal rounded-2xl w-full max-w-md border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between">
                            <h3 className="text-lg font-bold text-white">New Stage</h3>
                            <button onClick={() => setIsCreatingStage(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Stage Name</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg px-3 py-2"
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    placeholder="e.g. In Review"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
                                <input
                                    type="color"
                                    className="w-full h-10 rounded-lg"
                                    value={newStageColor}
                                    onChange={(e) => setNewStageColor(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleAddStage}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold"
                            >
                                Add Stage
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages" type="STAGE" direction="horizontal">
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]"
                        >
                            {activeWorkflow.stages.map((stage, index) => (
                                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex-shrink-0 w-80 glass-panel rounded-xl ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : ''
                                                }`}
                                        >
                                            {/* Stage Header */}
                                            <div
                                                className="px-4 py-3 border-b border-white/10 flex items-center justify-between"
                                                style={{ backgroundColor: `${stage.color}20` }}
                                            >
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div
                                                        {...provided.dragHandleProps}
                                                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white"
                                                    >
                                                        <GripVertical size={18} />
                                                    </div>
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: stage.color }}
                                                    />
                                                    <h3 className="font-bold text-white">{stage.name}</h3>
                                                    <span className="text-xs text-gray-500">
                                                        {getTasksForStage(stage.id).length}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteStage(stage.id)}
                                                    className="text-gray-500 hover:text-red-400"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Tasks Droppable */}
                                            <Droppable droppableId={stage.id} type="TASK">
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={`p-3 space-y-2 min-h-[400px] ${snapshot.isDraggingOver ? 'bg-blue-500/10' : ''
                                                            }`}
                                                    >
                                                        {getTasksForStage(stage.id).map((task, taskIndex) => (
                                                            <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={`glass-panel p-3 rounded-lg cursor-move hover:bg-white/10 transition-all ${snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-400' : ''
                                                                            }`}
                                                                    >
                                                                        <h4 className="font-medium text-white text-sm mb-2">{task.title}</h4>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                                                                {task.priority}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500">
                                                                                {new Date(task.dueDate).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                        {getTasksForStage(stage.id).length === 0 && (
                                                            <div className="text-center text-gray-600 text-sm py-8">
                                                                No tasks
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
};

export default WorkflowPage;
