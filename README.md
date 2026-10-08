# DukaanSaathi AI

A voice-first AI copilot for Indian kirana stores and small retailers, built for the Gnani AI internship competition. It combines a Next.js workspace, trusted Supabase store operations, and a mock-first assistant.

## Current scope

The landing page, Saathi Core, and assistant work with `AI_PROVIDER=mock` and use no Gnani credits. With Supabase configured, a signed-in shop owner can manage inventory, khata, sales, and a database-derived overview. The assistant recognizes a small set of deterministic phrases and sends validated intents to trusted server tools. The optional `gnani` mode adds real Prisma STT and Timbre TTS around that same mock intent parser. **Evon inference is not connected.** Live Gnani validation requires a private API key and has not yet been completed.

## Local setup

Requires Node.js 20.9+ and npm. Run `npm install`, then `npm run dev`. The app uses [http://localhost:3100](http://localhost:3100). Without Supabase variables, landing and mock preview work while the workspace shows a clear setup state.

For real store data:

1. Create a Supabase project. Copy its project URL and **public anon/publishable key** into a local `.env.local` using the names in [`.env.example`](.env.example). Never use a service-role key in the browser or commit credentials.
2. Run [the initial SQL migration](supabase/migrations/20261007000100_initial_business.sql), [the hardening migration](supabase/migrations/20261008071313_hardening_indexes.sql), and [the demo reset migration](supabase/migrations/20261008090000_demo_shop_reset.sql), in that order in the Supabase SQL Editor. Already applied migrations must not be rerun. These provide RLS, atomic business functions, richer demo records, and an owner-scoped reset.
3. In Supabase Authentication URL settings, set the site URL to `http://localhost:3100` and allow `http://localhost:3100/auth/callback` as a redirect URL. Enable email/password sign-in. A hosted project may require email confirmation before first sign-in.
4. Start or restart the app, create an account or sign in at `/signin`, then choose **Create demo shop** in the workspace. The overview offers **Reset demo shop** for the signed-in owner. Reset removes that demo shop's current records and creates fresh synthetic samples atomically.

The seed contains eight products, four fictional customers, khata history, four sales, and stock movements. No real phone numbers are included. Bootstrap is idempotent; reset is explicit. No service-role key is required.

## Optional Gnani voice mode

Keep `AI_PROVIDER=mock` during normal development. To enable paid voice requests, place `AI_PROVIDER=gnani` and a private `GNANI_API_KEY` in `.env.local`, then restart the server. This key is read only by server routes. The assistant records up to 12 seconds of microphone audio, sends a short WAV to the server for [Prisma REST transcription](https://docs.gnani.ai/api/STT/speech-to-text), validates the deterministic intent, runs an authenticated trusted tool, then requests a spoken reply from [Timbre REST](https://docs.gnani.ai/api/TTS/tts-inference). If speech fails after a tool succeeds, the text still shows the authoritative result. Evon v3.3 is [officially documented for self-hosting](https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B); no hosted Evon URL is assumed here.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are the code checks. The default tests are offline; an embedded PostgreSQL test runs the SQL migration and verifies RLS, stock operations, and sale rollback without a Supabase account. A live Supabase browser flow still requires your own project configuration.

Architecture and trust rules: [docs/architecture.md](docs/architecture.md). Visual rules: [DESIGN.md](DESIGN.md).
