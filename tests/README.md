# Testing Strategy

This suite exercises the most critical layers of the app before promotion to production:

- **Utilities** – pure helpers such as date formatting/parsing receive deterministic unit tests.
- **Context Providers** – Receipts state transitions (optimistic adds, retries, delete) are covered with mocked storage calls to ensure reducers and status flags stay consistent.
- **API Routes** – Vercel handlers for auth and receipts are validated with mocked database/auth layers to guarantee correct HTTP semantics and error handling.
- **Components** – Key interactive surfaces (ReceiptScanner, Dashboard) include behavioural tests for user flows leveraging the contexts above.

Run `npm test` locally or in CI for fast feedback. Use `npm run test:coverage` to generate an HTML/text coverage report before deploys.
