// Standard jobs and checks, offered when adding to a car. Intervals are the common defaults
// (Ford Australia Mustang schedule where one exists) — always adjustable per car.
export const BASICS = ['Tyre pressures', 'Engine oil level', 'Brake fluid level', 'Coolant level', 'Air filter (visual check)'];
export const basicsItem = carId => ({ id: carId.replace('c-', 'i-') + '-monthly-basics', carId, name: 'Monthly basics', kind: 'check', everyMonths: 1, everyKm: null, includes: [], checklist: BASICS, source: 'GraytCars' });

// fuel: which cars it suits ('any' | 'petrol' | 'diesel')
export const SUGGESTIONS = [
  { name: 'Wiper blades', kind: 'job', everyMonths: 12, fuel: 'any' },
  { name: 'Cabin filter', kind: 'job', everyKm: 30000, everyMonths: 24, fuel: 'any' },
  { name: 'Air filter', kind: 'job', everyKm: 45000, everyMonths: 36, fuel: 'any' },
  { name: 'Brake fluid', kind: 'job', everyMonths: 24, fuel: 'any' },
  { name: 'Empty catch can', kind: 'job', everyKm: 5000, fuel: 'any' },
  { name: 'Battery', kind: 'check', everyMonths: 12, fuel: 'any' },
  { name: 'Brake pads and rotors', kind: 'check', everyKm: 15000, everyMonths: 12, fuel: 'any' },
  { name: 'Tyre rotation', kind: 'job', everyKm: 10000, fuel: 'any' },
  { name: 'Wheel alignment', kind: 'check', everyMonths: 12, fuel: 'any' },
  { name: 'Drive belt', kind: 'check', everyKm: 15000, everyMonths: 12, fuel: 'any' },
  { name: 'Coolant change', kind: 'job', everyMonths: 60, fuel: 'any' },
  { name: 'Spark plugs', kind: 'job', everyKm: 150000, fuel: 'petrol' },
  { name: 'Transmission fluid', kind: 'job', everyKm: 150000, fuel: 'any' },
  { name: 'Diesel fuel filter', kind: 'job', fuel: 'diesel' },
];

/* ---------- paint care (shown under "Wash") ---------- */
export const careItems = car => {
  const id = n => car.id.replace('c-', 'i-') + '-' + n;
  const base = [{ id: id('wash'), name: 'Wash', kind: 'job', group: 'care', trackPart: true, everyKm: null, everyMonths: null }];
  if (car.id === 'c-mustang') return [...base,
    { id: id('coating-topup'), name: 'Coating top-up', kind: 'job', group: 'care', trackPart: true, everyMonths: 3, notes: 'Gyeon Cure over the Gtechniq ceramic coating' },
    { id: id('ceramic-detailer'), name: 'Ceramic detailer', kind: 'job', group: 'care', trackPart: true, notes: 'Gyeon Ceramic Detailer' }];
  if (car.id === 'c-everest') return [...base,
    { id: id('ppf-topup'), name: 'PPF top-up', kind: 'job', group: 'care', trackPart: true, everyMonths: 3, notes: 'Sealant / ceramic spray over the paint protection film' },
    { id: id('ppf-check'), name: 'PPF check', kind: 'check', group: 'care', everyMonths: 6, checklist: ['Edges lifting', 'Stone chips or tears', 'Yellowing or haze'] }];
  return base;
};

/* ---------- mods ---------- */
export const MOD_CATS = ['Exterior', 'Protection', 'Wheels & tyres', 'Suspension', 'Engine & performance', 'Lighting', 'Touring & recovery', 'Electrical', 'Interior'];
// quick-adds from Nathan's own notes and photos (dates left for him to fill in)
export const MOD_HINTS = {
  'c-mustang': [
    { name: 'GT500-style bonnet with heat extractor vent', category: 'Exterior' },
    { name: 'Suspension lifted 15 mm', category: 'Suspension', date: '2024-05-17', odo: 23111, installer: 'Brendale Auto' },
    { name: 'Gtechniq ceramic coating (9-year)', category: 'Protection' },
    { name: 'Aftermarket front splitter', category: 'Exterior' },
    { name: 'Black alloy wheels', category: 'Wheels & tyres' },
  ],
  'c-everest': [
    { name: 'Paint protection film (PPF)', category: 'Protection' },
    { name: 'Bull bar with LED light bar', category: 'Exterior' },
    { name: 'Snorkel', category: 'Engine & performance' },
    { name: 'Roof racks', category: 'Touring & recovery' },
    { name: 'OCAM awning', category: 'Touring & recovery' },
    { name: 'Bronze alloy wheels', category: 'Wheels & tyres' },
    { name: 'Yokohama Geolandar A/T tyres', category: 'Wheels & tyres' },
    { name: 'Side steps', category: 'Exterior' },
    { name: 'UHF radio and aerial', category: 'Electrical' },
    { name: 'Recovery points', category: 'Touring & recovery' },
  ],
};

