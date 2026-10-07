# Architecture — Phase 2

## Scope

The repository is a single Next.js App Router application. Phase 2 adds a landing page, 3D Saathi Core, merchant workspace, and interactive assistant demo to the typed AI boundaries and offline mock. It has no database connection, live voice service, or business-tool implementation. This is intentionally sized for a small competition demo, likely fewer than 100 users.

## Intended flow

```text
User
  → text / voice UI
  → AI provider (mock now; Gnani later)
  → structured reasoning / proposed tool call
  → Zod validation on the server
  → trusted business tool
  → trusted data layer (Supabase later)
  → response backed by the tool result
  → optional Timbre speech later
```

For voice, Gnani Prisma will eventually transcribe input. Gnani Evon will eventually reason and select a structured tool call. Gnani Timbre will eventually synthesize the confirmed response. The `AIProvider` interface keeps those integrations behind one boundary; feature code should not import an individual vendor SDK. The current `MockAIProvider` uses explicit fixtures and makes zero network calls. Mock synthesis returns text, not invented audio.

## Trust boundary

The LLM suggests an intent and arguments; it does not mutate data. `toolCallSchema` validates the proposed intent and argument shape. `executeValidatedToolCall` passes only a validated call to a future trusted server executor. The executor must enforce identity, authorization, business rules, and database transactions. Its database result is authoritative. The assistant may claim success **only after** a successful tool result. A failed or unimplemented tool must never be described as complete.

The Phase 2 assistant posts text to `/api/mock/reason`. That server route validates the request and runs `MockAIProvider`; it returns a proposed action and mock response without executing a business tool. The UI labels inventory changes and balance lookups as previews. The microphone control cycles through visual voice states and selects a demo phrase; it does not record audio.

Initial contracts cover `inventory.adjust`, `inventory.getStock`, `khata.getBalance`, `khata.addEntry`, and `sales.getDailySummary`. They define the input boundary, not production behavior or fake stored records.

## Environment

`AI_PROVIDER=mock` is the default and only enabled provider. It requires no Gnani or Supabase credentials. An unsupported provider value fails configuration parsing rather than silently calling a live service. Future live integration must be explicitly authorized and use server-side secrets. Never use a `NEXT_PUBLIC_` variable for a Gnani secret.

## Why mock first

Deterministic offline behavior protects the 5,000 programme credits and lets the team isolate UI and business-tool bugs from model, network, and API bugs. The two initial Hindi/Hinglish scenarios are fixtures, not evidence of broad language coverage or live AI quality.

## Directory map

- `src/app`: landing, workspace and mock API routes, styles, metadata.
- `src/components`: shared layout, landing, assistant, and UI components.
- `src/features/assistant`: reusable voice states and mock response copy.
- `src/lib/ai`: provider interface, schema, mock implementation, factory.
- `src/lib/env`: provider configuration parsing.
- `src/lib/utils`: reusable UI utility.
- `src/server/tools`: trusted tool execution contracts.
- `tests`: deterministic contract and mock checks.

Future feature folders for inventory, khata, sales, and orders and a data module should be created when their first implementation lands; empty folders are avoided.

The Saathi Core is loaded dynamically on capable desktop browsers. Mobile, reduced-motion, and WebGL-unavailable contexts use a CSS fallback with the same product concepts. No external 3D assets or textures are downloaded.
