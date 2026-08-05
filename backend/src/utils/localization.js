/**
 * JIGZO Centralized Localization Utility for WhatsApp Notifications
 */

/**
 * Normalizes a language code and treats any locale starting with "ar" (case-insensitive) as Arabic.
 * Examples: 'ar', 'ar_BH', 'ar-BH', 'AR'
 */
function isArabic(langCode) {
  if (!langCode) return false;
  const normalized = String(langCode).trim().toLowerCase();
  return normalized.startsWith('ar');
}

/**
 * Returns the localized anonymous sender name.
 */
function getAnonymousSender(langCode) {
  return isArabic(langCode) ? 'شخص ما' : 'Someone';
}

/**
 * Normalizes input date/timestamp to be timezone-aware.
 * If input is a timezone-less string, parses it as UTC instead of using the local server timezone.
 */
function ensureTimezoneAware(dateInput) {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  if (typeof dateInput === 'number') {
    return new Date(dateInput);
  }
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Check if it already has offset or Z indicator (e.g. Z, +0300, -05:00)
    if (/z|Z|[+\-]\d{2}(:?\d{2})?$/.test(trimmed)) {
      return new Date(trimmed);
    }
    // No timezone offset: assume UTC (Z) to ensure it's timezone-aware
    return new Date(trimmed + 'Z');
  }
  return new Date();
}

/**
 * Formats completion date and time deterministically in Arabic (Bahrain timezone & numerals).
 * Reconstructs the string explicitly to avoid environment-dependent punctuation, ordering, or BiDi marks.
 * Returns a value like: "٢ أغسطس ٢٠٢٦، الساعة ٧:١٣ ص"
 */
function formatCompletionDateTimeArabic(dateInput) {
  const date = ensureTimezoneAware(dateInput);
  const dtf = new Intl.DateTimeFormat('ar-BH-u-nu-arab', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Bahrain'
  });
  const parts = dtf.formatToParts(date);
  
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';

  // Strip invisible bidirectional control characters (e.g. LTR/RTL marks)
  const clean = (str) => String(str).replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();

  const cleanDay = clean(day);
  const cleanMonth = clean(month);
  const cleanYear = clean(year);
  const cleanHour = clean(hour);
  const cleanMinute = clean(minute);
  const cleanDayPeriod = clean(dayPeriod);

  let normalizedPeriod = 'ص';
  if (cleanDayPeriod.toLowerCase().includes('p') || cleanDayPeriod.includes('م')) {
    normalizedPeriod = 'م';
  } else if (cleanDayPeriod.toLowerCase().includes('a') || cleanDayPeriod.includes('ص')) {
    normalizedPeriod = 'ص';
  }

  return `${cleanDay} ${cleanMonth} ${cleanYear}، الساعة ${cleanHour}:${cleanMinute} ${normalizedPeriod}`;
}

/**
 * Formats durations safely for Arabic WhatsApp templates.
 */
function formatDurationArabic(durationSeconds) {
  // Safe handling of null, undefined, NaN, or negative values
  let secondsTotal = Number(durationSeconds);
  if (isNaN(secondsTotal) || secondsTotal < 0) {
    secondsTotal = 0;
  }

  const totalSecs = Math.round(secondsTotal);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;

  const toArabicDigits = (num) => {
    return new Intl.NumberFormat('ar-BH-u-nu-arab', { useGrouping: false }).format(num);
  };

  const formatArabicSeconds = (s) => {
    if (s === 1) return 'ثانية واحدة';
    if (s === 2) return 'ثانيتان';
    if (s >= 3 && s <= 10) return `${toArabicDigits(s)} ثوانٍ`;
    return `${toArabicDigits(s)} ثانية`;
  };

  if (minutes === 0) {
    if (seconds === 0) {
      return `${toArabicDigits(0)} ثانية`;
    }
    return formatArabicSeconds(seconds);
  }

  let minutesStr = '';
  if (minutes === 1) {
    if (seconds === 0) {
      return 'دقيقة واحدة';
    }
    minutesStr = 'دقيقة';
  } else if (minutes === 2) {
    if (seconds === 0) {
      return 'دقيقتان';
    }
    minutesStr = 'دقيقتان';
  } else if (minutes >= 3 && minutes <= 10) {
    minutesStr = `${toArabicDigits(minutes)} دقائق`;
  } else {
    minutesStr = `${toArabicDigits(minutes)} دقيقة`;
  }

  if (seconds === 0) {
    return minutesStr;
  } else {
    return `${minutesStr} و${formatArabicSeconds(seconds)}`;
  }
}

module.exports = {
  isArabic,
  getAnonymousSender,
  ensureTimezoneAware,
  formatCompletionDateTimeArabic,
  formatDurationArabic
};
