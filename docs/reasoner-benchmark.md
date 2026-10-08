# Phase 5 reasoner benchmark

Run on 2026-10-08 against OpenRouter's live free model IDs. All three saw the same ten synthetic Hindi, Hinglish, and English merchant commands: stock increases and decreases, product stock checks, khata balance and credit, and today's sales. Requests carried five proposed tool definitions. The script only evaluated responses with the existing Zod tool-call schema; it did not connect to Supabase or execute any business tool. Latency excludes API errors.

| Free model ID | Correct intent + arguments | Schema-valid single tool calls | API errors | Average / p50 success latency |
| --- | ---: | ---: | ---: | ---: |
| `google/gemma-4-26b-a4b-it:free` | 0/10 | 0/10 | 10 × HTTP 429 | n/a |
| `google/gemma-4-31b-it:free` | 1/10 | 1/10 | 9 × HTTP 429 | 2.2s / 2.2s (one success) |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 8/10 | 8/10 | 0 | 5.8s / 4.6s |

Nemotron was the only route reliably available during this run. Two responses contained text but no tool call. A five-case probe with `tool_choice=required` still produced only two valid tool calls, so the application treats absent calls as unsupported and never invents an action. Free endpoint availability can change; this is a small, time-specific comparison, not a general model ranking. The selected model remains configurable with `OPENROUTER_MODEL` and must end in `:free`.
