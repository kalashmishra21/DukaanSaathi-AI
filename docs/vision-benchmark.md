# Phase 6 free vision check

Three synthetic shopping-list PNGs (English, Hinglish, and mixed Hindi numerals) were sent to each listed free model with the same extraction prompt. Outputs had to parse through the shopping-list Zod schema and match the written items and quantities. This comparison made no store mutations.

| Free model | Correct / 3 | Observed issue |
| --- | ---: | --- |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 0 | HTTP 200 responses carried no text; a provider error reported worker capacity exhaustion. |
| `google/gemma-4-31b-it:free` | 0 | All three requests returned HTTP 429. |
| `dots-studio/dots-3-note-preview:free` | 1 | English list correct; two requests returned no text. |

Dots 3 Note is the configurable default because it was the only free vision model in this comparison to return a correct structured list. A later live browser check extracted the English PNG and a scanned PDF successfully. Availability remains inconsistent; the app reports failures and never records a sale from an unread list. Text PDFs use local PDF.js extraction and do not need vision. Every image result is a draft for human review.
