import NepaliDate from 'nepali-date-converter';

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
