# Finance Bro

A local-first personal finance app for iOS and Android. It has no account or sign-in flow. The initial sample transactions are clearly marked demo data and can be cleared from Settings.

## First-stage functions

- Track income and expenses, categorize transactions, and import bank transactions from CSV with a review step.
- Compare category budgets with actual spending and view monthly charts and transaction history.
- Ask the advisor questions about spending and calculations. Deterministic budget insights work locally; Gemini chat is optional and requires a Gemini API key.
- Save wishlist goals and track progress toward each target.
- Set payment reminders and local notifications. The app never initiates payments or enables autopay.
- Save finance records on this device. The Gemini API key is held in the platform secure store. When Gemini is enabled and used, the advisor sends your question, the recent chat messages, and a compact financial summary to Google's API. Merchant and transaction descriptions are not sent. Do not enable it unless you are comfortable with that data leaving the device.

## Run on a phone

Requirements: Node.js 22.13 or newer and Expo Go on your phone. This project targets Expo SDK 58 to match the current iPhone App Store version of Expo Go.

In Windows PowerShell, start the already-installed project with:

```powershell
npm.cmd run start
```

Open Expo Go on your phone and scan the terminal QR code. Keep the phone and computer on the same Wi-Fi network. This repository uses a pnpm lockfile; on a fresh checkout, install pnpm dependencies with `pnpm install` before starting the app.

Local reminder notifications are supported in Expo Go. Create a development build for a standalone install or store release.

## Bank statement CSV format

Export transactions as CSV from your bank. The importer recognizes common English and Dutch headings such as `Date/Datum`, `Description/Omschrijving`, `Amount/Bedrag`, and separate `Debit/Af` or `Credit/Bij` columns. It supports comma or semicolon delimiters, previews the parsed rows, and only adds them after you confirm. PDF statements are not parsed in this first build.

## Design

Light steel blue and onyx grey form the base palette. Scarlet `#FF2400` highlights primary actions and important spending signals. The pixel buddy is the advisor mascot.

## Open-source license

MIT. See [LICENSE](LICENSE).
