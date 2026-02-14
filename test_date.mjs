import NepaliDate from 'nepali-date-converter';

try {
    // Check if default export is the class or has a default property
    const ND = NepaliDate.default || NepaliDate;

    const now = new Date();
    const np = new ND(now);
    console.log("Current Nepali:", np.format('YYYY-MM-DD'));

    // Create 1st of current month
    const year = np.getYear();
    const month = np.getMonth();
    const firstDayNp = new ND(year, month, 1);
    console.log("First Day Nepali:", firstDayNp.format('YYYY-MM-DD'));

    // Convert back to JS Date
    // Checking likely methods
    console.log("JS Date Conversion:", firstDayNp.toJsDate().toISOString().split('T')[0]);

} catch (e) {
    console.error("Error:", e);
}
