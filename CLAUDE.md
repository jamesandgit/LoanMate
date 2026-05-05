# LoanMate

Australian mortgage / loan calculator PWA. Single-page app, vanilla web stack, installable on iOS / Android / desktop, works offline.

## Stack

- No build step, no framework, no `package.json` — plain HTML / CSS / JS served as static files.
- Progressive Web App: [manifest.webmanifest](manifest.webmanifest) + [service-worker.js](service-worker.js) provide install + offline.
- All calculation logic in [app.js](app.js); all UI in [index.html](index.html); all styling in [styles.css](styles.css) (theme palette lives in `:root` CSS variables).

## Project structure

- [index.html](index.html) — markup + tab navigation. Each calculator is a `<section class="panel">` with `id` matching its tab.
- [app.js](app.js) — calculation engines, one per calculator, separated by `=====` comment banners. Field IDs use a per-calculator prefix:
  - `rep-` repayments · `po-` payoff time · `sd-` stamp duty · `bp-` borrowing power · `lmi-` LMI
  - Repayments and Payoff each accept an "extra repayment" input and decompose savings into offset / extra / combined.
- [styles.css](styles.css) — single stylesheet. Theme palette in `:root`; component styles below.
- [manifest.webmanifest](manifest.webmanifest) — PWA install metadata.
- [service-worker.js](service-worker.js) — offline caching.
- [icons/icon.svg](icons/icon.svg) — app icon.

## Domain context

- All calculators target **Australia**: per-state/territory stamp duty + FHB concessions, ATO 2024–25 resident tax brackets, LMI premium grids, APRA-style serviceability buffer.
- This is an **estimator**. Never describe results as financial advice; the in-app `.disclaimer` copy reflects this.

## How to run / verify

- Open `index.html` directly in a browser, or serve the folder with any static server (e.g. `python -m http.server`) to test PWA install + offline behavior.
- No automated tests — there is no test runner. Verify any change by exercising the affected calculator in the browser.

## Conventions worth knowing

- **Bump the `CACHE` constant in [service-worker.js](service-worker.js) after editing any cached asset** (`index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `icons/icon.svg`). Without a bump, the offline cache serves stale files on next load.
- **Theme color is duplicated in five places** — when changing the primary brand/header color, update all of them in one pass:
  1. `:root` variables in [styles.css](styles.css)
  2. Inline brand-mark `<svg>` in [index.html](index.html)
  3. `[icons/icon.svg](icons/icon.svg)` fills
  4. `theme_color` in [manifest.webmanifest](manifest.webmanifest)
  5. `<meta name="theme-color">` in [index.html](index.html)
- New calculators follow the existing pattern: add a `.tab` button + `<section class="panel">` in `index.html`, a calculation function + input listeners in `app.js`, and a final `calc<Name>()` call in the initial-render block at the bottom of `app.js`.
