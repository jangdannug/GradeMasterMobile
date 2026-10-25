const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> "yyyy-MM-dd" in local time */
export const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayString = () => toDateString(new Date());

/** "yyyy-MM-dd" -> Date at local noon (avoids timezone day shifts) */
export const fromDateString = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
};

/** ISO or date string -> "yyyy-MM-dd" ('' when empty or invalid; the server's 0001-01-01 means "not set") */
export const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value));
  return match && !match[0].startsWith('0001-') ? match[0] : '';
};

/** "yyyy-MM-dd" -> "YYYY-MM-DDT00:00:00.000Z" ('' when empty or invalid) */
export const toIsoDate = (value?: string | null): string => {
  const date = toDateOnly(value);
  return date ? `${date}T00:00:00.000Z` : '';
};

/** "yyyy-MM-dd" -> "MMM dd, yyyy" */
export const formatDate = (s: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${pad(d)}, ${y}`;
};
