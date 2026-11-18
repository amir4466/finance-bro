import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const backendDirectory = dirname(fileURLToPath(import.meta.url));
const localDataRoot = process.env.LOCALAPPDATA || join(backendDirectory, 'data');
const defaultDatabasePath = join(localDataRoot, 'FinanceBro', 'capture-api', 'captures.sqlite');
const databasePath = resolve(process.env.FINANCE_BRO_DB_PATH || defaultDatabasePath);

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
database.exec(readFileSync(join(backendDirectory, 'schema.sql'), 'utf8'));

const insertCapture = database.prepare(`
  INSERT INTO captures (
    capture_id,
    transaction_date,
    captured_at,
    merchant,
    amount,
    currency,
    transaction_type,
    device_name
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(capture_id) DO NOTHING
`);

const selectCaptureById = database.prepare('SELECT * FROM captures WHERE capture_id = ?');
const selectCapturesByStatus = database.prepare(`
  SELECT * FROM captures
  WHERE status = ?
  ORDER BY created_at DESC, capture_id DESC
  LIMIT ?
`);
const selectAllCaptures = database.prepare(`
  SELECT * FROM captures
  ORDER BY created_at DESC, capture_id DESC
  LIMIT ?
`);
const updateCaptureStatus = database.prepare(`
  UPDATE captures SET status = ?
  WHERE capture_id = ? AND status = 'pending'
`);

function appendCapture(capture) {
  const result = insertCapture.run(
    capture.captureId,
    capture.transactionDate,
    capture.capturedAt,
    capture.merchant,
    capture.amount,
    capture.currency,
    capture.type,
    capture.deviceName ?? null,
  );

  return {
    inserted: result.changes === 1,
    capture: selectCaptureById.get(capture.captureId),
  };
}

function pullCaptures({ status = 'pending', limit = 100 } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const rows = status
    ? selectCapturesByStatus.all(status, boundedLimit)
    : selectAllCaptures.all(boundedLimit);

  return rows.map((row) => ({
    captureId: row.capture_id,
    transactionDate: row.transaction_date,
    capturedAt: row.captured_at,
    merchant: row.merchant,
    amount: row.amount,
    currency: row.currency,
    type: row.transaction_type,
    deviceName: row.device_name,
    status: row.status,
    createdAt: row.created_at,
  }));
}

function markCaptureStatus(captureId, status) {
  const result = updateCaptureStatus.run(status, captureId);
  return result.changes === 1;
}

export { appendCapture, pullCaptures, markCaptureStatus, databasePath };
