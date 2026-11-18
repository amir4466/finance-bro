type EntryKind = 'expense' | 'income';
type TransactionSource = 'manual' | 'csv' | 'notification' | 'demo';
type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  kind: EntryKind;
  date: string;
  /** Optional for compatibility with transactions saved before source tracking. */
  source?: TransactionSource;
};
type MerchantRule = { merchantKey: string; merchantName: string; category: string };
type MerchantRulePrompt = { merchantKey: string; merchantName: string; count: number; category: string | null };
type Budget = { category: string; limit: number };
type Wish = { id: string; name: string; target: number; saved: number };
type Reminder = { id: string; title: string; amount: number; due: string; notificationId?: string };
type AppData = {
  transactions: Transaction[];
  budgets: Budget[];
  wishes: Wish[];
  reminders: Reminder[];
  /** Optional for compatibility with data saved before merchant labels. */
  merchantRules?: MerchantRule[];
  isDemo: boolean;
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };
type Tab = 'Home' | 'Activity' | 'Budgets' | 'Wishes' | 'Advisor' | 'More';
type SheetName = 'transaction' | 'budget' | 'wish' | 'contribution' | 'reminder' | 'statement' | null;
export type { EntryKind, TransactionSource, Transaction, MerchantRule, MerchantRulePrompt, Budget, Wish, Reminder, AppData, ChatMessage, Tab, SheetName };
