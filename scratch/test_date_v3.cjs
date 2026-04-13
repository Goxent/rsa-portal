const NepaliDate = require('nepali-date-converter');

// In case it's an ESM export wrapped in CJS
const ND = (typeof NepaliDate === 'function') ? NepaliDate : NepaliDate.default;

const npNow = new ND();
console.log('Today (BS):', npNow.format('YYYY-MM-DD'));
console.log('To JS Date:', npNow.toJsDate().toISOString());
console.log('Current Year:', npNow.getYear());
console.log('Current Month (Getter):', npNow.getMonth());
console.log('Current Date (Getter):', npNow.getDate());

const year = npNow.getYear();
const month = npNow.getMonth();

console.log(`\nTesting: new ND(${year}, ${month}, 1)`);
const test1 = new ND(year, month, 1);
console.log('Result 1 BS:', test1.format('YYYY-MM-DD'));
console.log('Result 1 AD:', test1.toJsDate().toISOString());

console.log(`\nTesting: new ND(${year}, ${month + 1}, 1)`);
const test2 = new ND(year, month + 1, 1);
console.log('Result 2 BS:', test2.format('YYYY-MM-DD'));
console.log('Result 2 AD:', test2.toJsDate().toISOString());
