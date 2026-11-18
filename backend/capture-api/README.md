# Finance Bro Local Capture API

This local-only service accepts transaction captures from Apple Shortcuts and stores them in a SQLite inbox on this PC. It does not write into the Finance Bro app's on-device storage. No cloud account or third-party package is used. The project is under OneDrive, so the live database and API key are deliberately stored under Windows Local AppData instead of the project folder.

## Requirements

- Node.js 22.13 or newer (`node:sqlite` is built into Node).
- The iPhone and PC on the same trusted Wi-Fi network while sending captures.

## Start the API

From PowerShell, in this folder:

```powershell
$captureDataFolder = Join-Path $env:LOCALAPPDATA 'FinanceBro\capture-api'
New-Item -ItemType Directory -Force -Path $captureDataFolder | Out-Null
Copy-Item .env.example (Join-Path $captureDataFolder '.env')
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `%LOCALAPPDATA%\FinanceBro\capture-api\.env` as `FINANCE_BRO_API_KEY`. Keep this file private; it is outside the OneDrive project and ignored by Git patterns. The value must be at least 32 characters. The API key is required for capture, list, and status routes.

Start the service:

```powershell
npm.cmd run start
```

The API listens on port `8787` on the PC's network interfaces. The first start creates `%LOCALAPPDATA%\FinanceBro\capture-api\captures.sqlite` and initializes its table from `schema.sql`. If Windows Firewall asks, allow access on your **Private network** only. Do not create a router port-forward for this service.

## Find the Shortcut URL

Run `ipconfig` in PowerShell and find the IPv4 address under the PC's Wi-Fi adapter. On the iPhone, open this address in Safari to check `/health`:

```text
http://<PC-WIFI-IP>:8787/health
```

Use this URL in the Shortcut's **Get Contents of URL** action for a capture:

```text
http://<PC-WIFI-IP>:8787/v1/captures
```

Use the PC's LAN IPv4 address, not `localhost` or `127.0.0.1`. The server needs to be running, and both devices need to be on the same Wi-Fi. This HTTP setup is for fake/test data on a trusted network; HTTP does not encrypt the request.

## Shortcut request

- Method: `POST`
- Headers:
  - Key `Authorization`, value `Bearer <the same API key from .env>`
  - Key `Content-Type`, value `application/json`
- Request body type: JSON

Example body (replace the sample values; generate a new UUID for each capture):

```json
{
  "captureId": "5a1af35d-2357-4b4e-9c2d-22a816b4726a",
  "transactionDate": "2026-11-18",
  "capturedAt": "2026-11-18T12:30:00Z",
  "merchant": "Example Shop",
  "amount": "4.25",
  "currency": "EUR",
  "type": "expense",
  "deviceName": "iPhone"
}
```

`transactionDate` is the date of the transaction (`YYYY-MM-DD`); `capturedAt` is when the Shortcut ran (ISO 8601). Keep amount as a positive decimal string and use `type` to distinguish `expense` from `income`. `deviceName` is optional.

The API validates the fields, saves a new capture with `pending` status, and returns its ID. Repeating the same capture ID with identical data is safe; reusing it with different data returns a conflict.

## Local inbox routes

All routes except `/health` require the same `Authorization` header.

- `GET /v1/captures` — list pending captures.
- `GET /v1/captures?status=all` — list all captures.
- `GET /v1/captures?status=accepted` — list accepted captures.
- `PATCH /v1/captures/<captureId>` with `{"status":"accepted"}` or `{"status":"rejected"}` — resolve a pending capture.

These are for local inspection and workflow development. Finance Bro app sync is not included yet.

## Local data and privacy

- SQLite file: `%LOCALAPPDATA%\FinanceBro\capture-api\captures.sqlite`.
- Local API key: `%LOCALAPPDATA%\FinanceBro\capture-api\.env`.
- Both are outside the OneDrive project and are not tracked by Git.
- Captures in this database are separate from the app's existing on-device records. Deleting this SQLite file deletes the capture inbox; it does not delete app data.
- The API binds to the PC's LAN interfaces. Keep it on a trusted private network and stop it when you are done testing.
