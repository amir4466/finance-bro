import type { EntryKind, Transaction } from '../../domain/types';
import { makeId, isoDay } from '../../shared/formatters';

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const accountingNegative = /^\s*\(.*\)\s*$/.test(raw);
  let value = raw.trim().replace(/[€$£\s]/g, '').replace(/[()]/g, '');
  if (value.includes(',') && value.includes('.')) {
    value = value.lastIndexOf(',') > value.lastIndexOf('.') ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (value.includes(',')) {
    value = value.replace(',', '.');
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (accountingNegative ? -Math.abs(parsed) : parsed) : 0;
}

function csvRecords(source: string): string[][] {
  const sample = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(field.trim()); field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) records.push(row);
      row = []; field = '';
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) records.push(row);
  return records;
}

function categoryFromDescription(description: string): string {
  const text = description.toLowerCase();
  if (/salary|payroll|wage|loon|salaris|refund|terugbetaling/.test(text)) return 'Income';
  if (/jumbo|albert heijn|ah |lidl|aldi|supermarket|grocery|market|plus supermarkt/.test(text)) return 'Groceries';
  if (/restaurant|cafe|coffee|lunch|dinner|thuisbezorgd|uber eats|deliveroo|bakery/.test(text)) return 'Dining';
  if (/ns |ov-chip|train|bus|tram|metro|uber|bolt|fuel|shell|parking|parkeren/.test(text)) return 'Transport';
  if (/rent|huur|mortgage|hypotheek/.test(text)) return 'Housing';
  if (/netflix|spotify|subscription|abonnement|disney\+|icloud/.test(text)) return 'Subscriptions';
  if (/energy|electric|water|gas|energie|utility/.test(text)) return 'Utilities';
  if (/pharmacy|apotheek|doctor|huisarts|gym|fitness/.test(text)) return 'Health';
  if (/bol\.com|amazon|clothes|kleding|shop/.test(text)) return 'Shopping';
  return 'Other';
}

function parseStatement(source: string): Transaction[] {
  const records = csvRecords(source.replace(/^\uFEFF/, ''));
  if (records.length < 2) throw new Error('This CSV does not contain a header and transaction rows.');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const headers = records[0].map(normalize);
  const find = (patterns: RegExp[]) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  const dateIndex = find([/^date$/, /datum/, /booking date/, /transaction date/]);
  const descriptionIndex = find([/description/, /omschrijving/, /name$/, /merchant/, /counterparty/, /tegenpartij/, /details/]);
  const amountIndex = find([/^amount$/, /bedrag/, /mutatie/, /transaction amount/]);
  const debitIndex = find([/^debit$/, /debit amount/, /afschrijving/, /^af$/, /withdrawal/]);
  const creditIndex = find([/^credit$/, /credit amount/, /bijschrijving/, /^bij$/, /deposit/]);
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error('Could not identify the date, description, and amount columns. Rename the CSV headings to Date/Datum, Description/Omschrijving, and Amount/Bedrag, or add Debit/Af and Credit/Bij columns.');
  }
  const parseDate = (raw: string) => {
    const value = raw.trim();
    const european = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (european) return `${european[3]}-${european[2].padStart(2, '0')}-${european[1].padStart(2, '0')}`;
    const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? isoDay(new Date()) : isoDay(date);
  };
  return records.slice(1).flatMap((row) => {
    const title = row[descriptionIndex]?.trim();
    if (!title) return [];
    const rawAmount = amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0;
    const debit = debitIndex >= 0 ? Math.abs(parseAmount(row[debitIndex])) : 0;
    const credit = creditIndex >= 0 ? Math.abs(parseAmount(row[creditIndex])) : 0;
    if (rawAmount === 0 && debit === 0 && credit === 0) return [];
    let kind: EntryKind;
    let amount: number;
    if (debit > 0 || credit > 0) {
      kind = credit > 0 ? 'income' : 'expense';
      amount = credit > 0 ? credit : debit;
    } else {
      kind = rawAmount < 0 ? 'expense' : 'income';
      amount = Math.abs(rawAmount);
    }
    let category = categoryFromDescription(title);
    if (kind === 'income') category = 'Income';
    return [{ id: makeId(), title, amount, category, kind, date: parseDate(row[dateIndex] ?? '') }];
  });
}
export { parseAmount, csvRecords, categoryFromDescription, parseStatement };
