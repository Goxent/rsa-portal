const NepaliDate = require('nepali-date-converter');

const npNow = new NepaliDate();
console.log('Current Date:', npNow.format('YYYY-MM-DD'));
console.log('Current Year:', npNow.getYear());
console.log('Current Month (0-indexed):', npNow.getMonth());
console.log('Current Day:', npNow.getDate());

const npFirstDay = new NepaliDate(npNow.getYear(), npNow.getMonth(), 1);
console.log('First Day of Month:', npFirstDay.format('YYYY-MM-DD'));
console.log('First Day AD:', npFirstDay.toJsDate().toISOString().split('T')[0]);
