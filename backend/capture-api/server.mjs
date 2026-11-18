import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { appendCapture, markCaptureStatus, pullCaptures } from './db.mjs';

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.FINANCE_BRO_API_KEY || '';
const MAX_BODY_BYTES = 16 * 1024;
const VALID_STATUSES = new Set(['pending', 'accepted', 'rejected']);

if (!API_KEY || API_KEY.length < 32) {
  throw new Error('Set FINANCE_BRO_API_KEY to a private value with at least 32 characters before starting the local API.');
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request) {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(API_KEY);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateCapture(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Body must be a JSON object.';
  if (typeof input.captureId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.captureId)) {
    return 'captureId must be a UUID.';
  }
  if (!isCalendarDate(input.transactionDate)) return 'transactionDate must use YYYY-MM-DD and be a valid calendar date.';
  if (typeof input.capturedAt !== 'string' || Number.isNaN(Date.parse(input.capturedAt))) return 'capturedAt must be a valid date-time string.';
  if (typeof input.merchant !== 'string' || !input.merchant.trim() || input.merchant.trim().length > 200) return 'merchant must contain 1 to 200 characters.';
  if (typeof input.amount !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(input.amount) || Number(input.amount) <= 0) {
    return 'amount must be a positive decimal string with up to four decimal places.';
  }
  if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) return 'currency must be a three-letter uppercase code, such as EUR.';
  if (input.type !== 'expense' && input.type !== 'income') return 'type must be expense or income.';
  if (input.deviceName !== undefined && (typeof input.deviceName !== 'string' || input.deviceName.length > 80)) return 'deviceName must be a string up to 80 characters.';

  return null;
}

function normalizedCapture(input) {
  return {
    captureId: input.captureId,
    transactionDate: input.transactionDate,
    capturedAt: input.capturedAt,
    merchant: input.merchant.trim(),
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    deviceName: input.deviceName?.trim() || null,
  };
}

function sameCapture(row, capture) {
  return row.transaction_date === capture.transactionDate
    && row.captured_at === capture.capturedAt
    && row.merchant === capture.merchant
    && row.amount === capture.amount
    && row.currency === capture.currency
    && row.transaction_type === capture.type
    && row.device_name === capture.deviceName;
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (request.method === 'GET' && pathname === '/health') {
    return sendJson(response, 200, { ok: true, service: 'finance-bro-local-capture-api' });
  }

  if (!isAuthorized(request)) return sendJson(response, 401, { error: 'Unauthorized.' });

  if (request.method === 'POST' && pathname === '/v1/captures') {
    if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
      return sendJson(response, 415, { error: 'Content-Type must be application/json.' });
    }

    const input = await readJsonBody(request);
    console.log('Shortcut POST /v1/captures JSON input:');
    console.log(JSON.stringify(input, null, 2));
    const validationError = validateCapture(input);
    if (validationError) return sendJson(response, 400, { error: validationError });

    const capture = normalizedCapture(input);
    const result = appendCapture(capture);
    if (!result.inserted && !sameCapture(result.capture, capture)) {
      return sendJson(response, 409, { error: 'captureId already exists with different transaction data.' });
    }

    return sendJson(response, result.inserted ? 201 : 200, {
      ok: true,
      duplicate: !result.inserted,
      capture: {
        ...capture,
        status: result.capture.status,
        createdAt: result.capture.created_at,
      },
    });
  }

  if (request.method === 'GET' && pathname === '/v1/captures') {
    const status = url.searchParams.get('status') || 'pending';
    if (status !== 'all' && !VALID_STATUSES.has(status)) return sendJson(response, 400, { error: 'status must be pending, accepted, rejected, or all.' });
    const limit = Number(url.searchParams.get('limit') || 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) return sendJson(response, 400, { error: 'limit must be an integer from 1 to 500.' });
    return sendJson(response, 200, {
      captures: pullCaptures({ status: status === 'all' ? null : status, limit }),
    });
  }

  const statusRoute = /^\/v1\/captures\/([0-9a-f-]+)$/i.exec(pathname);
  if (request.method === 'PATCH' && statusRoute) {
    if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
      return sendJson(response, 415, { error: 'Content-Type must be application/json.' });
    }
    const input = await readJsonBody(request);
    if (!input || !['accepted', 'rejected'].includes(input.status)) {
      return sendJson(response, 400, { error: 'status must be accepted or rejected.' });
    }
    if (!markCaptureStatus(statusRoute[1], input.status)) {
      return sendJson(response, 409, { error: 'Capture was not found or is no longer pending.' });
    }
    return sendJson(response, 200, { ok: true, captureId: statusRoute[1], status: input.status });
  }

  return sendJson(response, 404, { error: 'Route not found.' });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'The local API could not process the request.',
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Finance Bro local capture API listening on http://0.0.0.0:${PORT}`);
  console.log('Use /health to confirm the server is reachable; keep this service on your trusted local network.');
});
