import NepaliDate from 'nepali-date-converter';

try {
    const now = new Date();
    const np = new NepaliDate(now);
    console.log("Current Nepali:", np.format('YYYY-MM-DD'));

    // Create 1st of current month
    const year = np.getYear();
    const month = np.getMonth();
    const firstDayNp = new NepaliDate(year, month, 1);
    console.log("First Day Nepali:", firstDayNp.format('YYYY-MM-DD'));

    // Convert back to JS Date
    // Checking likely methods
    if (typeof firstDayNp.toJsDate === 'function') {
        console.log("toJsDate() exists. Result:", firstDayNp.toJsDate().toISOString().split('T')[0]);
    } else {
        console.log("toJsDate() DOES NOT exist.");
        console.log("Available keys:", Object.keys(Object.getPrototypeOf(firstDayNp)));
    }

} catch (e) {
    console.error("Error:", e);
}
