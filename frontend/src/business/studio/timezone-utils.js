function partsOf(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return parts;
}

export function utcIsoToZonedParts(iso, timeZone) {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = partsOf(date, timeZone);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Offset (ms) of timeZone from UTC at the given instant, computed purely from that
// instant + the explicit IANA zone name — never from the runtime's own local zone, so
// this is correct identically on any machine/server regardless of where it executes.
function tzOffsetMs(utcMs, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asIfUtc - utcMs;
}

export function zonedTimeToUtcIso(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  const candidateUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  // One pass is enough outside the ~1-2 rare hours/year a clock changes: format the
  // candidate in timeZone to find its offset there, then subtract that offset from the
  // "as if UTC" wall-clock reading to land on the true absolute instant.
  const offset = tzOffsetMs(candidateUtc, timeZone);
  return new Date(candidateUtc - offset).toISOString();
}

export function formatZonedDisplay(iso, timeZone, isArabic) {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const dateLabel = date.toLocaleDateString(isArabic ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  const timeLabel = date.toLocaleTimeString(isArabic ? 'ar' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone });
  return { date: dateLabel, time: timeLabel };
}
