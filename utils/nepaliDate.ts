// Nepali Date Utilities - BS/AD Conversion
import NepaliDate from 'nepali-date-converter';

/**
 * Convert AD date to BS date string
 * @param adDate - Date object or string in AD format
 * @param format - Output format (default: 'YYYY-MM-DD')
 * @returns BS date string
 */
export const convertADToBS = (adDate: Date | string, format: string = 'YYYY-MM-DD'): string => {
    try {
        const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
        if (isNaN(date.getTime())) return '';

        const nepaliDate = new NepaliDate(date);
        return nepaliDate.format(format);
    } catch (error) {
        console.error('Error converting AD to BS:', error);
        return '';
    }
};

/**
 * Convert BS date to AD date string
 * @param bsDate - BS date string (YYYY-MM-DD format)
 * @param format - Output format (default: 'YYYY-MM-DD')
 * @returns AD date string
 */
export const convertBSToAD = (bsDate: string): string => {
    try {
        const [year, month, day] = bsDate.split('-').map(Number);
        if (!year || !month || !day) return '';

        const nepaliDate = new NepaliDate(year, month - 1, day);
        const adDate = nepaliDate.toJsDate();
        return adDate.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error converting BS to AD:', error);
        return '';
    }
};

/**
 * Get current BS date
 * @param format - Output format (default: 'YYYY-MM-DD')
 * @returns Current BS date string
 */
export const getCurrentBSDate = (format: string = 'YYYY-MM-DD'): string => {
    const nepaliDate = new NepaliDate();
    return nepaliDate.format(format);
};

/**
 * Get current BS date in Nepali format (e.g., "२०८२-१०-२५")
 */
export const getCurrentBSDateNepali = (): string => {
    const nepaliDate = new NepaliDate();
    return nepaliDate.format('YYYY-MM-DD', 'np');
};

/**
 * Format BS date for display
 * @param bsDate - BS date string (YYYY-MM-DD)
 * @returns Formatted string like "25 Magh 2082"
 */
export const formatBSDate = (bsDate: string): string => {
    try {
        const [year, month, day] = bsDate.split('-').map(Number);
        if (!year || !month || !day) return bsDate;

        const nepaliDate = new NepaliDate(year, month - 1, day);
        return nepaliDate.format('DD MMMM YYYY');
    } catch (error) {
        return bsDate;
    }
};

/**
 * Format AD date as BS for display with both formats
 * @param adDate - AD date string or Date object
 * @returns Object with both BS and AD formatted strings
 */
export const formatDateDual = (adDate: Date | string): { bs: string; ad: string; bsFull: string } => {
    try {
        const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
        if (isNaN(date.getTime())) return { bs: '', ad: '', bsFull: '' };

        const nepaliDate = new NepaliDate(date);
        return {
            bs: nepaliDate.format('YYYY-MM-DD'),
            ad: date.toISOString().split('T')[0],
            bsFull: nepaliDate.format('DD MMMM YYYY')
        };
    } catch (error) {
        return { bs: '', ad: '', bsFull: '' };
    }
};

// Nepali month names
export const nepaliMonths = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Nepali month names in Nepali script
export const nepaliMonthsNepali = [
    'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भदौ', 'असोज',
    'कार्तिक', 'मङ्सिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];
