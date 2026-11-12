/** All dates are displayed in India Standard Time regardless of the viewer's device timezone. */
export const APP_TIME_ZONE = 'Asia/Kolkata';

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const isoDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date (YYYY-MM-DD) in India Standard Time, e.g. for date-input min values. */
export function isoDateInIST(at: Date = new Date()): string {
  return isoDateFmt.format(at);
}

/** Add whole days to a YYYY-MM-DD date string. */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Midnight IST at the start of a YYYY-MM-DD date, as an ISO timestamp with offset. */
export function startOfDayIST(isoDate: string): string {
  return `${isoDate}T00:00:00+05:30`;
}

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 12 Nov 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
}

/** 12 Nov 2026, 09:30 am (IST) */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '—';
}
