import type { MerchantRule, MerchantRulePrompt, Transaction } from '../../domain/types';

function normalizeMerchantName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMerchantRule(name: string, rules: MerchantRule[]): MerchantRule | undefined {
  const merchantKey = normalizeMerchantName(name);
  return merchantKey ? rules.find((rule) => rule.merchantKey === merchantKey) : undefined;
}

function applyMerchantRules(rows: Transaction[], rules: MerchantRule[]): Transaction[] {
  if (!rules.length) return rows;
  return rows.map((row) => {
    if (row.kind !== 'expense') return row;
    const rule = findMerchantRule(row.title, rules);
    return rule ? { ...row, category: rule.category } : row;
  });
}

function findRecurringUnknownMerchants(rows: Transaction[], rules: MerchantRule[] = []): MerchantRulePrompt[] {
  const groups = new Map<string, MerchantRulePrompt>();
  rows.forEach((row) => {
    if (row.source !== 'csv' || row.kind !== 'expense' || row.category !== 'Other' || findMerchantRule(row.title, rules)) return;
    const merchantKey = normalizeMerchantName(row.title);
    if (!merchantKey) return;
    const current = groups.get(merchantKey);
    if (current) current.count += 1;
    else groups.set(merchantKey, { merchantKey, merchantName: row.title.trim(), count: 1, category: null });
  });
  return [...groups.values()]
    .filter((merchant) => merchant.count > 1)
    .sort((a, b) => b.count - a.count || a.merchantKey.localeCompare(b.merchantKey));
}

function applyMerchantCategory(rows: Transaction[], merchantKey: string, category: string): Transaction[] {
  return rows.map((row) => normalizeMerchantName(row.title) === merchantKey ? { ...row, category } : row);
}

export { normalizeMerchantName, findMerchantRule, applyMerchantRules, findRecurringUnknownMerchants, applyMerchantCategory };
