# DukaanSaathi AI

A voice-first AI copilot for Indian kirana stores and small retailers. The project is being built for the Gnani AI internship competition, with a focus on inventory, khata, and sales through natural conversation.

## Phase 1 status

This foundation includes a Next.js App Router shell, typed AI provider interface, deterministic offline mock, Zod tool-call schemas, and trusted server-tool contracts. The mock recognizes two demonstration requests. No inventory or khata data is stored yet.

**Real Gnani Prisma, Evon, and Timbre integrations are not enabled. No Gnani credits are used in mock mode.** Supabase, authentication, and production business tools are also future work.

## Local setup

Requires Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` in place of `cp`. The environment file is optional for mock mode because `AI_PROVIDER=mock` is the default. Open `http://localhost:3100`. Both `npm run dev` and `npm start` use port 3100.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Technology direction

Next.js, React, TypeScript, Tailwind CSS, Zod, and Vitest form the current foundation. Later phases may add Supabase for data and authentication, Gnani Prisma for transcription, Evon for reasoning, Timbre for speech, a richer assistant workspace, and a purposeful 3D Saathi Core. Those integrations require separate implementation and verification.

The tool flow and trust rules are in [docs/architecture.md](docs/architecture.md). Visual decisions are governed by [DESIGN.md](DESIGN.md).
