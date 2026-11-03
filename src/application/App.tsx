import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import type { AppData, Budget, ChatMessage, EntryKind, Reminder, SheetName, Tab, Transaction, Wish } from '../domain/types';
import { starterData } from '../data/demoData';
import { categoryFromDescription, parseAmount, parseStatement } from '../features/transactions/csvImport';
import { C, CATEGORIES, CATEGORY_ICONS } from '../shared/theme';
import { daysAgo, isoDay, makeId, money, monthLabel, shortDate } from '../shared/formatters';
import { ChoiceRow, EmptyState, Field, PixelBuddy, SectionTitle, Sheet } from '../shared/components';
import { styles } from './styles';
import { deleteGeminiApiKey, loadFinanceData, loadGeminiApiKey, loadPreferences, saveFinanceData, saveGeminiApiKey, savePreferences } from '../platform/storage';
import { cancelPaymentReminder, configureReminderNotifications, schedulePaymentReminder } from '../platform/notifications';
import { requestGeminiAdvice } from '../integrations/gemini/geminiClient';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [sheet, setSheet] = useState<SheetName>(null);
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Groceries');
  const [txKind, setTxKind] = useState<EntryKind>('expense');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [budgetCategory, setBudgetCategory] = useState('Groceries');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [wishName, setWishName] = useState('');
  const [wishTarget, setWishTarget] = useState('');
  const [wishSaved, setWishSaved] = useState('0');
  const [contributionId, setContributionId] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderAmount, setReminderAmount] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [statementRows, setStatementRows] = useState<Transaction[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [showKeyField, setShowKeyField] = useState(false);
  const chatScroll = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [savedData, savedPrefs, key] = await Promise.all([
          loadFinanceData(), loadPreferences(),
          Platform.OS === 'web' ? Promise.resolve(null) : loadGeminiApiKey(),
        ]);
        if (!live) return;
        setData(savedData ? JSON.parse(savedData) as AppData : starterData());
        const prefs = savedPrefs ? JSON.parse(savedPrefs) as { geminiEnabled?: boolean } : {};
        setGeminiEnabled(Boolean(prefs.geminiEnabled && key));
        setHasApiKey(Boolean(key));
      } catch {
        if (live) setData(starterData());
      } finally { if (live) setHydrated(true); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (hydrated && data) void saveFinanceData(JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (hydrated) void savePreferences({ geminiEnabled });
  }, [geminiEnabled, hydrated]);

  useEffect(() => {
    if (Platform.OS === 'android') void configureReminderNotifications();
  }, []);

  const safeData = data ?? starterData();
  const today = isoDay(new Date());
  const monthTransactions = useMemo(() => safeData.transactions.filter((item) => item.date.slice(0, 7) === today.slice(0, 7)), [safeData.transactions, today]);
  const income = monthTransactions.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const spent = monthTransactions.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const left = income - spent;
  const categorySpend = useMemo(() => {
    const totals: Record<string, number> = {};
    monthTransactions.filter((item) => item.kind === 'expense').forEach((item) => { totals[item.category] = (totals[item.category] ?? 0) + item.amount; });
    return totals;
  }, [monthTransactions]);
  const overspent = safeData.budgets.filter((budget) => (categorySpend[budget.category] ?? 0) > budget.limit).sort((a, b) => (categorySpend[b.category] ?? 0) - b.limit);
  const biggestCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0];
  const latestTransactions = [...safeData.transactions].sort((a, b) => b.date.localeCompare(a.date));

  const updateData = (patch: Partial<AppData>) => setData((current) => {
    if (!current) return current;
    const startingWithRealTransaction = current.isDemo && Boolean(patch.transactions?.some((item) => !item.id.startsWith('sample-')));
    const clearingEverything = patch.transactions?.length === 0 && patch.budgets?.length === 0 && patch.wishes?.length === 0 && patch.reminders?.length === 0;
    const next: AppData = { ...current, ...patch, isDemo: current.isDemo && !startingWithRealTransaction && !clearingEverything };
    if (startingWithRealTransaction) {
      next.transactions = (patch.transactions ?? current.transactions).filter((item) => !item.id.startsWith('sample-'));
      next.wishes = (patch.wishes ?? current.wishes).filter((item) => !item.id.startsWith('sample-'));
    }
    return next;
  });

  const openTransaction = () => {
    setEditingTransactionId(null); setTxTitle(''); setTxAmount(''); setTxKind('expense'); setTxCategory('Groceries'); setSheet('transaction');
  };
  const openEditTransaction = (item: Transaction) => {
    setEditingTransactionId(item.id); setTxTitle(item.title); setTxAmount(String(item.amount)); setTxKind(item.kind); setTxCategory(item.category); setSheet('transaction');
  };
  const commitTransaction = () => {
    const amount = parseAmount(txAmount);
    if (!txTitle.trim() || amount <= 0) { Alert.alert('Add a little more detail', 'Enter a description and an amount above zero.'); return; }
    const category = txKind === 'income' ? 'Income' : txCategory;
    if (editingTransactionId) {
      updateData({ transactions: safeData.transactions.map((item) => item.id === editingTransactionId ? { ...item, title: txTitle.trim(), amount, category, kind: txKind } : item) });
    } else {
      updateData({ transactions: [{ id: makeId(), title: txTitle.trim(), amount, category, kind: txKind, date: today }, ...safeData.transactions] });
    }
    setSheet(null);
  };

  const openBudget = (category = 'Groceries') => {
    setBudgetCategory(category);
    setBudgetLimit(String(safeData.budgets.find((item) => item.category === category)?.limit ?? ''));
    setSheet('budget');
  };
  const commitBudget = () => {
    const limit = parseAmount(budgetLimit);
    if (limit <= 0) { Alert.alert('Enter a budget amount', 'A monthly budget must be above zero.'); return; }
    const budgets = safeData.budgets.filter((item) => item.category !== budgetCategory);
    budgets.push({ category: budgetCategory, limit });
    updateData({ budgets }); setSheet(null);
  };

  const commitWish = () => {
    const target = parseAmount(wishTarget); const saved = parseAmount(wishSaved);
    if (!wishName.trim() || target <= 0) { Alert.alert('Add your wish', 'Enter a name and a target amount.'); return; }
    updateData({ wishes: [{ id: makeId(), name: wishName.trim(), target, saved }, ...safeData.wishes] });
    setSheet(null);
  };

  const commitContribution = () => {
    const amount = parseAmount(contributionAmount);
    if (amount <= 0) { Alert.alert('Enter an amount', 'Add an amount above zero.'); return; }
    updateData({ wishes: safeData.wishes.map((wish) => wish.id === contributionId ? { ...wish, saved: wish.saved + amount } : wish) });
    setSheet(null);
  };

  const commitReminder = async () => {
    const amount = parseAmount(reminderAmount);
    const due = new Date(`${reminderDate}T09:00:00`);
    if (!reminderTitle.trim() || amount <= 0 || Number.isNaN(due.getTime())) {
      Alert.alert('Check the reminder details', 'Enter a payment name, amount, and due date in YYYY-MM-DD format.'); return;
    }
    if (due.getTime() <= Date.now()) { Alert.alert('Choose a future date', 'The payment reminder date needs to be in the future.'); return; }
    let notificationId: string | undefined;
    try {
      if (Platform.OS !== 'web') {
        notificationId = await schedulePaymentReminder(reminderTitle.trim(), amount, due);
      }
    } catch { /* The in-app reminder is still saved if OS scheduling is unavailable. */ }
    const reminder: Reminder = { id: makeId(), title: reminderTitle.trim(), amount, due: reminderDate, notificationId };
    updateData({ reminders: [reminder, ...safeData.reminders] }); setSheet(null);
    if (Platform.OS !== 'web' && !notificationId) Alert.alert('Reminder saved', 'It is in the app, but device notifications were not enabled. You can enable them in your phone settings.');
  };

  const importStatement = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.csv')) { Alert.alert('CSV statement needed', 'This first version imports CSV exports. PDF statement parsing is not included yet.'); return; }
      const importedFile = new File(asset.uri);
      try {
        const contents = await importedFile.text();
        const parsed = parseStatement(contents);
        if (!parsed.length) { Alert.alert('No transactions found', 'The CSV was read, but no transaction rows with amounts were found.'); return; }
        setStatementRows(parsed); setSheet('statement');
      } finally {
        try { importedFile.delete(); } catch { /* the selected file may not have a deletable cache copy */ }
      }
    } catch (error) { Alert.alert('Could not import this file', error instanceof Error ? error.message : 'Try exporting the statement as CSV.'); }
  };

  const confirmImport = () => {
    updateData({ transactions: [...statementRows, ...safeData.transactions] });
    setSheet(null); setStatementRows([]);
    Alert.alert('Statement imported', `${statementRows.length} transactions were added. You can adjust categories in Activity.`);
  };

  const deleteTransaction = (item: Transaction) => Alert.alert('Remove transaction?', `Remove “${item.title}” from this device?`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => updateData({ transactions: safeData.transactions.filter((transaction) => transaction.id !== item.id) }) },
  ]);

  const markReminderPaid = async (reminder: Reminder) => {
    if (reminder.notificationId) {
      try { await cancelPaymentReminder(reminder.notificationId); } catch { /* notification may already have been delivered */ }
    }
    updateData({ reminders: safeData.reminders.filter((item) => item.id !== reminder.id) });
    updateData({ transactions: [{ id: makeId(), title: reminder.title, amount: reminder.amount, category: categoryFromDescription(reminder.title), kind: 'expense', date: today }, ...safeData.transactions] });
  };

  const removeReminder = (reminder: Reminder) => Alert.alert('Remove this reminder?', `“${reminder.title}” will be removed. No payment will be made.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      if (reminder.notificationId) { try { await cancelPaymentReminder(reminder.notificationId); } catch { /* notification may already have been delivered */ } }
      updateData({ reminders: safeData.reminders.filter((item) => item.id !== reminder.id) });
    } },
  ]);

  const localAnswer = (question: string) => {
    const q = question.toLowerCase();
    if (/left|remaining|available|balance/.test(q)) return `This month you have ${money(left)} left after recorded spending. Income is ${money(income)} and spending is ${money(spent)}. This is based only on entries in Finance Bro.`;
    if (/cut|hold back|reduce|save|spend less|overspend|where/.test(q)) {
      const category = overspent[0]?.category ?? biggestCategory?.[0];
      if (!category) return 'Add a few expenses and category budgets, and I can point out where your spending is building up.';
      const amount = categorySpend[category] ?? 0;
      const budget = safeData.budgets.find((item) => item.category === category)?.limit;
      return `${category} is your largest recorded spending area at ${money(amount)}${budget ? ` against a ${money(budget)} monthly budget` : ''}. A gentle first step is to set a weekly cap and review that category before non-essential purchases.`;
    }
    if (/budget|category|spend/.test(q)) {
      const lines = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([category, amount]) => `${category}: ${money(amount)}`);
      return `For ${monthLabel()}, recorded income is ${money(income)}, spending is ${money(spent)}, and the difference is ${money(left)}. ${lines.length ? `Your highest categories are ${lines.join('; ')}.` : 'No category spending is recorded yet.'}`;
    }
    return `Your current month shows ${money(income)} income and ${money(spent)} spending, leaving ${money(left)}. Add a Gemini API key in More → Settings and enable Gemini if you want open-ended chat. This local response does not send any financial data off your device.`;
  };

  const askAdvisor = async (text = chatInput) => {
    const question = text.trim();
    if (!question || chatBusy) return;
    const userMessage: ChatMessage = { id: makeId(), role: 'user', text: question };
    setChat((current) => [...current, userMessage]); setChatInput(''); setChatBusy(true);
    try {
      let answer = localAnswer(question);
      if (geminiEnabled && hasApiKey && Platform.OS !== 'web') {
        const key = await loadGeminiApiKey();
        if (key) {
          const recentHistory = [...chat.slice(-6), userMessage].map((message) => `${message.role === 'user' ? 'User' : 'Advisor'}: ${message.text}`).join('\n');
          const summary = `Month: ${monthLabel()}. Income: ${money(income)}. Expenses: ${money(spent)}. Remaining after recorded spending: ${money(left)}. Category totals: ${Object.entries(categorySpend).map(([category, amount]) => `${category} ${money(amount)} / budget ${money(safeData.budgets.find((budget) => budget.category === category)?.limit ?? 0)}`).join(', ') || 'none yet'}. Budget overruns: ${overspent.map((item) => `${item.category} by ${money((categorySpend[item.category] ?? 0) - item.limit)}`).join(', ') || 'none'}.`;
          const prompt = `You are Finance Bro, a friendly personal budgeting helper. Give practical, cautious advice only about managing a household budget, spending, and saving. Do not recommend investments, loans, or financial products. Never invent numbers: use the provided summary. Be warm, concise, non-judgmental, and suggest one or two realistic next steps.\n\nFinancial summary (category totals only; no merchant names): ${summary}\n\nRecent conversation:\n${recentHistory}`;
          const responseText = await requestGeminiAdvice(key, prompt);
          if (responseText) answer = responseText;
        }
      }
      setChat((current) => [...current, { id: makeId(), role: 'assistant', text: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong while contacting Gemini.';
      setChat((current) => [...current, { id: makeId(), role: 'assistant', text: `${localAnswer(question)}\n\nGemini was unavailable: ${message}` }]);
    } finally { setChatBusy(false); }
  };

  const saveApiKey = async () => {
    const key = apiKeyDraft.trim();
    if (!key) { Alert.alert('Add a Gemini API key', 'Paste a key from Google AI Studio to connect the advisor.'); return; }
    try {
      await saveGeminiApiKey(key);
      setHasApiKey(true); setApiKeyDraft(''); setShowKeyField(false);
      Alert.alert('Key saved securely', 'Your key is stored on this device. Gemini stays off until you enable it below.');
    } catch { Alert.alert('Could not save key', 'Secure storage is unavailable on this device.'); }
  };

  const toggleGemini = async (value: boolean) => {
    if (value && !hasApiKey) { setShowKeyField(true); Alert.alert('Add a key first', 'Save a Gemini API key here before enabling the online advisor.'); return; }
    setGeminiEnabled(value);
  };

  const clearAllData = () => Alert.alert('Clear this device’s finance data?', 'This permanently removes transactions, budgets, wishes, and reminders stored by Finance Bro on this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear data', style: 'destructive', onPress: async () => {
      await Promise.all(safeData.reminders.map(async (reminder) => { if (reminder.notificationId) { try { await cancelPaymentReminder(reminder.notificationId); } catch { /* already gone */ } } }));
      updateData({ transactions: [], budgets: [], wishes: [], reminders: [] });
    } },
  ]);

  const removeApiKey = () => Alert.alert('Remove Gemini API key?', 'Open-ended Gemini chat will turn off. Your local finance data stays on this device.', [
    { text: 'Keep key', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await deleteGeminiApiKey(); } catch { /* continue to disable */ }
      setHasApiKey(false); setGeminiEnabled(false);
    } },
  ]);

  const formatKind = (kind: EntryKind) => kind === 'income' ? 'income' : 'expense';
  const openWish = () => { setWishName(''); setWishTarget(''); setWishSaved('0'); setSheet('wish'); };

  const renderTransaction = (item: Transaction) => (
    <Pressable key={item.id} onPress={() => openEditTransaction(item)} onLongPress={() => deleteTransaction(item)} style={styles.transactionRow}>
      <View style={[styles.transactionIcon, item.kind === 'income' ? styles.incomeIcon : null]}><Text style={[styles.transactionIconText, item.kind === 'income' && { color: C.green }]}>{item.kind === 'income' ? '↙' : CATEGORY_ICONS[item.category] ?? '•'}</Text></View>
      <View style={styles.transactionMeta}>
        <Text numberOfLines={1} style={styles.transactionName}>{item.title}</Text>
        <Text style={styles.transactionSub}>{item.category} · {shortDate(item.date)}</Text>
      </View>
      <Text style={[styles.transactionAmount, item.kind === 'income' && styles.positiveAmount]}>{item.kind === 'income' ? '+' : '−'}{money(item.amount)}</Text>
    </Pressable>
  );

  const renderHome = () => {
    const weekly = [0, 1, 2, 3, 4].map((week) => {
      const start = week * 7; const end = start + 7;
      const total = monthTransactions.filter((item) => item.kind === 'expense' && Number(item.date.slice(8, 10)) > start && Number(item.date.slice(8, 10)) <= end).reduce((sum, item) => sum + item.amount, 0);
      return { label: `W${week + 1}`, total };
    });
    const maxWeekly = Math.max(1, ...weekly.map((item) => item.total));
    const insightCategory = overspent[0]?.category ?? biggestCategory?.[0];
    const insightText = overspent[0]
      ? `${overspent[0].category} is ${money((categorySpend[overspent[0].category] ?? 0) - overspent[0].limit)} over its monthly plan. Take a quick look before spending more there.`
      : insightCategory
        ? `${insightCategory} is your biggest spending area so far at ${money(categorySpend[insightCategory] ?? 0)}. A weekly check-in can help keep it on track.`
        : 'Add a few transactions and I’ll help you spot useful patterns.';
    return (
      <>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}><View><Text style={styles.heroEyebrow}>AVAILABLE AFTER SPENDING</Text><Text style={styles.heroAmount}>{money(left)}</Text><Text style={styles.heroCaption}>for {monthLabel()}</Text></View><View style={styles.heroBuddy}><PixelBuddy size={5} /></View></View>
          <View style={styles.heroRule} />
          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>INCOME</Text><Text style={styles.heroStatValue}>{money(income)}</Text></View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}><Text style={styles.heroStatLabel}>SPENT</Text><Text style={styles.heroStatValue}>{money(spent)}</Text></View>
          </View>
          {safeData.isDemo && <Text style={styles.demoNotice}>Sample numbers · clear the demo data in More → Settings</Text>}
        </View>

        <View style={styles.actionPair}>
          <Pressable style={styles.actionTile} onPress={openTransaction}><Text style={styles.actionTileIcon}>＋</Text><Text style={styles.actionTileTitle}>Add entry</Text><Text style={styles.actionTileSub}>Log income or spending</Text></Pressable>
          <Pressable style={styles.actionTile} onPress={importStatement}><Text style={[styles.actionTileIcon, { color: C.steelDark }]}>⇧</Text><Text style={styles.actionTileTitle}>Import statement</Text><Text style={styles.actionTileSub}>Review a bank CSV</Text></Pressable>
        </View>

        <View style={styles.card}>
          <SectionTitle title="This month at a glance" action="Budgets" onAction={() => setActiveTab('Budgets')} />
          <View style={styles.chartRow}>
            {weekly.map((item) => <View key={item.label} style={styles.chartColumn}><View style={styles.chartTrack}><View style={[styles.chartBar, { height: `${Math.max(7, (item.total / maxWeekly) * 100)}%` as `${number}%`, backgroundColor: item.total ? C.steelDark : C.steel }]} /></View><Text style={styles.chartLabel}>{item.label}</Text><Text style={styles.chartValue}>{item.total ? money(item.total).replace(',00', '') : '—'}</Text></View>)}
          </View>
          <View style={styles.chartSummary}><Text style={styles.chartSummaryText}>Expenses recorded</Text><Text style={styles.chartSummaryTotal}>{money(spent)}</Text></View>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightBuddy}><PixelBuddy size={3} /></View>
          <View style={styles.insightContent}><View style={styles.insightTitleLine}><Text style={styles.insightTitle}>A little heads-up</Text><View style={styles.insightDot} /></View><Text style={styles.insightText}>{insightText}</Text><Pressable onPress={() => setActiveTab('Advisor')}><Text style={styles.insightLink}>Talk it through  ↗</Text></Pressable></View>
        </View>

        <View style={styles.card}>
          <SectionTitle title="Recent activity" action="See all" onAction={() => setActiveTab('Activity')} />
          {latestTransactions.slice(0, 5).length ? latestTransactions.slice(0, 5).map(renderTransaction) : <Text style={styles.cardEmptyText}>Your transactions will show here as you add them.</Text>}
        </View>
      </>
    );
  };

  const [activityFilter, setActivityFilter] = useState<'All' | 'Expenses' | 'Income'>('All');
  const renderActivity = () => {
    const filtered = latestTransactions.filter((item) => activityFilter === 'All' || (activityFilter === 'Income' ? item.kind === 'income' : item.kind === 'expense'));
    return <>
      <View style={styles.screenIntro}><Text style={styles.pageTitle}>Your activity</Text><Text style={styles.pageSubtitle}>Every entry, all in one place.</Text></View>
      <View style={styles.actionPair}>
        <Pressable style={styles.actionTile} onPress={openTransaction}><Text style={styles.actionTileIcon}>＋</Text><Text style={styles.actionTileTitle}>Add transaction</Text><Text style={styles.actionTileSub}>Quick manual entry</Text></Pressable>
        <Pressable style={styles.actionTile} onPress={importStatement}><Text style={[styles.actionTileIcon, { color: C.steelDark }]}>⇧</Text><Text style={styles.actionTileTitle}>Import CSV</Text><Text style={styles.actionTileSub}>Bank statement file</Text></Pressable>
      </View>
      <View style={styles.card}><SectionTitle title={`Transaction history · ${filtered.length}`} /><ChoiceRow options={['All', 'Expenses', 'Income']} value={activityFilter} onChange={(value) => setActivityFilter(value as typeof activityFilter)} />
        {filtered.length ? filtered.map(renderTransaction) : <EmptyState icon="◌" title="Nothing in this view" detail="Try another filter or add a transaction." action="Add transaction" onAction={openTransaction} />}
      </View>
      <Text style={styles.helperText}>Tap a transaction to edit it, or press and hold to remove it.</Text>
    </>;
  };

  const renderBudgets = () => {
    const budgets = [...safeData.budgets].sort((a, b) => (categorySpend[b.category] ?? 0) / b.limit - (categorySpend[a.category] ?? 0) / a.limit);
    const budgetTotal = safeData.budgets.reduce((sum, item) => sum + item.limit, 0);
    return <>
      <View style={styles.screenIntro}><Text style={styles.pageTitle}>Monthly budgets</Text><Text style={styles.pageSubtitle}>A plan that bends with real life.</Text></View>
      <View style={styles.budgetSummary}><View><Text style={styles.budgetSummaryLabel}>PLANNED LIMITS</Text><Text style={styles.budgetSummaryValue}>{money(budgetTotal)}</Text></View><View style={styles.budgetSummaryRight}><Text style={styles.budgetSummaryLabel}>ACTUAL SPENDING</Text><Text style={styles.budgetSummaryValue}>{money(spent)}</Text></View></View>
      <View style={styles.card}><SectionTitle title="Category breakdown" action="＋ Add limit" onAction={() => openBudget()} />
        {budgets.length ? budgets.map((budget) => {
          const actual = categorySpend[budget.category] ?? 0; const ratio = actual / budget.limit; const isOver = ratio > 1;
          return <Pressable key={budget.category} onPress={() => openBudget(budget.category)} style={styles.budgetRow}>
            <View style={styles.budgetRowTop}><View style={styles.budgetCategory}><View style={styles.smallIcon}><Text style={styles.smallIconText}>{CATEGORY_ICONS[budget.category] ?? '•'}</Text></View><Text style={styles.budgetCategoryName}>{budget.category}</Text></View><Text style={[styles.budgetAmount, isOver && styles.overAmount]}>{money(actual)} <Text style={styles.budgetLimit}>/ {money(budget.limit)}</Text></Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(ratio * 100, 100))}%` as `${number}%`, backgroundColor: isOver ? C.scarlet : ratio > 0.8 ? C.gold : C.steelDark }]} /></View>
            <Text style={[styles.budgetHint, isOver && styles.overHint]}>{isOver ? `${money(actual - budget.limit)} over budget` : `${money(budget.limit - actual)} left this month`}</Text>
          </Pressable>;
        }) : <EmptyState icon="◫" title="No category limits yet" detail="Add a monthly limit to start comparing your plan with actual spending." action="Add a budget" onAction={() => openBudget()} />}
      </View>
      <Text style={styles.helperText}>Tap any category to change its monthly limit.</Text>
    </>;
  };

  const renderWishes = () => <>
    <View style={styles.screenIntro}><Text style={styles.pageTitle}>Your wish box</Text><Text style={styles.pageSubtitle}>Good things feel closer with a plan.</Text></View>
    <View style={styles.wishHero}><View style={styles.wishHeroCopy}><Text style={styles.wishEyebrow}>SAVE FOR SOMETHING YOU LOVE</Text><Text style={styles.wishHeroTitle}>Small steps add up.</Text><Text style={styles.wishHeroSub}>Choose a wish, set a target, and watch it grow.</Text></View><View style={styles.wishBuddy}><PixelBuddy size={4} /></View></View>
    <Pressable style={styles.primaryButtonInline} onPress={openWish}><Text style={styles.primaryButtonText}>＋  Add a wish</Text></Pressable>
    {safeData.wishes.length ? safeData.wishes.map((wish) => {
      const progress = Math.min(wish.saved / Math.max(wish.target, 1), 1);
      return <View key={wish.id} style={styles.wishCard}><View style={styles.wishTop}><View style={styles.wishIcon}><Text style={styles.wishIconText}>♡</Text></View><View style={styles.wishNameWrap}><Text style={styles.wishName}>{wish.name}</Text><Text style={styles.wishDate}>{Math.round(progress * 100)}% of the way there</Text></View><Text style={styles.wishTarget}>{money(wish.target)}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` as `${number}%`, backgroundColor: C.scarlet }]} /></View><View style={styles.wishBottom}><Text style={styles.wishSaved}>{money(wish.saved)} saved</Text><Pressable onPress={() => { setContributionId(wish.id); setContributionAmount(''); setSheet('contribution'); }} style={styles.smallAction}><Text style={styles.smallActionText}>＋ Add savings</Text></Pressable></View></View>;
    }) : <EmptyState icon="♡" title="Your wish box is empty" detail="Add something you’re saving for and give it a target." action="Add a wish" onAction={openWish} />}
  </>;

  const renderAdvisor = () => <>
    <View style={styles.screenIntro}><Text style={styles.pageTitle}>Your money buddy</Text><Text style={styles.pageSubtitle}>A calm place to make sense of your month.</Text></View>
    <View style={styles.advisorIntro}><View style={styles.advisorBuddy}><PixelBuddy size={5} /></View><View style={styles.advisorIntroText}><Text style={styles.advisorHello}>Hey, I’m Bro.</Text><Text style={styles.advisorDesc}>I can help you understand your budget and find a comfortable place to cut back.</Text></View></View>
    <View style={styles.chatPrivacy}><Text style={styles.chatPrivacyIcon}>{geminiEnabled ? '↗' : '⌂'}</Text><Text style={styles.chatPrivacyText}>{geminiEnabled ? 'Gemini is on. Your question, recent chat, and category summary go to Google. Merchant descriptions stay here.' : 'Private local mode. Budget answers stay on this device; enable Gemini in More → Settings for open-ended chat.'}</Text></View>
    <View style={styles.card}>
      {chat.length === 0 ? <>
        <Text style={styles.chatPromptTitle}>What would you like to know?</Text>
        <Text style={styles.chatPromptSub}>I’ll use this month’s recorded figures to help.</Text>
        <View style={styles.promptWrap}>
          {['How much do I have left?', 'Where can I hold back?', 'How am I doing on budgets?'].map((prompt) => <Pressable key={prompt} style={styles.promptChip} onPress={() => void askAdvisor(prompt)}><Text style={styles.promptChipText}>{prompt}</Text><Text style={styles.promptArrow}>↗</Text></Pressable>)}
        </View>
        <View style={styles.chatDataCard}><Text style={styles.chatDataLabel}>YOUR MONTH AT A GLANCE</Text><View style={styles.chatDataLine}><Text style={styles.chatDataName}>Income</Text><Text style={styles.chatDataValue}>{money(income)}</Text></View><View style={styles.chatDataLine}><Text style={styles.chatDataName}>Spending</Text><Text style={styles.chatDataValue}>{money(spent)}</Text></View><View style={styles.chatDataLine}><Text style={styles.chatDataName}>Left</Text><Text style={[styles.chatDataValue, { color: left < 0 ? C.scarlet : C.green }]}>{money(left)}</Text></View></View>
      </> : <ScrollView ref={chatScroll} style={styles.chatHistory} contentContainerStyle={styles.chatHistoryContent} onContentSizeChange={() => chatScroll.current?.scrollToEnd({ animated: true })}>
        {chat.map((message) => <View key={message.id} style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.chatBubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text></View>)}
        {chatBusy && <View style={[styles.chatBubble, styles.assistantBubble]}><Text style={styles.typingText}>Bro is thinking…</Text></View>}
      </ScrollView>}
      <View style={styles.chatComposer}><TextInput value={chatInput} onChangeText={setChatInput} placeholder="Ask about your spending…" placeholderTextColor={C.muted} returnKeyType="send" onSubmitEditing={() => void askAdvisor()} style={styles.chatInput} editable={!chatBusy} /><Pressable style={[styles.sendButton, chatBusy && { opacity: 0.55 }]} onPress={() => void askAdvisor()} disabled={chatBusy}><Text style={styles.sendButtonText}>↑</Text></Pressable></View>
      <Text style={styles.disclaimer}>Budget guidance for everyday money management. Check important decisions yourself.</Text>
    </View>
  </>;

  const renderMore = () => <>
    <View style={styles.screenIntro}><Text style={styles.pageTitle}>Reminders & settings</Text><Text style={styles.pageSubtitle}>Helpful nudges, on your terms.</Text></View>
      <View style={styles.card}><SectionTitle title="Payment reminders" action="＋ Add" onAction={() => { setReminderTitle(''); setReminderAmount(''); setReminderDate(''); setSheet('reminder'); }} /><Text style={styles.cardIntro}>A notification reminds you when a payment is due. You always make the payment yourself.</Text>
      {safeData.reminders.length ? [...safeData.reminders].sort((a, b) => a.due.localeCompare(b.due)).map((reminder) => <View key={reminder.id} style={styles.reminderRow}><View style={styles.reminderDateBox}><Text style={styles.reminderMonth}>{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(`${reminder.due}T12:00:00`)).toUpperCase()}</Text><Text style={styles.reminderDay}>{reminder.due.slice(-2)}</Text></View><View style={styles.reminderMeta}><Text style={styles.reminderName}>{reminder.title}</Text><Text style={styles.reminderAmount}>{money(reminder.amount)} · due {shortDate(reminder.due)}</Text></View><Pressable onPress={() => void markReminderPaid(reminder)} style={styles.paidButton}><Text style={styles.paidButtonText}>Paid</Text></Pressable><Pressable onPress={() => removeReminder(reminder)} hitSlop={8} style={styles.removeReminder}><Text style={styles.removeReminderText}>×</Text></Pressable></View>) : <EmptyState icon="◷" title="No reminders yet" detail="Add rent, utilities, or another bill. We’ll nudge you on the due date." action="Add reminder" onAction={() => { setReminderTitle(''); setReminderAmount(''); setReminderDate(''); setSheet('reminder'); }} />}
    </View>
    <View style={styles.card}><SectionTitle title="Gemini advisor" /><Text style={styles.cardIntro}>When enabled, your question, recent chat messages, and a summary of category totals go to Google. Transaction descriptions are not sent.</Text>
      <View style={styles.keyStatus}><View style={[styles.statusDot, hasApiKey && styles.statusDotOn]} /><Text style={styles.keyStatusText}>{hasApiKey ? 'API key saved on this device' : 'No API key saved'}</Text><Pressable onPress={() => setShowKeyField((value) => !value)}><Text style={styles.actionText}>{hasApiKey ? 'Change' : 'Add key'}</Text></Pressable></View>
      {showKeyField && <><Field label="Gemini API key" value={apiKeyDraft} onChangeText={setApiKeyDraft} placeholder="Paste key from Google AI Studio" secureTextEntry /><Pressable style={styles.outlineButton} onPress={() => void saveApiKey()}><Text style={styles.outlineButtonText}>Save key securely</Text></Pressable></>}
      <Pressable onPress={() => void toggleGemini(!geminiEnabled)} style={styles.toggleRow}><View><Text style={styles.toggleTitle}>Allow Gemini chat</Text><Text style={styles.toggleSub}>{geminiEnabled ? 'On · financial summary leaves this device when you send a chat' : 'Off · use private, local budget answers'}</Text></View><View style={[styles.toggleTrack, geminiEnabled && styles.toggleTrackOn]}><View style={[styles.toggleThumb, geminiEnabled && styles.toggleThumbOn]} /></View></Pressable>
      {hasApiKey && <Pressable onPress={removeApiKey} style={styles.removeKey}><Text style={styles.removeKeyText}>Remove saved API key</Text></Pressable>}
    </View>
    <View style={styles.card}><SectionTitle title="Your data stays yours" /><Text style={styles.cardIntro}>No sign-in. Your budgets, wishes, reminders, and transactions stay in this app’s local storage. Imported CSV text is read on this device and is not retained as a file.</Text><View style={styles.storageBadge}><Text style={styles.storageBadgeIcon}>⌂</Text><Text style={styles.storageBadgeText}>LOCAL DEVICE STORAGE</Text></View></View>
    <View style={styles.card}><SectionTitle title="Reset" /><Text style={styles.cardIntro}>The current sample entries are only there to preview the dashboard. Clear all app records whenever you’re ready to start fresh.</Text><Pressable onPress={clearAllData} style={styles.dangerButton}><Text style={styles.dangerButtonText}>Clear finance data from this device</Text></Pressable></View>
    <Text style={styles.versionText}>FINANCE BRO · FIRST STAGE · NO AUTOPAY</Text>
  </>;

  if (!hydrated || !data) return <SafeAreaView style={styles.loadingScreen}><StatusBar style="dark" /><PixelBuddy size={6} /><Text style={styles.loadingText}>Getting your money space ready…</Text></SafeAreaView>;

  const pageTitle: Record<Tab, string> = { Home: 'Hey there,', Activity: 'Activity', Budgets: 'Budgets', Wishes: 'Wishes', Advisor: 'Advisor', More: 'More' };
  const tabIcons: Record<Tab, string> = { Home: '⌂', Activity: '↕', Budgets: '▥', Wishes: '♡', Advisor: '✳', More: '•••' };
  const tabs: Tab[] = ['Home', 'Activity', 'Budgets', 'Wishes', 'Advisor', 'More'];
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <View style={styles.brandRow}><View style={styles.brandMark}><PixelBuddy size={2.2} /></View><View><Text style={styles.brandName}>FINANCE BRO</Text><Text style={styles.brandTag}>YOUR LITTLE MONEY SIDEKICK</Text></View></View>
        <View style={styles.headerRight}><Pressable style={styles.headerIconButton} onPress={() => setActiveTab('More')}><Text style={styles.headerIcon}>◷</Text>{safeData.reminders.some((item) => item.due === today) && <View style={styles.notificationDot} />}</Pressable><View style={styles.headerBuddy}><PixelBuddy size={2.5} /></View></View>
      </View>
      <View style={styles.greetingRow}><View><Text style={styles.greeting}>{pageTitle[activeTab]} <Text style={styles.greetingEmoji}>✦</Text></Text><Text style={styles.greetingSub}>{activeTab === 'Home' ? 'Let’s keep your money feeling good.' : activeTab === 'Activity' ? 'Browse and update all your entries.' : activeTab === 'More' ? 'Reminders and local app settings.' : `${activeTab} · ${monthLabel()}`}</Text></View><View style={styles.monthPill}><Text style={styles.monthPillText}>{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date()).toUpperCase()}</Text></View></View>
      <ScrollView key={activeTab} showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
        {activeTab === 'Home' && renderHome()}
        {activeTab === 'Activity' && renderActivity()}
        {activeTab === 'Budgets' && renderBudgets()}
        {activeTab === 'Wishes' && renderWishes()}
        {activeTab === 'Advisor' && renderAdvisor()}
        {activeTab === 'More' && renderMore()}
      </ScrollView>
      <View style={styles.tabBar}>{tabs.map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tabItem}><View style={[styles.tabIconWrap, activeTab === tab && styles.tabIconWrapActive]}><Text style={[styles.tabIcon, activeTab === tab && styles.tabIconActive]}>{tabIcons[tab]}</Text></View><Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text></Pressable>)}</View>

      <Sheet visible={sheet === 'transaction'} title={editingTransactionId ? 'Edit transaction' : 'Add transaction'} onClose={() => setSheet(null)} onSave={commitTransaction} saveLabel={editingTransactionId ? 'Save changes' : 'Save transaction'}>
        <Text style={styles.formIntro}>Log money in or out. You can update or remove transactions later.</Text>
        <ChoiceRow options={['Expense', 'Income']} value={txKind === 'expense' ? 'Expense' : 'Income'} onChange={(value) => { const kind = value === 'Income' ? 'income' : 'expense'; setTxKind(kind); setTxCategory(kind === 'income' ? 'Income' : 'Groceries'); }} />
        <Field label="What was it?" value={txTitle} onChangeText={setTxTitle} placeholder="e.g. Weekly shop" />
        <Field label="Amount" value={txAmount} onChangeText={setTxAmount} placeholder="0.00" keyboardType="decimal-pad" />
        {txKind === 'expense' && <><Text style={styles.fieldLabel}>Category</Text><ChoiceRow options={CATEGORIES} value={txCategory} onChange={setTxCategory} /></>}
      </Sheet>

      <Sheet visible={sheet === 'budget'} title="Set a monthly limit" onClose={() => setSheet(null)} onSave={commitBudget}>
        <Text style={styles.formIntro}>Choose a category and set the amount you’d like to stay within.</Text>
        <Text style={styles.fieldLabel}>Category</Text><ChoiceRow options={CATEGORIES.filter((item) => item !== 'Other')} value={budgetCategory} onChange={setBudgetCategory} />
        <Field label="Monthly budget" value={budgetLimit} onChangeText={setBudgetLimit} placeholder="0.00" keyboardType="decimal-pad" />
      </Sheet>

      <Sheet visible={sheet === 'wish'} title="Add to your wish box" onClose={() => setSheet(null)} onSave={commitWish}>
        <Text style={styles.formIntro}>Pick something that matters to you. We’ll help make the target feel manageable.</Text>
        <Field label="What are you saving for?" value={wishName} onChangeText={setWishName} placeholder="e.g. A weekend away" />
        <Field label="Target amount" value={wishTarget} onChangeText={setWishTarget} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Already saved" value={wishSaved} onChangeText={setWishSaved} placeholder="0.00" keyboardType="decimal-pad" />
      </Sheet>

      <Sheet visible={sheet === 'contribution'} title="Add savings" onClose={() => setSheet(null)} onSave={commitContribution}>
        <Text style={styles.formIntro}>Add to the amount you’ve set aside for this wish.</Text>
        <Field label="Amount saved" value={contributionAmount} onChangeText={setContributionAmount} placeholder="0.00" keyboardType="decimal-pad" />
      </Sheet>

      <Sheet visible={sheet === 'reminder'} title="Payment reminder" onClose={() => setSheet(null)} onSave={() => void commitReminder()} saveLabel="Save reminder">
        <Text style={styles.formIntro}>We’ll remind you on the due date. You make the payment yourself; no money moves automatically.</Text>
        <Field label="What needs paying?" value={reminderTitle} onChangeText={setReminderTitle} placeholder="e.g. Electricity bill" />
        <Field label="Amount" value={reminderAmount} onChangeText={setReminderAmount} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Due date" value={reminderDate} onChangeText={setReminderDate} placeholder="YYYY-MM-DD" />
      </Sheet>

      <Sheet visible={sheet === 'statement'} title="Review statement import" onClose={() => { setSheet(null); setStatementRows([]); }} onSave={confirmImport} saveLabel={`Add ${statementRows.length} transactions`}>
        <Text style={styles.formIntro}>Review the first rows before adding. Amounts and categories can be corrected later in Activity.</Text>
        {statementRows.slice(0, 12).map((item) => <View key={item.id} style={styles.importRow}><View style={styles.importDot} /><View style={styles.importMeta}><Text numberOfLines={1} style={styles.transactionName}>{item.title}</Text><Text style={styles.transactionSub}>{shortDate(item.date)} · {item.category}</Text></View><Text style={[styles.importAmount, item.kind === 'income' && styles.positiveAmount]}>{item.kind === 'income' ? '+' : '−'}{money(item.amount)}</Text></View>)}
        {statementRows.length > 12 && <Text style={styles.helperText}>And {statementRows.length - 12} more rows…</Text>}
      </Sheet>
    </SafeAreaView>
  );
}
