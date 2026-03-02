import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import NepaliDate from 'nepali-date-converter';

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
        if (!isValid(date)) return dateStr;
        return format(date, 'MMM dd, yyyy');
    } catch (e) {
        console.error("Invalid date format:", dateStr);
        return dateStr;
    }
};

// Returns start and end dates of the current month in YYYY-MM-DD format
export const getCurrentMonthRange = () => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');
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
    try {
        const start = parseISO(startDate);
        const end = parseISO(endDate);

        if (!isValid(start) || !isValid(end)) return [];

        return eachDayOfInterval({ start, end }).map(date => format(date, 'yyyy-MM-dd'));
    } catch (e) {
        console.error("Error generating date range:", e);
        return [];
    }
};

/**
 * Converts a JavaScript Date object or date string to Nepali Date (BS) string 'YYYY-MM-DD'
 */
export const toBS = (date: Date | string): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    try {
        // NepaliDate constructor accepts JS Date object
        const bsDate = new NepaliDate(d);
        return bsDate.format('YYYY-MM-DD');
    } catch (e) {
        console.error("Date conversion error used in toBS", e);
        return '';
    }
};

/**
 * Converts a Nepali Date (BS) string 'YYYY-MM-DD' to JavaScript Date object (AD)
 */
export const toAD = (bsDateStr: string): Date | null => {
    if (!bsDateStr) return null;
    try {
        const bsDate = new NepaliDate(bsDateStr);
        return bsDate.toJsDate();
    } catch (e) {
        console.error("Date conversion error used in toAD", e);
        return null;
    }
};

/**
 * Returns a formatted string with both AD and BS dates 
 * Input: 'YYYY-MM-DD' (AD)
 * Output: 'YYYY-MM-DD (BS: YYYY-MM-DD)'
 */
export const formatDualDate = (adDateStr: string): string => {
    if (!adDateStr) return '';
    const bs = toBS(adDateStr);
    return `${adDateStr} / ${bs} BS`;
};

/**
 * Returns the current fiscal year in Nepal context (approx)
 * Fiscal start: Shrawan (4th month)
 */
export const getNepaliFiscalYear = (): string => {
    const nowBS = new NepaliDate();
    const year = nowBS.getYear();
    const month = nowBS.getMonth(); // 0-11

    // If month < 3 (before Shrawan, assuming 0 index is Baisakh), fiscal year is prev/curr
    // Actually standard fiscal year change is mid-July (Shrawan 1st)
    // Month 0 = Baisakh, 1=Jestha, 2=Ashad, 3=Shrawan
    if (month < 3) {
        return `${year - 1}/${year}`;
    } else {
        return `${year}/${year + 1}`;
    }
};
