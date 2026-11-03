type EntryKind = 'expense' | 'income';
type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  kind: EntryKind;
  date: string;
};
type Budget = { category: string; limit: number };
type Wish = { id: string; name: string; target: number; saved: number };
type Reminder = { id: string; title: string; amount: number; due: string; notificationId?: string };
type AppData = {
  transactions: Transaction[];
  budgets: Budget[];
  wishes: Wish[];
  reminders: Reminder[];
  isDemo: boolean;
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };
type Tab = 'Home' | 'Activity' | 'Budgets' | 'Wishes' | 'Advisor' | 'More';
type SheetName = 'transaction' | 'budget' | 'wish' | 'contribution' | 'reminder' | 'statement' | null;
export type { EntryKind, Transaction, Budget, Wish, Reminder, AppData, ChatMessage, Tab, SheetName };
