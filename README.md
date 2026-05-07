# LoanMate

Australian mortgage and loan calculator — installable on any device, works offline, no signup.

![PWA](https://img.shields.io/badge/PWA-ready-1A2B52?style=flat-square)
![No build step](https://img.shields.io/badge/build-none-c9a479?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-47505e?style=flat-square)
![Offline](https://img.shields.io/badge/offline-yes-5a716c?style=flat-square)

LoanMate is a single-page Progressive Web App that helps Australian buyers and homeowners answer the questions a calculator should answer in five seconds: *what's my repayment*, *when do I finish*, *what's the stamp duty*, *how much can I borrow*, and *how much LMI will I pay*.

It runs as a static page (open `index.html`), installs as a native-feeling app on iOS and Android, and keeps working when you're offline.

## Features

- **Mortgage repayments** — monthly / fortnightly / weekly schedules, with optional offset balance and extra repayments
- **Payoff time** — given a current balance and what you're paying, when does the loan finish? Includes finish date, remaining interest, and a lender-interest-charge verifier that back-solves your effective offset from a statement
- **Stamp duty** — all eight Australian states and territories with proper tiered scales; owner-occupier / investor / first-home-buyer toggle, with FHB concessions applied for NSW, VIC, QLD, WA, SA, TAS, ACT, NT
- **Borrowing power** — uses ATO 2024–25 resident tax brackets, dependant adjustments, and an APRA-style serviceability buffer
- **LMI estimator** — six LVR bands × six loan-size tiers, modelled on industry-standard premium grids
- **Savings breakdown** — Repayments and Payoff each split savings into *by offset*, *by extra repayments*, and *combined*
- **Installable + offline** — service worker caches everything on first load; "Add to Home Screen" makes it look and feel like a native app

## Getting started

LoanMate is a pure static app — no Node, no bundler, no dependencies.

```bash
# Clone
git clone <your-fork-url> loanmate
cd loanmate

# Open directly
open index.html             # macOS
start index.html            # Windows
xdg-open index.html         # Linux

# Or serve over HTTP (required to test PWA install + service worker)
python -m http.server 8000
# then visit http://localhost:8000
```

To install on a phone, open the served URL in Safari (iOS) or Chrome (Android) and choose **Add to Home Screen**. The app will then launch in standalone mode.

## Project structure

```
.
├── index.html              # Markup + tab navigation; one <section> per calculator
├── app.js                  # All calculation engines; field IDs prefixed by calculator
├── styles.css              # Theme palette in :root, components below
├── manifest.webmanifest    # PWA install metadata
├── service-worker.js       # Offline caching (bump CACHE on every asset change)
├── icons/
│   └── icon.svg            # App icon
├── CLAUDE.md               # Notes for AI coding assistants
└── README.md
```

Calculator field IDs follow a per-calculator prefix: `rep-` (repayments), `po-` (payoff), `sd-` (stamp duty), `bp-` (borrowing), `lmi-` (LMI).

## How the calculations work

Each calculator is a small, deterministic function in [app.js](app.js). The math:

- **Repayments** use the standard amortisation formula `P = L · r / (1 − (1+r)^−n)`, with savings decomposed against a no-offset / no-extra baseline so each lever's contribution is meaningful
- **Payoff time** solves the same formula in reverse: `n = ln(P / (P − r·L)) / ln(1 + r)`
- **Stamp duty** uses tiered, per-state scales; FHB concessions phase in/out across published thresholds
- **Borrowing power** computes after-tax monthly income (2024–25 brackets), subtracts living expenses + dependant cost + existing debts, applies an 85% lender buffer, then back-solves for max loan at the assessment rate
- **LMI** is looked up in a 6×6 grid keyed on LVR band and loan-size tier

## Disclaimer

LoanMate provides **estimates only** and is not financial advice. Stamp duty rates, LMI premiums, lender serviceability rules, and tax brackets change — verify any figure with your state revenue office, lender, mortgage broker, or accountant before acting on it. The author accepts no liability for decisions made on the basis of this calculator.

## Browser support

Modern evergreen browsers (Chrome / Edge / Safari / Firefox). PWA install and offline support require a browser with service worker support, which covers virtually all current desktop and mobile browsers.

## Contributing

Pull requests welcome. Two conventions to know:

1. **Bump the cache version** in [service-worker.js](service-worker.js) (`loanmate-vN`) whenever you change a cached asset, or users will be served stale files
2. **Theme colour lives in five places** — the `:root` variables in [styles.css](styles.css), the inline brand-mark SVG in [index.html](index.html), [icons/icon.svg](icons/icon.svg), `theme_color` in [manifest.webmanifest](manifest.webmanifest), and `<meta name="theme-color">` in `index.html`. Update all five together.

There are no automated tests; verify changes in the browser.

## License

TBD — choose a license before publishing publicly. Common choices: MIT (permissive), Apache-2.0 (permissive + patent grant), or no license (all rights reserved by default).
