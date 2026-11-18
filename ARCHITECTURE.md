# Finance Bro architecture

The project uses feature-oriented folders with explicit boundaries for platform services and external integrations.

```text
App.tsx                         Expo entry re-export
index.js                       Registers the root component with Expo
src/
  application/                  App state, tab composition, and screen coordination
    App.tsx
    styles.ts
  data/                         Demo and seed records
    demoData.ts
  domain/                       Shared finance and UI types
    types.ts                    Canonical finance and transaction types, including source metadata
  features/
    transactions/               CSV transaction import and categorization
      csvImport.ts
      merchantRules.ts         Exact normalized local merchant-category rules
  integrations/                 Services that communicate with external providers
    gemini/
      geminiClient.ts           Gemini Interactions API transport
  platform/                     Local device capabilities
    storage.ts                  AsyncStorage and SecureStore access
    notifications.ts            Local payment reminder scheduling
  widgets/                      Isolated native widget entry points
    QuickAddWidget.ios.tsx      iOS home-screen entry into manual expense form
  shared/                       Reusable presentation and utilities
    components/
      index.tsx
    formatters.ts
    theme.ts
```

The app shell currently owns the tab-specific presentation and form state. As screens change, move each tab's view into its feature folder while keeping cross-feature coordination in `application/App.tsx`. Bank statements are parsed locally; there is no bank API. PDF parsing and investment features are intentionally not included yet.

Transactions created by manual entry, CSV import, and demo data carry a source label (`manual`, `csv`, or `demo`). The field is optional so existing locally stored transaction records remain compatible. `notification` is reserved for a future notification capture source.

Merchant category rules are optional data in the same local `AppData` record. During CSV review, repeated uncategorized expense merchants can be assigned a category; the selected category applies to matching rows and future matching CSV or manual entries. Matching normalizes case, accents, spacing, and punctuation, then requires an exact key match; there is no fuzzy matching. Clear data also removes these rules.

The iOS Quick Add widget opens the existing manual transaction sheet through the `financebro://quick-add` deep link. It displays no finance records and does not access app storage. It requires a native development or standalone build; Android widget support is currently disabled.
