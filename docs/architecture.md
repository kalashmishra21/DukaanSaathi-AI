# Architecture — Phase 6

DukaanSaathi is one Next.js App Router application backed by Supabase Auth and Postgres when configured. It is sized for a small challenge demo. The landing page and deterministic mock AI preview work without credentials; the connected workspace requires a signed-in shop owner.

## Trusted flow

```text
User text or short voice clip → optional Prisma transcription
          → mock or OpenRouter intent → Zod validation
          → authenticated server tool → owner-scoped Supabase operation
          → authoritative database result → assistant confirmation
          → optional Timbre speech
```

The mock provider makes no network calls. `AI_PROVIDER=gnani` uses official Prisma REST for short WAV transcription and Timbre REST for speech. Separately, `AI_REASONER=openrouter` uses a small deterministic fast path for exact supported merchant phrases, then proposes other intents with a configured free model; `AI_REASONER=mock` preserves the deterministic offline mode. Evon has no configured hosted endpoint. The browser never receives a Gnani or OpenRouter key. A missing, malformed, multiple, or schema-invalid tool proposal cannot reach the business executor. An upstream error does not silently switch to another reasoner or mutate data. Only a successful trusted operation may produce a completion claim.

`/api/assistant/turn` validates user text, short recent conversation context, optional clarification state, and the provider result before calling `BusinessToolExecutor`. The trusted contracts also include `customer.create`, `khata.openAccount`, `inventory.checkList`, and `sales.recordConfirmedBasket`. The pending amount state contains only a customer name; the follow-up amount is parsed and validated before the account is opened. Browser forms post validated actions to `/api/business`; neither route accepts a caller-supplied shop ID. `/api/voice/transcribe` accepts only a short mono WAV from an authenticated owner with a connected shop; it calls Prisma only in Gnani mode. TTS is requested after the trusted tool result is known.

`/api/assistant/attachment` accepts temporary image bytes or browser-extracted PDF text. PDF.js reads text pages locally or renders scanned pages to images; images go through up to three configured free OpenRouter vision models in order, with bounded retries for capacity failures. The model's item list is Zod-validated, then the trusted inventory tool matches exact product names and reads current stock/prices. The result is a draft with available, short and missing rows. Nothing is reserved or sold. If all vision models fail, the route returns an error and does not run the inventory tool; text and voice turns remain independent. A separate `/api/assistant/confirm-sale` request requires explicit user confirmation and runs the existing atomic `record_sale` RPC. Stock and prices are checked again in the database. Uploads are not stored by the app.

## Data and transactions

[The initial migration](../supabase/migrations/20261007000100_initial_business.sql) defines profiles, owner shops, products, stock movements, customers, ledger entries, sales, sale items, and reserved AI action records. [The hardening migration](../supabase/migrations/20261008071313_hardening_indexes.sql) restricts profile-trigger execution and adds supporting foreign-key indexes. Apply both in order on a new project. Every table has RLS. Each shop table checks ownership through `auth.uid()`. Cross-shop foreign keys bind child rows to their parent shop. The app uses a public anon/publishable key with cookie-based SSR auth. No service-role key is used.

Stock adjustments, new products with opening stock, new khata opening, and sales run in Postgres functions. `open_khata_account` inserts a customer and opening `gave` entry in one owner-checked transaction. A sale locks product rows, checks stock, calculates line totals from stored prices, writes items and movements, and reduces stock in one transaction. An error rolls the whole sale back. Direct Data API writes to sales and movements are revoked, and a trigger blocks direct stock edits. Each security-definer function pins `search_path` and checks owner identity before changing data.

Khata outstanding is derived from entries, never independently edited: `gave` adds to what a customer owes the shop, `received` subtracts. UI calculations use paise to avoid decimal drift; the database stores INR `numeric(12,2)`. The overview reads today's sales using Asia/Kolkata day bounds, low stock from product thresholds, and khata outstanding from ledger entries.

## Demo data and offline tests

`bootstrap_demo_shop()` creates one synthetic private shop after sign-in. It inserts eight products, four fictional customers, ledger history, and four sales through the same trusted stock/sale functions. Calling it again for the same owner returns the existing shop. `reset_demo_shop()` is an explicit, owner-scoped transaction that deletes only that owner's named demo shop and recreates its sample records; a failed reseed rolls back the deletion. It does not silently alter existing shops when the migration is applied. No real phone numbers or personal data are included.

The default test suite has no network dependency. It tests Zod boundaries, tool confirmation behavior, money calculations, official Gnani request shapes with a fake transport, and runs the SQL migrations in embedded PostgreSQL to verify seeding, reset, ownership, direct-write restrictions, stock changes, and failed-sale rollback. Hosted Supabase and a private Gnani key are needed for live reset and voice QA.

## Layout

- `src/lib/supabase`: public configuration and separate browser/server clients.
- `src/proxy.ts`: refreshes cookie sessions for protected routes.
- `src/server/data`: authenticated shop context, reads, and Supabase tool adapter.
- `src/server/tools`: validated trusted business operations.
- `src/lib/business`: action/row schemas, money and ledger calculations.
- `src/app/app` and `src/components/business`: responsive merchant workspace.
- `supabase/migrations`: versioned schema and database functions.

Mock-first development protects Gnani programme credits while isolating UI and business rules from model and API failures. Live Gnani voice use is explicitly opt-in and keeps its key server-side.
