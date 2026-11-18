import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMerchantCategory, applyMerchantRules, findRecurringUnknownMerchants, normalizeMerchantName } from './merchantRules.ts';

function transaction(title, options = {}) {
  return {
    id: title,
    title,
    amount: 12,
    category: options.category ?? 'Other',
    kind: options.kind ?? 'expense',
    date: '2026-11-01',
    source: options.source ?? 'csv',
  };
}

test('normalizes case, accents, spacing, and punctuation for exact merchant labels', () => {
  assert.equal(normalizeMerchantName('Twénté Invest B.V.'), 'twenteinvestbv');
  assert.equal(normalizeMerchantName('TWENTE-INVEST BV'), 'twenteinvestbv');
});

test('applies a saved label to exact normalized expense matches only', () => {
  const rows = [transaction('Twente Invest B.V.'), transaction('Twente Invest BV'), transaction('Twente Investments')];
  const rules = [{ merchantKey: 'twenteinvestbv', merchantName: 'Twente Invest B.V.', category: 'Investing' }];
  assert.deepEqual(applyMerchantRules(rows, rules).map((row) => row.category), ['Investing', 'Investing', 'Other']);
});

test('finds recurring unknown CSV expenses and excludes one-offs, income, and non-CSV rows', () => {
  const rows = [
    transaction('Twente Invest B.V.'),
    transaction('TWENTE INVEST BV'),
    transaction('Coffee Shop'),
    transaction('Salary', { kind: 'income' }),
    transaction('Unknown manual entry', { source: 'manual' }),
  ];
  assert.deepEqual(findRecurringUnknownMerchants(rows), [
    { merchantKey: 'twenteinvestbv', merchantName: 'Twente Invest B.V.', count: 2, category: null },
  ]);
});

test('does not ask again for a recurring merchant that already has a saved Other label', () => {
  const rows = [transaction('Twente Invest B.V.'), transaction('TWENTE INVEST BV')];
  const rules = [{ merchantKey: 'twenteinvestbv', merchantName: 'Twente Invest B.V.', category: 'Other' }];
  assert.deepEqual(findRecurringUnknownMerchants(rows, rules), []);
});

test('applies a chosen category to every matching imported row', () => {
  const rows = [transaction('Twente Invest B.V.'), transaction('TWENTE INVEST BV'), transaction('Other Shop')];
  assert.deepEqual(applyMerchantCategory(rows, 'twenteinvestbv', 'Investing').map((row) => row.category), ['Investing', 'Investing', 'Other']);
});
