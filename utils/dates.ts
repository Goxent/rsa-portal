/**
 * Date Utility Functions
 * Standardizes date handling to avoid timezone issues.
 * All internal dates should be stored as YYYY-MM-DD strings.
 */

// Returns current date in YYYY-MM-DD format (UTC)
export const getCurrentDateUTC = (): string => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().split('T')[0];
};

// Formats a YYYY-MM-DD string for display (e.g., "Jan 01, 2024")
export const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        }).format(date);
    } catch (e) {
        console.error("Invalid date format:", dateStr);
        return dateStr;
    }
};

// Returns start and end dates of the current month in YYYY-MM-DD format
export const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];
    return { start, end };
};

// Safely parses a date string, handling fallbacks
export const parseDateSafely = (dateStr: string | undefined): string => {
    if (!dateStr) return getCurrentDateUTC();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return getCurrentDateUTC();
    return d.toISOString().split('T')[0];
};

// Get array of dates between start and end (inclusive)
export const getDatesInRange = (startDate: string, endDate: string): string[] => {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
};
