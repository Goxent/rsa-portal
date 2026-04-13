const NepaliDate = require('nepali-date-converter');
const ND = (typeof NepaliDate === 'function') ? NepaliDate : NepaliDate.default;

const npNow = new ND();
console.log('Today (BS):', npNow.format('YYYY-MM-DD'));

const npFirstDay = new ND(npNow.getYear(), npNow.getMonth(), 1);
const jsDate = npFirstDay.toJsDate();

console.log('UTC ISO String:', jsDate.toISOString());
console.log('Manual Local String:', `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`);

// Let's also check if adding some hours helps (not recommended but for science)
const safeDate = new Date(jsDate.getTime() + (6 * 60 * 60 * 1000));
console.log('Safe UTC String:', safeDate.toISOString().split('T')[0]);
