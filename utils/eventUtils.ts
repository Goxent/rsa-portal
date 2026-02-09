import { CalendarEvent, UserProfile, UserRole, EventVisibility, RecurrenceRule, EventType } from '../types';

/**
 * Event Utility Functions
 * Handles permissions, visibility, recurring events, and formatting
 */

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if a user can view a specific event based on visibility rules
 */
export const canViewEvent = (event: CalendarEvent, user: UserProfile): boolean => {
    // Handle old events without visibility field (default to PUBLIC for backwards compatibility)
    const visibility = event.visibility || 'PUBLIC';
    const createdBy = event.createdBy || 'system';

    // Public events are visible to everyone
    if (visibility === 'PUBLIC') {
        return true;
    }

    // Private events only visible to creator
    if (visibility === 'PRIVATE') {
        return createdBy === user.uid;
    }

    // Team events visible to team members
    if (visibility === 'TEAM') {
        return event.teamIds?.includes(user.uid) || createdBy === user.uid;
    }

    // Department events visible to department members
    if (visibility === 'DEPARTMENT') {
        return event.department === user.department || createdBy === user.uid;
    }

    return false;
};

/**
 * Check if a user can edit an event
 * Only creator or admin can edit
 */
export const canEditEvent = (event: CalendarEvent, user: UserProfile): boolean => {
    // Admin and Master Admin can edit any event
    if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) {
        return true;
    }

    // Creator can edit their own event (handle old events with undefined createdBy)
    const createdBy = event.createdBy || 'system';
    return createdBy === user.uid;
};

/**
 * Check if a user can delete an event
 * Only creator or admin can delete
 */
export const canDeleteEvent = (event: CalendarEvent, user: UserProfile): boolean => {
    // Same permissions as edit
    return canEditEvent(event, user);
};

/**
 * Check if a user can create events with a specific visibility level
 */
export const canCreateEventWithVisibility = (visibility: EventVisibility, user: UserProfile): boolean => {
    // Anyone can create private and team events
    if (visibility === 'PRIVATE' || visibility === 'TEAM') {
        return true;
    }

    // Only admins can create public, department, or firm events
    if (visibility === 'PUBLIC' || visibility === 'DEPARTMENT') {
        return user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;
    }

    return false;
};

// ============================================================================
// RECURRING EVENT HELPERS
// ============================================================================

/**
 * Generate instances of a recurring event within a date range
 * @param event The master recurring event
 * @param startDate Start of date range
 * @param endDate End of date range
 * @returns Array of event instances
 */
export const generateRecurringInstances = (
    event: CalendarEvent,
    startDate: Date,
    endDate: Date
): CalendarEvent[] => {
    if (!event.isRecurring || !event.recurrenceRule) {
        return [event];
    }

    const instances: CalendarEvent[] = [];
    const rule = event.recurrenceRule;
    const eventDate = new Date(event.date);

    // Start from the event's date
    let currentDate = new Date(eventDate);

    // Ensure we don't go before the event start date
    if (currentDate < startDate) {
        // Fast forward to first occurrence within range
        currentDate = new Date(startDate);
    }

    // End date is either the rule's end date or the query end date, whichever is earlier
    const finalEndDate = rule.endDate
        ? new Date(Math.min(new Date(rule.endDate).getTime(), endDate.getTime()))
        : endDate;

    let iterationCount = 0;
    const MAX_ITERATIONS = 1000; // Safety limit

    while (currentDate <= finalEndDate && iterationCount < MAX_ITERATIONS) {
        // Check if this date matches the recurrence pattern
        if (shouldIncludeDate(currentDate, eventDate, rule)) {
            // Create an instance for this date
            const instanceDate = currentDate.toISOString().split('T')[0];
            instances.push({
                ...event,
                id: `${event.id}_${instanceDate}`, // Unique ID for instance
                date: instanceDate,
                parentEventId: event.id, // Reference to master event
            });
        }

        // Move to next potential date
        currentDate = getNextDate(currentDate, rule);
        iterationCount++;
    }

    return instances;
};

/**
 * Check if a date should be included based on recurrence rule
 */
