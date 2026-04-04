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

        // Use local date components to avoid timezone shifts from toISOString()
        const adYear = adDate.getFullYear();
        const adMonth = String(adDate.getMonth() + 1).padStart(2, '0');
        const adDay = String(adDate.getDate()).padStart(2, '0');

        return `${adYear}-${adMonth}-${adDay}`;
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

/**
 * Get the Nepali Fiscal Year for a given date
 * @param date - AD date string or Date object
 * @returns Fiscal Year string (e.g., "2080-81")
 */
export const getNepaliFiscalYear = (date: Date | string): string => {
    try {
        const adDate = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(adDate.getTime())) return '';

        const nepaliDate = new NepaliDate(adDate);
        const year = nepaliDate.getYear();
        const month = nepaliDate.getMonth() + 1; // 1-indexed

        // Nepali Fiscal Year starts on Shrawan (4th month)
        if (month >= 4) {
            return `${year}-${(year + 1) % 100}`;
        } else {
            return `${year - 1}-${year % 100}`;
        }
    } catch (error) {
        console.error('Error getting Nepali Fiscal Year:', error);
        return '';
    }
};

/**
 * Generate a list of Nepali Fiscal Years from a start year up to the current one
 * @param startYearBS - The BS year to start from (e.g., 2080)
 * @returns Array of fiscal year strings (e.g., ["2080-81", "2081-82"])
 */
export const generateFiscalYearOptions = (startYearBS: number = 2080): string[] => {
    try {
        const now = new NepaliDate();
        const currentYear = now.getYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed (Shrawan is 4)

        // Calculate the "current" fiscal year's start year
        const currentFYStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;

        const options: string[] = [];
        for (let y = startYearBS; y <= currentFYStartYear; y++) {
            const nextYearShort = (y + 1) % 100;
            options.push(`${y}-${nextYearShort.toString().padStart(2, '0')}`);
        }

        return options;
    } catch (error) {
        console.error('Error generating fiscal year options:', error);
        return ["2080-81", "2081-82"]; // Fallback
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
