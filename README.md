# DukaanSaathi AI

A voice-first AI copilot for Indian kirana stores and small retailers, built for the Gnani AI internship competition. It combines a premium Next.js workspace with mock Hindi/Hinglish intent recognition and trusted store operations.

## Current scope

The landing page, Saathi Core, and assistant work without paid AI services. With a Supabase project configured, a signed-in shop owner can add, edit and archive products, adjust stock, manage customer khata, record sales, and view a data-derived overview. The mock assistant recognizes a small set of deterministic phrases and sends validated intents to server tools. **Gnani Prisma, Evon and Timbre are not connected, and no Gnani credits are used.** Orders, real speech input, and production deployment are later work.

## Local setup

Requires Node.js 20.9+ and npm. Run `npm install`, then `npm run dev`. The app uses [http://localhost:3100](http://localhost:3100). Without Supabase variables, landing and mock preview work while the workspace shows a clear setup state.

For real store data:

1. Create a Supabase project. Copy its project URL and **public anon/publishable key** into a local `.env.local` using the names in [`.env.example`](.env.example). Never use a service-role key in the browser or commit credentials.
2. Run [the initial SQL migration](supabase/migrations/20261007000100_initial_business.sql), then [the hardening migration](supabase/migrations/20261008071313_hardening_indexes.sql), in the Supabase SQL Editor. They create tables, RLS policies, atomic stock and sale functions, an opt-in synthetic demo seed, and supporting indexes.
3. In Supabase Authentication URL settings, set the site URL to `http://localhost:3100` and allow `http://localhost:3100/auth/callback` as a redirect URL. Enable email/password sign-in. A hosted project may require email confirmation before first sign-in.
4. Start or restart the app, create an account or sign in at `/signin`, then choose **Create demo shop** in the workspace. This action seeds one private, repeatable synthetic shop for your account.

The seed contains fictional products and customers and no phone numbers. The seed function is idempotent for the same owner and shop name. No service-role key is required.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are the code checks. The default tests are offline; an embedded PostgreSQL test runs the SQL migration and verifies RLS, stock operations, and sale rollback without a Supabase account. A live Supabase browser flow still requires your own project configuration.

Architecture and trust rules: [docs/architecture.md](docs/architecture.md). Visual rules: [DESIGN.md](DESIGN.md).
