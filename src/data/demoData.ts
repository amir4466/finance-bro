import type { AppData, Transaction } from '../domain/types';
import { daysAgo } from '../shared/formatters';

function starterData(): AppData {
  const transactions: Transaction[] = [
    { id: 'sample-salary', title: 'Monthly salary', amount: 2800, category: 'Income', kind: 'income', date: daysAgo(2), source: 'demo' },
    { id: 'sample-rent', title: 'Rent', amount: 920, category: 'Housing', kind: 'expense', date: daysAgo(3), source: 'demo' },
    { id: 'sample-grocery1', title: 'Albert Heijn', amount: 64.8, category: 'Groceries', kind: 'expense', date: daysAgo(1), source: 'demo' },
    { id: 'sample-travel', title: 'NS travel', amount: 28.5, category: 'Transport', kind: 'expense', date: daysAgo(4), source: 'demo' },
    { id: 'sample-dining', title: 'Lunch with friends', amount: 32, category: 'Dining', kind: 'expense', date: daysAgo(5), source: 'demo' },
    { id: 'sample-streaming', title: 'Streaming', amount: 13.99, category: 'Subscriptions', kind: 'expense', date: daysAgo(6), source: 'demo' },
    { id: 'sample-shop', title: 'Home supplies', amount: 46.25, category: 'Shopping', kind: 'expense', date: daysAgo(8), source: 'demo' },
    { id: 'sample-grocery2', title: 'Jumbo', amount: 52.4, category: 'Groceries', kind: 'expense', date: daysAgo(10), source: 'demo' },
    { id: 'sample-power', title: 'Energy bill', amount: 98, category: 'Utilities', kind: 'expense', date: daysAgo(12), source: 'demo' },
    { id: 'sample-coffee', title: 'Coffee bar', amount: 8.7, category: 'Dining', kind: 'expense', date: daysAgo(13), source: 'demo' },
    { id: 'sample-gym', title: 'Gym membership', amount: 27.5, category: 'Health', kind: 'expense', date: daysAgo(15), source: 'demo' },
  ];
  return {
    transactions,
    budgets: [
      { category: 'Groceries', limit: 300 }, { category: 'Dining', limit: 120 }, { category: 'Transport', limit: 100 },
      { category: 'Housing', limit: 950 }, { category: 'Subscriptions', limit: 55 }, { category: 'Shopping', limit: 130 },
      { category: 'Utilities', limit: 180 }, { category: 'Health', limit: 60 },
    ],
    wishes: [{ id: 'sample-wish', name: 'A weekend away', target: 450, saved: 165 }],
    reminders: [],
    isDemo: true,
  };
}
export { starterData };
