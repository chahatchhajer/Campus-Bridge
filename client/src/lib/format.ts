/** Parse a 'YYYY-MM-DD' string as a local calendar date (avoids the UTC shift of `new Date('2026-01-05')`). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayInput = () => toDateInput(new Date());

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthYearFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });

export const formatDate = (v: string | null | undefined) => (v ? dateFmt.format(parseDateOnly(v)) : '-');
export const formatDateShort = (v: string) => dateShortFmt.format(parseDateOnly(v));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${dateShortFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}`;
export const formatWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
export const formatMonthYear = (d: Date) => monthYearFmt.format(d);
export const monthShort = (d: Date) => monthShortFmt.format(d);

export function formatMonthKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
}

/** ISO timestamp -> value for <input type="datetime-local"> in the user's time zone. */
export function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const fromDateTimeLocal = (value: string) => new Date(value).toISOString();

export function daysUntil(dateOnly: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDateOnly(dateOnly).getTime() - today.getTime()) / 86_400_000);
}

export function relativeDay(dateOnly: string) {
  const n = daysUntil(dateOnly);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1) return `In ${n} days`;
  return `${-n} days ago`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return dateFmt.format(new Date(iso));
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const formatPercent = (p: number | null) => (p === null ? 'n/a' : `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`);
