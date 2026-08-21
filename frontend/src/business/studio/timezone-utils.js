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

export function zonedTimeToUtcIso(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naiveUtc.getTime())) return null;
  const zonedAsUtc = new Date(naiveUtc.toLocaleString('en-US', { timeZone }));
  const offset = naiveUtc.getTime() - zonedAsUtc.getTime();
  return new Date(naiveUtc.getTime() + offset).toISOString();
}

export function formatZonedDisplay(iso, timeZone, isArabic) {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const dateLabel = date.toLocaleDateString(isArabic ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  const timeLabel = date.toLocaleTimeString(isArabic ? 'ar' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone });
  return { date: dateLabel, time: timeLabel };
}
