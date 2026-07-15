# IELTS Speaking Partner

An AI-powered IELTS speaking practice app. Students speak into the mic, an AI examiner (Gemini) replies with follow-up questions, and the app provides real-time band scores, grammar corrections, and vocabulary upgrade suggestions after each turn.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ielts-speaking-partner run dev` — run the frontend (port 21155)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + Wouter routing
- API: Express 5
- AI: Google Gemini (`@google/genai`) via `GEMINI_API_KEY`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- PWA: vite-plugin-pwa (installable, offline-capable)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/api-zod/` — generated Zod schemas (used by server for validation)
- `lib/api-client-react/` — generated React Query hooks (used by frontend)
- `artifacts/api-server/src/lib/gemini.ts` — Gemini client + IELTS examiner system prompt
- `artifacts/api-server/src/routes/gemini/` — chat endpoint
- `artifacts/ielts-speaking-partner/src/hooks/use-ielts-conversation.ts` — core voice conversation state machine
- `artifacts/ielts-speaking-partner/src/lib/mock-test-bank.ts` — IELTS mock test cue cards
- `artifacts/ielts-speaking-partner/src/lib/free-practice-topics.ts` — topic list for free practice mode

## Architecture decisions

- Gemini structured JSON output (`responseMimeType: "application/json"`) for reliable band score + correction parsing
- `thinkingBudget: 0` on Gemini to minimize latency for real-time conversation
- Speech recognition uses Web Speech API (browser-native, no third-party service)
- TTS uses `window.speechSynthesis` (browser-native)
- PWA-enabled so users can install to homescreen

## Product

Two modes:
1. **Free Practice** — pick a topic (Hometown, Technology, etc.) or open-ended; speak freely with the AI examiner
2. **Mock Test** — full IELTS Part 1 / Part 2 / Part 3 flow with timed cue card and stage transitions

After each student turn, the app shows: band scores (fluency, lexical resource, grammar, pronunciation), a grammar correction, a band upgrade rephrasing, and 1–2 vocabulary upgrades.

## User preferences

_Populated as the project evolves._

## Gotchas

- `GEMINI_API_KEY` must be set — the API server throws at startup without it
- `gemini.ts` uses `gemini-flash-lite-latest` model with `thinkingBudget: 0` for low latency
- Browser Speech Recognition requires HTTPS or localhost — won't work on plain HTTP
- Vite proxy in dev mode forwards `/api` → `http://localhost:8080`