/* ---------- trips ---------- */
export const TRIP_TYPES = { beach: 'Beach', '4wd': '4WD', towing: 'Towing', track: 'Track day', road: 'Road trip' };
export const tagForTrip = t => ({ beach: 'offroad', '4wd': 'offroad', towing: 'towing', track: 'track' }[t] || '');
export const FILL_TAGS = { '': 'Normal', towing: 'Towing', offroad: '4WD / beach', track: 'Track day' };
const COMMON_PRE = ['Monthly basics done', 'Spare tyre pressure, jack and wheel brace', 'First aid kit'];
export const TRIP_LISTS = {
  beach: { pre: ['Tyre deflator and compressor packed', 'Recovery gear: snatch strap, shackles, boards', 'Beach vehicle permit (if needed)', 'Tide times checked', 'UHF radio working', 'Awning and roof load secured', ...COMMON_PRE],
    post: ['Tyres back to road pressure', 'Rinse underbody and wheel arches (salt)', 'Check air filter and snorkel', 'Listen for sand in the brakes', 'Check tyres for cuts'] },
  '4wd': { pre: ['Recovery gear: snatch strap, shackles, boards', 'Tyre deflator and compressor packed', 'UHF radio working', 'Awning and roof load secured', 'Underbody protection checked', ...COMMON_PRE],
    post: ['Tyres back to road pressure', 'Wash underbody (mud)', 'Check underbody for damage', 'Check tyres for cuts', 'Check air filter'] },
  towing: { pre: ['Tow bar, ball and pin secure', 'Safety chains and shackles', 'Trailer lights and brakes working', 'Tyre pressures for load', 'Mirrors set', ...COMMON_PRE],
    post: ['Check tow bar and hitch for wear'] },
  track: { pre: ['Brake fluid and pads checked', 'Tyre pressures set', 'Wheel nuts torqued', 'Loose items out of the cabin', 'Helmet'],
    post: ['Oil change (Ford advises after every track weekend)', 'Check brakes and pads', 'Check tyre wear', 'Wheel nuts re-torqued'] },
  road: { pre: ['Tyre pressures for load', ...COMMON_PRE], post: [] },
};
export const TRIP_WORDS = /camp|beach|4wd|4x4|trip|getaway|holiday|track day|tow|caravan|k'?gari|fraser|rainbow|moreton|straddie|stradbroke|bribie|double island|jindabyne|road trip|away/i;

/* ---------- workshops (from Nathan's history; phone numbers from Google Maps, Oct 2026) ---------- */
export const WORKSHOPS = [
  { id: 'w-byrne', name: 'Byrne Ford Geebung', aka: ['byrne ford'], phone: '07 3248 3333', address: '501 Bilsen Rd, Geebung QLD 4034', notes: 'Ford service' },
  { id: 'w-brendale', name: 'Brendale Automotive', aka: ['brendale auto'], phone: '07 3448 0448', address: '266 Leitchs Rd, Brendale QLD 4500', notes: 'Repco Authorised Car Service. Matched from "Brendale Auto" in your history – check it’s the right one.' },
  { id: 'w-tyrepower', name: 'Tyrepower North Lakes', aka: ['tyrepower'], phone: '07 3153 4136', address: '105 Flinders Parade, North Lakes QLD 4509', notes: 'Tyres, rotations, alignments' },
  { id: 'w-jefferson', name: 'Jefferson Ford Parts', aka: ['jefferson ford'], phone: '1300 881 234', address: 'Online – Mentone VIC', notes: 'Genuine Ford parts by post' },
];
