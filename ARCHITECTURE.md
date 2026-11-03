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
    types.ts
  features/
    transactions/               CSV transaction import and categorization
      csvImport.ts
  integrations/                 Services that communicate with external providers
    gemini/
      geminiClient.ts           Gemini Interactions API transport
  platform/                     Local device capabilities
    storage.ts                  AsyncStorage and SecureStore access
    notifications.ts            Local payment reminder scheduling
  shared/                       Reusable presentation and utilities
    components/
      index.tsx
    formatters.ts
    theme.ts
```

The app shell currently owns the tab-specific presentation and form state. As screens change, move each tab's view into its feature folder while keeping cross-feature coordination in `application/App.tsx`. Bank statements are parsed locally; there is no bank API. PDF parsing and investment features are intentionally not included yet.
