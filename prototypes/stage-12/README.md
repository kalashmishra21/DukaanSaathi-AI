# Stage 12 visual study

This self-contained local preview explores the next DukaanSaathi visual direction. It does not import the application, connect to Supabase, invoke AI providers, or change store data. Serve this directory only on a localhost port to review `index.html`. All examples are illustrative.

Run `npm install` and `npm run build` in this directory, then serve this directory on `127.0.0.1:3101`. The preview uses an isolated Three.js bundle and the MIT-licensed `liquid-gl` package on capable desktop browsers. Mobile, reduced-motion, low-power, and unavailable-WebGL paths keep the SVG core and ordinary readable surfaces. `?fallback` forces the fallback for review. The layered Core cycles through a roughly seven-second illustration of “Maggi ke 20 packet add karo”: voice waveform, extracted product and quantity, action preview, then a simulated stock result. It never requests microphone access, plays audio, or updates a store. A pause control stops the illustrative sequence.

The latest visual evidence is in `evidence/before-round2/` and `evidence/after-round2/`. The latter includes both themes at desktop and mobile widths, state captures, and `saathi-core-automatic-final.webm`, a 25-second recording. These local evidence files are ignored by Git. `qa.playwright.js` reproduces the viewport, state and fallback checks with the installed Playwright CLI. See `engineering-review.md` for the SEO and trusted-action audit.

The files are intentionally separate from `src/app`; production integration requires visual approval.
