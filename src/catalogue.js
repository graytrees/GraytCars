// Standard jobs and checks, offered when adding to a car. Intervals are the common defaults
// (Ford Australia Mustang schedule where one exists) — always adjustable per car.
export const BASICS = ['Tyre pressures and tread', 'Engine oil level', 'Coolant level', 'Washer fluid', 'Lights and indicators', 'Wiper blades'];
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