const shouldIncludeDate = (
    currentDate: Date,
    eventStartDate: Date,
    rule: RecurrenceRule
): boolean => {
    // For weekly recurrence, check if day of week matches
    if (rule.frequency === 'WEEKLY' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayOfWeek = currentDate.getDay();
        return rule.daysOfWeek.includes(dayOfWeek);
    }

    // For other frequencies, check if interval matches
    const daysDiff = Math.floor(
        (currentDate.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (rule.frequency) {
        case 'DAILY':
            return daysDiff % rule.interval === 0;
        case 'WEEKLY':
            const weeksDiff = Math.floor(daysDiff / 7);
            return weeksDiff % rule.interval === 0 && currentDate.getDay() === eventStartDate.getDay();
        case 'MONTHLY':
            // Same day of month
            return currentDate.getDate() === eventStartDate.getDate();
        case 'YEARLY':
            // Same month and day
            return (
                currentDate.getMonth() === eventStartDate.getMonth() &&
                currentDate.getDate() === eventStartDate.getDate()
            );
        default:
            return false;
    }
};

/**
 * Get the next date based on recurrence frequency
 */
const getNextDate = (currentDate: Date, rule: RecurrenceRule): Date => {
    const next = new Date(currentDate);

    switch (rule.frequency) {
        case 'DAILY':
            next.setDate(next.getDate() + rule.interval);
            break;
        case 'WEEKLY':
            next.setDate(next.getDate() + (7 * rule.interval));
            break;
        case 'MONTHLY':
            next.setMonth(next.getMonth() + rule.interval);
            break;
        case 'YEARLY':
            next.setFullYear(next.getFullYear() + rule.interval);
            break;
    }

    return next;
};

// ============================================================================
// FORMATTING & DISPLAY
// ============================================================================

/**
 * Get color for event type
 */
export const getEventColor = (eventType: EventType): string => {
    const colors: Record<EventType, string> = {
        MEETING: '#3b82f6', // Blue
        DEADLINE: '#ef4444', // Red
        GENERAL: '#8b5cf6', // Purple
        PERSONAL: '#10b981', // Green
        FIRM_EVENT: '#f59e0b', // Amber
        HOLIDAY: '#ec4899', // Pink
    };

    return colors[eventType] || '#8b5cf6';
};

/**
 * Format event time for display
 */
export const formatEventTime = (event: CalendarEvent): string => {
    if (!event.time) return 'All day';

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const startTime = formatTime(event.time);
    const endTime = event.endTime ? ` - ${formatTime(event.endTime)}` : '';

    return `${startTime}${endTime}`;
};

/**
 * Get visibility badge text
 */
export const getVisibilityBadge = (visibility: EventVisibility): { text: string; color: string } => {
    const badges: Record<EventVisibility, { text: string; color: string }> = {
        PRIVATE: { text: 'Private', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
        PUBLIC: { text: 'Public', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
        TEAM: { text: 'Team', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
        DEPARTMENT: { text: 'Department', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    };

    return badges[visibility];
};

/**
 * Check if two events overlap in time
 */
export const isEventConflict = (
    newEvent: CalendarEvent,
    existingEvents: CalendarEvent[]
): boolean => {
    if (!newEvent.time || !newEvent.endTime) return false;

    const newStart = new Date(`${newEvent.date}T${newEvent.time}`);
    const newEnd = new Date(`${newEvent.date}T${newEvent.endTime}`);

    return existingEvents.some((event) => {
        if (!event.time || !event.endTime || event.date !== newEvent.date) return false;

        const existingStart = new Date(`${event.date}T${event.time}`);
        const existingEnd = new Date(`${event.date}T${event.endTime}`);

        // Check for overlap
        return newStart < existingEnd && newEnd > existingStart;
    });
};

/**
 * Get formatted recurrence description
 */
export const getRecurrenceDescription = (rule: RecurrenceRule): string => {
    const { frequency, interval, daysOfWeek, endDate } = rule;

    let description = '';

    if (interval === 1) {
        description = frequency.toLowerCase();
    } else {
        description = `every ${interval} ${frequency.toLowerCase().slice(0, -2)}s`;
    }

    if (frequency === 'WEEKLY' && daysOfWeek && daysOfWeek.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = daysOfWeek.map((d) => dayNames[d]).join(', ');
        description += ` on ${selectedDays}`;
    }

    if (endDate) {
        description += ` until ${endDate}`;
    }

    return `Repeats ${description}`;
};

// ============================================================================
// FILTERING & SORTING
// ============================================================================

/**
 * Filter events visible to a specific user
 */
export const filterEventsForUser = (
    events: CalendarEvent[],
    user: UserProfile
): CalendarEvent[] => {
    return events.filter((event) => canViewEvent(event, user));
};

/**
 * Sort events by date and time
 */
export const sortEventsByDateTime = (events: CalendarEvent[]): CalendarEvent[] => {
    return [...events].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;

        // If same date, sort by time
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
    });
};

/**
 * Get events for a specific date
 */
export const getEventsForDate = (
    events: CalendarEvent[],
    date: string
): CalendarEvent[] => {
    return events.filter((event) => event.date === date);
};
