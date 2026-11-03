const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isoDay = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
};
const money = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
const monthLabel = (date = new Date()) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
const shortDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
};
export { makeId, isoDay, daysAgo, money, monthLabel, shortDate };
