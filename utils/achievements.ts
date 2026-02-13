import { Achievement } from '../types';

export const ACHIEVEMENT_REGISTRY: Achievement[] = [
    {
        id: 'early_bird',
        name: 'The Early Bird',
        description: 'Clock-in before 9 AM for 10 straight days',
        points: 100,
        rarity: 'COMMON',
        icon: 'Star'
    },
    {
        id: 'task_ninja',
        name: 'Task Ninja',
        description: 'Complete 20 tasks within a single week',
        points: 250,
        rarity: 'RARE',
        icon: 'Zap'
    },
    {
        id: 'quality_king',
        name: 'Quality King',
        description: 'Maintain quality score above 90% for a month',
        points: 500,
        rarity: 'EPIC',
        icon: 'Trophy'
    },
    {
        id: 'perfect_month',
        name: 'Perfect Month',
        description: 'Achieve 100% completion & punctuality',
        points: 1000,
        rarity: 'LEGENDARY',
        icon: 'Award'
    },
    {
        id: 'team_player',
        name: 'Ultimate Team Player',
        description: 'Receive 5+ positive peer reviews in a month',
        points: 300,
        rarity: 'RARE',
        icon: 'Users'
    }
];

export const getAchievementById = (id: string) => ACHIEVEMENT_REGISTRY.find(a => a.id === id);
