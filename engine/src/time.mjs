// Time handling: local birth time in an IANA timezone -> UTC -> Julian Day.
// Historical timezone rules (old offsets, daylight saving) come from the runtime's tz database.

function wallClockAsUtcMs(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(instantMs))) p[part.type] = part.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

/** Offset of `timeZone` from UTC at a given instant, in milliseconds (east positive). */
export function zoneOffsetMs(instantMs, timeZone) {
  return wallClockAsUtcMs(instantMs, timeZone) - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Convert a local wall-clock date/time in an IANA timezone to a UTC instant.
 * @param {string} date  'YYYY-MM-DD'
 * @param {string} time  'HH:MM' or 'HH:MM:SS'
 * @param {string} timeZone IANA name, e.g. 'Asia/Kolkata'
 * @returns {{utcMs:number, offsetMinutes:number}}
 */
export function localToUtc(date, time, timeZone) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dm) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  if (!tm) throw new Error(`Invalid time "${time}", expected HH:MM`);
  const [y, mo, d] = [+dm[1], +dm[2], +dm[3]];
  const [h, mi, s] = [+tm[1], +tm[2], +(tm[3] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) {
    throw new Error(`Out-of-range date/time: ${date} ${time}`);
  }
  // Validate the timezone name early (throws RangeError if unknown).
  new Intl.DateTimeFormat('en-US', { timeZone });

  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  // Two passes settle the offset across daylight-saving boundaries.
  let utc = wall - zoneOffsetMs(wall, timeZone);
  utc = wall - zoneOffsetMs(utc, timeZone);
  return { utcMs: utc, offsetMinutes: (wall - utc) / 60000 };
}

/** Julian Day (UT) from a UTC instant in milliseconds. */
export function julianDay(utcMs) {
  return utcMs / 86400000 + 2440587.5;
}

/** UTC instant in milliseconds from a Julian Day (UT). */
export function jdToMs(jd) {
  return (jd - 2440587.5) * 86400000;
}
