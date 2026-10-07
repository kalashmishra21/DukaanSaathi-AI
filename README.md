# DukaanSaathi AI

A voice-first AI copilot for Indian kirana stores and small retailers. The project is being built for the Gnani AI internship competition, with a focus on inventory, khata, and sales through natural conversation.

## Current status

Phase 2 adds a responsive landing page with the original 3D Saathi Core, a merchant workspace at `/app`, and an interactive mock assistant at `/app/assistant`. The assistant demonstrates deterministic inventory and khata requests through the local mock provider. Its action cards are previews: no inventory or khata data is stored or changed. The other workspace sections establish navigation and layout only.

The foundation includes a typed AI provider interface, Zod tool-call schemas, and trusted server-tool contracts. The Saathi Core uses a lightweight static fallback on mobile, when reduced motion is preferred, or when WebGL is unavailable.

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

Next.js, React, TypeScript, Tailwind CSS, React Three Fiber, Three.js, Zod, and Vitest form the current application. Later phases may add Supabase for data and authentication, Gnani Prisma for transcription, Evon for reasoning, and Timbre for speech. The current microphone control demonstrates voice states without recording audio. All live integrations require separate implementation and verification.

The tool flow and trust rules are in [docs/architecture.md](docs/architecture.md). Visual decisions are governed by [DESIGN.md](DESIGN.md).
