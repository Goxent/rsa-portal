const NepaliDate = require('nepali-date-converter');

const npNow = new NepaliDate();
console.log('Current Date Formatted:', npNow.format('YYYY-MM-DD'));
console.log('Current Year:', npNow.getYear());
console.log('Current Month (0-indexed):', npNow.getMonth());
console.log('Current Day:', npNow.getDate());

// Testing the constructor
const year = npNow.getYear();
const month = npNow.getMonth();
const day = 1;

const npFirstDay = new NepaliDate(year, month, day);
console.log(`Creating NepaliDate(${year}, ${month}, ${day})`);
console.log('Resulting BS Date:', npFirstDay.format('YYYY-MM-DD'));
console.log('Resulting BS Month Name:', npFirstDay.format('MMMM'));
console.log('First Day AD:', npFirstDay.toJsDate().toISOString().split('T')[0]);
