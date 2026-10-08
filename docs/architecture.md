# Architecture — Phase 3

DukaanSaathi is one Next.js App Router application backed by Supabase Auth and Postgres when configured. It is sized for a small challenge demo. The landing page and deterministic mock AI preview work without credentials; the connected workspace requires a signed-in shop owner.

## Trusted flow

```text
User text → MockAIProvider → structured intent → Zod validation
          → authenticated server tool → owner-scoped Supabase operation
          → authoritative database result → assistant confirmation
```

The mock provider makes no Gnani calls. Future Prisma transcription, Evon reasoning and Timbre speech remain behind the `AIProvider` boundary. The demo microphone only plays a sample phrase; it does not record audio. Only a successful trusted operation may produce a completion claim. Unsupported phrases remain previews.

`/api/mock/reason` validates user text and the mock provider result before calling `BusinessToolExecutor`. That executor has no model or browser database access. Its Supabase repository queries the authenticated owner's shop. The five tool contracts are `inventory.adjust`, `inventory.getStock`, `khata.getBalance`, `khata.addEntry`, and `sales.getDailySummary`. Browser forms post validated actions to `/api/business`; neither route accepts a caller-supplied shop ID.

## Data and transactions

[The initial migration](../supabase/migrations/20261007000100_initial_business.sql) defines profiles, owner shops, products, stock movements, customers, ledger entries, sales, sale items, and reserved AI action records. [The hardening migration](../supabase/migrations/20261008071313_hardening_indexes.sql) restricts profile-trigger execution and adds supporting foreign-key indexes. Apply both in order on a new project. Every table has RLS. Each shop table checks ownership through `auth.uid()`. Cross-shop foreign keys bind child rows to their parent shop. The app uses a public anon/publishable key with cookie-based SSR auth. No service-role key is used.

Stock adjustments, new products with opening stock, and sales run in Postgres functions. A sale locks product rows, checks stock, calculates line totals from stored prices, writes items and movements, and reduces stock in one transaction. An error rolls the whole sale back. Direct Data API writes to sales and movements are revoked, and a trigger blocks direct stock edits. Each security-definer function pins `search_path` and checks owner identity before changing data.

Khata outstanding is derived from entries, never independently edited: `gave` adds to what a customer owes the shop, `received` subtracts. UI calculations use paise to avoid decimal drift; the database stores INR `numeric(12,2)`. The overview reads today's sales using Asia/Kolkata day bounds, low stock from product thresholds, and khata outstanding from ledger entries.

## Demo data and offline tests

`bootstrap_demo_shop()` creates one synthetic private shop after sign-in. It inserts five fictional products, three fictional customers, sample entries, and a sale through the same trusted stock/sale functions. Calling it again for the same owner returns the existing shop. No real phone numbers or personal data are included.

The default test suite has no network dependency. It tests Zod boundaries, tool confirmation behavior, money calculations, and runs the SQL migration in embedded PostgreSQL to verify seeding, ownership, direct-write restrictions, stock changes, and failed-sale rollback. A hosted Supabase project is still needed to verify actual Auth, cookie refresh, Data API, and browser CRUD flows.

## Layout

- `src/lib/supabase`: public configuration and separate browser/server clients.
- `src/proxy.ts`: refreshes cookie sessions for protected routes.
- `src/server/data`: authenticated shop context, reads, and Supabase tool adapter.
- `src/server/tools`: validated trusted business operations.
- `src/lib/business`: action/row schemas, money and ledger calculations.
- `src/app/app` and `src/components/business`: responsive merchant workspace.
- `supabase/migrations`: versioned schema and database functions.

Mock-first development protects Gnani programme credits while isolating UI and business rules from model and API failures. Real Gnani integration requires explicit authorization and must keep keys server-side.
