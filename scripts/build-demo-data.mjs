// Builds the numbers the clickable prototype needs, with the real engine, so the vibe scores and
// horoscopes in it are genuine results for made-up people. Run by `npm run build:demo`.
// Everyone here is fictional: first names, cities and birth details were invented for the prototype.
import { writeFileSync } from 'node:fs';
import { computeChart, dailyHoroscopesAll } from '../engine/src/index.mjs';
import { keysFromChart } from '../web/src/lib/meet.js';

const at = (date, time, latitude, longitude) => computeChart({ date, time, timezone: 'Asia/Kolkata', latitude, longitude });
const PEOPLE = [
  ['p1', 'Dev', '1995-05-03', '11:30', 21.17, 72.83],
  ['p2', 'Arjun', '1992-09-21', '06:45', 23.03, 72.58],
  ['p3', 'Ishaan', '1994-01-15', '22:10', 22.72, 75.86],
  ['p4', 'Kunal', '1997-07-08', '14:05', 18.52, 73.86],
  ['p5', 'Neil', '1996-11-27', '03:40', 12.97, 77.59],
  ['p6', 'Harman', '1997-03-30', '09:15', 30.73, 76.78],
  ['p7', 'Kabir', '1993-12-02', '17:50', 19.08, 72.88],
  ['p8', 'Mehul', '1996-08-19', '05:25', 26.91, 75.79],
];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const keys = {};
for (const [id, , date, time, lat, lng] of PEOPLE) keys[id] = keysFromChart(await at(date, time, lat, lng));
const all = await dailyHoroscopesAll(today);
const out = { builtOn: today, keys, horoscope: { vedic: all.filter((r) => r.system === 'vedic'), western: all.filter((r) => r.system === 'western') } };
writeFileSync(new URL('../web/src/demo/generated.json', import.meta.url), JSON.stringify(out));
console.log(`demo data: ${PEOPLE.length} people, horoscope for ${today}`);
process.exit(0);
