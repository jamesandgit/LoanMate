# LoanMate

Australian mortgage and loan calculator — installable on any device, works offline, no signup.

![PWA](https://img.shields.io/badge/PWA-ready-1A2B52?style=flat-square)
![No build step](https://img.shields.io/badge/build-none-c9a479?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-47505e?style=flat-square)
![Offline](https://img.shields.io/badge/offline-yes-5a716c?style=flat-square)

LoanMate is a single-page Progressive Web App that helps Australian buyers and homeowners answer the questions a calculator should answer in five seconds: *what's my repayment*, *when do I finish*, *what's the stamp duty*, *how much can I borrow*, and *how much LMI will I pay*.

It runs as a static page (open `index.html`), installs as a native-feeling app on iOS and Android, and keeps working when you're offline.

## Features

- **Loan calculator (unified)** — one tab handles it all:
  - *New loan*: repayments at monthly / fortnightly / weekly frequency, P&I or interest-only, finish date, rate comparison (Bank A vs Bank B with a winner badge)
  - *Existing loan*: enter balance + what you actually pay → time remaining, finish date, interest remaining, plus a lender-interest-charge verifier that back-solves your effective offset from a statement
  - Offset account, steady extras, dated one-off / recurring extra repayments, rate-change stress tests, interest-only periods, property value / LVR / equity tracking
  - Live SVG chart and full amortisation schedule (yearly or monthly), rendered from the same simulation as every headline number
  - Savings split into *by offset*, *by extras*, and *combined* — in dollars **and** time
- **Stamp duty** — all eight Australian states and territories with proper tiered scales; owner-occupier / investor / first-home-buyer toggle, with FHB concessions applied for NSW, VIC, QLD, WA, SA, TAS, ACT, NT
- **Borrowing power** — uses ATO 2024–25 resident tax brackets, dependant adjustments, and an APRA-style serviceability buffer
- **LMI estimator** — six LVR bands × six loan-size tiers, modelled on industry-standard premium grids
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

- **Loan** runs a single month-by-month simulation (`simulateScenario`) — interest accrues on `balance − offset`, dated extra repayments and rate changes apply as events, and every output (repayment, payoff time, chart, schedule, savings) is a view of the same simulation. The contractual repayment for a new loan is the standard amortising amount `P = L · r / (1 − (1+r)^−n)`; savings are decomposed against a no-offset / no-extras baseline
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
