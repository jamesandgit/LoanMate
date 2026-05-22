/* ============================================================
   LoanMate — calculation engine + UI logic
   ============================================================ */

const fmt = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
});
const fmt2 = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 2
});
const pct = (n) => `${(n * 100).toFixed(2)}%`;

/* ---------- Help tooltips (tap-to-toggle on touch devices) ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('.help');
  document.querySelectorAll('.help.open').forEach(h => { if (h !== t) h.classList.remove('open'); });
  if (t) {
    e.preventDefault();
    t.classList.toggle('open');
  }
});

/* ---------- Tab switching ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === target));
    SHARE.setTab(target);
  });
});

/* ============================================================
   URL SHARE — serialize all inputs into ?# hash so scenarios
   can be linked / bookmarked / sent to a partner or broker.
   ============================================================ */
const SHARE = (() => {
  // Fields to round-trip, by id. Includes inputs + segmented-control state.
  const FIELDS = [
    'rep-amount','rep-rate','rep-rate2','rep-term','rep-term-months','rep-offset','rep-extra',
    'po-balance','po-rate','po-payment','po-offset','po-extra','po-charge','po-days',
    'el-amount','el-term-years','el-term-months','el-rate','el-start','el-payment',
    'el-offset','el-io-years','el-io-months','el-prop-value','el-prop-growth',
    'bd-amount','bd-rate','bd-term','bd-term-months','bd-offset','bd-extra',
    'sd-price','sd-state',
    'bp-income','bp-expenses','bp-debts','bp-deps','bp-rate','bp-term','bp-term-months',
    'lmi-price','lmi-deposit'
  ];
  const CHECKBOXES = ['el-offset-end'];
  const SEGMENTED = {
    'repFreq':  () => repFreq,
    'poFreq':   () => poFreq,
    'sdBuyer':  () => sdBuyer
  };
  let suppress = false;

  function serialize() {
    const params = new URLSearchParams();
    FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== '' && el.value != null) params.set(id, el.value);
    });
    CHECKBOXES.forEach(id => {
      const el = document.getElementById(id);
      if (el) params.set(id, el.checked ? '1' : '0');
    });
    // Persist whether the compare opt-section is open
    const cmp = document.getElementById('rep-compare-section');
    if (cmp && cmp.open) params.set('cmpOpen', '1');
    params.set('repFreq', repFreq);
    params.set('poFreq',  poFreq);
    params.set('elFreq',  elFreq);
    params.set('elType',  elType);
    params.set('sdBuyer', sdBuyer);
    params.set('bdView',  bdView);
    // Event lists — only serialize if non-empty (keeps the URL clean)
    if (elExtras.length > 0)       params.set('elExtras', JSON.stringify(elExtras));
    if (elRateChanges.length > 0)  params.set('elRates',  JSON.stringify(elRateChanges));
    const active = document.querySelector('.tab.active');
    if (active) params.set('tab', active.dataset.tab);
    return params.toString();
  }

  function updateHash() {
    if (suppress) return;
    const qs = serialize();
    history.replaceState(null, '', '#' + qs);
  }

  function hydrate() {
    if (!location.hash || location.hash.length < 2) return;
    suppress = true;
    try {
      const params = new URLSearchParams(location.hash.slice(1));
      FIELDS.forEach(id => {
        if (params.has(id)) {
          const el = document.getElementById(id);
          if (el) el.value = params.get(id);
        }
      });
      CHECKBOXES.forEach(id => {
        if (params.has(id)) {
          const el = document.getElementById(id);
          if (el) el.checked = params.get(id) === '1';
        }
      });
      if (params.get('cmpOpen') === '1') {
        const cmp = document.getElementById('rep-compare-section');
        if (cmp) cmp.open = true;
      }
      if (params.has('elExtras')) {
        try { elExtras = JSON.parse(params.get('elExtras')) || []; } catch { elExtras = []; }
        renderEventList('el-extras-list', elExtras, 'extra');
      }
      if (params.has('elRates')) {
        try { elRateChanges = JSON.parse(params.get('elRates')) || []; } catch { elRateChanges = []; }
        renderEventList('el-rates-list', elRateChanges, 'rate');
      }
      if (params.has('repFreq')) clickSeg('#repayments', 'data-freq',   params.get('repFreq'));
      if (params.has('poFreq'))  clickSeg('#payoff',     'data-pofreq', params.get('poFreq'));
      if (params.has('elFreq'))  clickSeg('#myloan',     'data-elfreq', params.get('elFreq'));
      if (params.has('elType'))  clickSeg('#myloan',     'data-eltype', params.get('elType'));
      if (params.has('sdBuyer')) clickSeg('#stamp',      'data-buyer',  params.get('sdBuyer'));
      if (params.has('bdView'))  clickSeg('#breakdown',  'data-bdview', params.get('bdView'));
      if (params.has('tab')) {
        const tabBtn = document.querySelector(`.tab[data-tab="${params.get('tab')}"]`);
        if (tabBtn) tabBtn.click();
      }
    } finally {
      suppress = false;
    }
  }

  function clickSeg(scope, attr, val) {
    const btn = document.querySelector(`${scope} [${attr}="${val}"]`);
    if (btn) btn.click();
  }

  function setTab(_id) { updateHash(); }

  async function copyLink() {
    const url = location.origin + location.pathname + '#' + serialize();
    try {
      await navigator.clipboard.writeText(url);
      flashToast('Link copied to clipboard');
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); flashToast('Link copied'); }
      catch { flashToast('Could not copy — copy the URL bar'); }
      document.body.removeChild(ta);
    }
    const btn = document.getElementById('share-btn');
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1200);
  }

  function flashToast(msg) {
    let t = document.querySelector('.share-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'share-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // Update hash on any input change (debounced)
  let debounce;
  document.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(updateHash, 250);
  });

  document.getElementById('share-btn').addEventListener('click', copyLink);

  return { hydrate, updateHash, setTab };
})();

/* ---------- Generic helpers ---------- */
function pmt(principal, annualRate, years, periodsPerYear = 12) {
  const r = annualRate / periodsPerYear;
  const n = years * periodsPerYear;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function totalPaid(payment, years, periodsPerYear = 12) {
  return payment * years * periodsPerYear;
}

/* ============================================================
   1. REPAYMENTS CALCULATOR
   ============================================================ */
const repIds = ['rep-amount', 'rep-rate', 'rep-term', 'rep-term-months', 'rep-offset', 'rep-extra', 'rep-rate2'];
let repFreq = 'monthly';

document.querySelectorAll('#repayments .seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#repayments .seg').forEach(b => b.classList.toggle('active', b === btn));
    repFreq = btn.dataset.freq;
    document.getElementById('rep-freq-label').textContent =
      repFreq === 'monthly' ? '/ month' :
      repFreq === 'fortnightly' ? '/ fortnight' : '/ week';
    calcRepayments();
  });
});

function calcRepayments() {
  const amount = +document.getElementById('rep-amount').value || 0;
  const rate   = (+document.getElementById('rep-rate').value || 0) / 100;
  const termY  = +document.getElementById('rep-term').value || 0;
  const termM  = +document.getElementById('rep-term-months').value || 0;
  const term   = Math.max(1/12, termY + termM / 12);  // fractional years
  const offset = +document.getElementById('rep-offset').value || 0;
  const extra  = +document.getElementById('rep-extra').value || 0;

  if (amount <= 0) return;

  const periodsPerYear = repFreq === 'monthly' ? 12 : repFreq === 'fortnightly' ? 26 : 52;
  const r = rate / periodsPerYear;
  const basePayment = pmt(amount, rate, term, periodsPerYear);
  const payWithExtra = basePayment + extra;
  const effective = Math.max(amount - offset, 0);

  // Actual scenario (current offset + extra)
  const actualPeriods = solvePeriods(effective, payWithExtra, r);
  const actualInterest = payWithExtra * actualPeriods - (amount - offset);
  const actualCost = payWithExtra * actualPeriods;

  document.getElementById('rep-payment').textContent = fmt2.format(payWithExtra);
  document.getElementById('rep-interest').textContent = fmt.format(actualInterest);
  document.getElementById('rep-total').textContent = fmt.format(actualCost);

  // Finish date + actual term
  const actualMonths = actualPeriods * 12 / periodsPerYear;
  document.getElementById('rep-actual-term').textContent = formatMonths(actualMonths);
  if (isFinite(actualMonths) && actualMonths > 0) {
    const finish = new Date();
    finish.setMonth(finish.getMonth() + Math.round(actualMonths));
    document.getElementById('rep-finish').textContent =
      finish.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
  } else {
    document.getElementById('rep-finish').textContent = '—';
  }

  // Baseline: no offset, no extra
  const baseInterest = basePayment * term * periodsPerYear - amount;

  // With offset only
  const offsetOnlyPeriods = solvePeriods(effective, basePayment, r);
  const offsetOnlyInterest = basePayment * offsetOnlyPeriods - (amount - offset);
  const savedByOffset = baseInterest - offsetOnlyInterest;

  // With extra only
  const extraOnlyPeriods = solvePeriods(amount, payWithExtra, r);
  const extraOnlyInterest = payWithExtra * extraOnlyPeriods - amount;
  const savedByExtra = baseInterest - extraOnlyInterest;

  // Combined
  const combined = baseInterest - actualInterest;

  showSavingsMoney('rep-saved-offset', offset > 0 && savedByOffset > 0, savedByOffset);
  showSavingsMoney('rep-saved-extra',  extra > 0 && savedByExtra > 0, savedByExtra);
  showSavingsMoney('rep-saved-combined', (offset > 0 || extra > 0) && combined > 0, combined);
  document.getElementById('rep-empty').hidden = (offset > 0 || extra > 0);

  // ---- Compare another rate ----
  const compareOpen = document.getElementById('rep-compare-section').open;
  const rate2 = (+document.getElementById('rep-rate2').value || 0) / 100;
  const comparePanel = document.getElementById('rep-compare-panel');
  const comparePill  = document.getElementById('rep-compare-pill');

  if (compareOpen && rate2 > 0) {
    // Run Bank B scenario with same loan amount, term, offset, extra, frequency
    const basePaymentB  = pmt(amount, rate2, term, periodsPerYear);
    const payWithExtraB = basePaymentB + extra;
    const rB            = rate2 / periodsPerYear;
    const actualPeriodsB = solvePeriods(effective, payWithExtraB, rB);
    const actualInterestB = payWithExtraB * actualPeriodsB - (amount - offset);
    const actualCostB     = payWithExtraB * actualPeriodsB;

    // A is the user's primary rate (computed earlier in this function)
    document.getElementById('rep-compare-rateA').textContent = (rate * 100).toFixed(2) + '%';
    document.getElementById('rep-compare-rateB').textContent = (rate2 * 100).toFixed(2) + '%';
    document.getElementById('rep-compare-payA').textContent  = fmt2.format(payWithExtra);
    document.getElementById('rep-compare-payB').textContent  = fmt2.format(payWithExtraB);
    document.getElementById('rep-compare-intA').textContent  = fmt.format(actualInterest);
    document.getElementById('rep-compare-intB').textContent  = fmt.format(actualInterestB);
    document.getElementById('rep-compare-costA').textContent = fmt.format(actualCost);
    document.getElementById('rep-compare-costB').textContent = fmt.format(actualCostB);

    // Determine winner (lower total interest)
    const bankA = document.getElementById('rep-compare-bankA');
    const bankB = document.getElementById('rep-compare-bankB');
    bankA.classList.remove('winner');
    bankB.classList.remove('winner');
    const cheaperIsB = actualInterestB < actualInterest;
    if (cheaperIsB) bankB.classList.add('winner');
    else if (actualInterest < actualInterestB) bankA.classList.add('winner');

    // Delta
    const intDelta = Math.abs(actualInterest - actualInterestB);
    const payDelta = Math.abs(payWithExtra - payWithExtraB);
    const winnerLabel = cheaperIsB ? 'The lower rate' : 'Your current rate';
    document.getElementById('rep-delta-headline').innerHTML =
      intDelta < 1
        ? `Both rates produce the same total cost.`
        : `${winnerLabel} saves <strong>${fmt.format(intDelta)}</strong> over the life of the loan.`;
    document.getElementById('rep-delta-pay').textContent =
      payDelta < 0.005 ? '$0' : (cheaperIsB ? '−' : '+') + fmt2.format(payWithExtraB - payWithExtra).replace('-', '');
    document.getElementById('rep-delta-int').textContent =
      intDelta < 1 ? '$0' : (cheaperIsB ? '−' : '+') + fmt.format(actualInterestB - actualInterest).replace('-', '');
    document.getElementById('rep-delta-period').textContent =
      repFreq === 'monthly' ? 'month' : repFreq === 'fortnightly' ? 'fortnight' : 'week';

    comparePanel.hidden = false;
    comparePill.hidden  = false;
  } else {
    comparePanel.hidden = true;
    comparePill.hidden  = true;
  }

  // Honesty note when paying fortnightly/weekly — disclose the 48 vs 52 issue.
  const note = document.getElementById('rep-freq-note');
  if (repFreq === 'monthly') {
    note.hidden = true;
  } else {
    const label = repFreq === 'fortnightly' ? 'fortnight' : 'week';
    const lenderWeeks = repFreq === 'fortnightly' ? 24 : 48; // lender "monthly ÷ N" shortcut
    const realWeeks   = repFreq === 'fortnightly' ? 26 : 52;
    const lenderPay   = basePayment * 12 / lenderWeeks;
    note.hidden = false;
    note.innerHTML =
      `<strong>Heads up — ${label}ly repayments don't automatically shorten your loan.</strong> ` +
      `Many lenders simply divide your monthly payment by ${lenderWeeks === 24 ? 2 : 4}, ` +
      `which means a ${label}ly payment of <strong>${fmt2.format(lenderPay)}</strong> (their default) ` +
      `pays exactly the same as monthly. ` +
      `To genuinely save interest, pay <strong>${fmt2.format(payWithExtra)}</strong> per ${label} (monthly × 12 ÷ ${realWeeks}) — ` +
      `that's the figure shown above.`;
  }
}

function solvePeriods(loan, payment, r) {
  if (loan <= 0) return 0;
  if (payment <= loan * r) return Infinity;
  if (r === 0) return loan / payment;
  return Math.log(payment / (payment - loan * r)) / Math.log(1 + r);
}

function showSavingsMoney(id, show, value) {
  const card = document.getElementById(id + '-card');
  card.hidden = !show;
  if (show) document.getElementById(id).textContent = fmt.format(value);
}

repIds.forEach(id => document.getElementById(id).addEventListener('input', calcRepayments));
// Open/close of the compare opt-section should re-run calc so the panel toggles
document.getElementById('rep-compare-section').addEventListener('toggle', calcRepayments);

/* ============================================================
   1b. PAYOFF TIME — solve for time given balance + payment
   ============================================================ */
let poFreq = 'weekly';

document.querySelectorAll('#payoff .seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#payoff .seg').forEach(b => b.classList.toggle('active', b === btn));
    poFreq = btn.dataset.pofreq;
    document.getElementById('po-pay-label').textContent =
      poFreq === 'monthly' ? '/ month' :
      poFreq === 'fortnightly' ? '/ fortnight' : '/ week';
    calcPayoff();
  });
});

function calcPayoff() {
  const balance = +document.getElementById('po-balance').value || 0;
  const rate    = (+document.getElementById('po-rate').value || 0) / 100;
  const pay     = +document.getElementById('po-payment').value || 0;
  const offset  = +document.getElementById('po-offset').value || 0;
  const extra   = +document.getElementById('po-extra').value || 0;
  if (balance <= 0 || pay <= 0) return;

  const periodsPerYear = poFreq === 'monthly' ? 12 : poFreq === 'fortnightly' ? 26 : 52;
  const r = rate / periodsPerYear;
  const effective = Math.max(balance - offset, 0);
  const totalPay = pay + extra;

  const minPay = effective * r;
  if (totalPay <= minPay) {
    document.getElementById('po-time').textContent = 'Never (payment ≤ interest)';
    document.getElementById('po-date').textContent = '—';
    document.getElementById('po-interest').textContent = '—';
    ['po-saved-offset','po-saved-extra','po-saved-combined'].forEach(id => {
      document.getElementById(id + '-card').hidden = true;
    });
    return;
  }

  const periodsBoth = solvePeriods(effective, totalPay, r);
  const monthsBoth  = periodsBoth * 12 / periodsPerYear;
  const interestRemaining = totalPay * periodsBoth - effective;

  document.getElementById('po-time').textContent = formatMonths(monthsBoth);
  document.getElementById('po-interest').textContent = fmt.format(interestRemaining);

  const finishDate = new Date();
  finishDate.setMonth(finishDate.getMonth() + Math.round(monthsBoth));
  document.getElementById('po-date').textContent =
    finishDate.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });

  // Baseline: no offset, no extra (paying just `pay` on full `balance`)
  const periodsBase = solvePeriods(balance, pay, r);
  const monthsBase  = periodsBase * 12 / periodsPerYear;

  // Offset only
  const periodsOff = solvePeriods(effective, pay, r);
  const monthsOff  = periodsOff * 12 / periodsPerYear;
  const savedOffset = monthsBase - monthsOff;

  // Extra only
  const periodsExt = solvePeriods(balance, totalPay, r);
  const monthsExt  = periodsExt * 12 / periodsPerYear;
  const savedExtra = monthsBase - monthsExt;

  // Combined
  const savedCombined = monthsBase - monthsBoth;

  showSavingsTime('po-saved-offset', offset > 0 && isFinite(savedOffset) && savedOffset > 0, savedOffset);
  showSavingsTime('po-saved-extra',  extra > 0 && isFinite(savedExtra)  && savedExtra > 0,  savedExtra);
  showSavingsTime('po-saved-combined',
    (offset > 0 || extra > 0) && isFinite(savedCombined) && savedCombined > 0, savedCombined);
  document.getElementById('po-empty').hidden = (offset > 0 || extra > 0);

  calcImpliedOffset();
}

function showSavingsTime(id, show, months) {
  const card = document.getElementById(id + '-card');
  card.hidden = !show;
  if (show) document.getElementById(id).textContent = formatMonths(months);
}

function calcImpliedOffset() {
  const balance = +document.getElementById('po-balance').value || 0;
  const rate    = (+document.getElementById('po-rate').value || 0) / 100;
  const charge  = +document.getElementById('po-charge').value || 0;
  const days    = +document.getElementById('po-days').value || 30;
  if (balance <= 0 || charge <= 0 || rate <= 0) return;

  const dailyRate = rate / 365;
  const effective = charge / (dailyRate * days);
  const impliedOffset = Math.max(balance - effective, 0);
  document.getElementById('po-implied-offset').textContent = fmt.format(Math.round(impliedOffset));
}

['po-balance','po-rate','po-payment','po-offset','po-extra']
  .forEach(id => document.getElementById(id).addEventListener('input', calcPayoff));
['po-charge','po-days']
  .forEach(id => document.getElementById(id).addEventListener('input', calcImpliedOffset));

/* ============================================================
   2. STAMP DUTY (AU states)
   Simplified scales — verify with state revenue offices.
   ============================================================ */
function tieredDuty(price, tiers) {
  // tiers: [{ upTo, base, ratePer100, threshold }]
  for (const t of tiers) {
    if (price <= t.upTo) {
      return t.base + ((price - t.threshold) * t.ratePer100) / 100;
    }
  }
  const last = tiers[tiers.length - 1];
  return last.base + ((price - last.threshold) * last.ratePer100) / 100;
}

const STAMP_DUTY = {
  NSW: (p) => tieredDuty(p, [
    { upTo: 17000,    threshold: 0,       base: 0,     ratePer100: 1.25 },
    { upTo: 36000,    threshold: 17000,   base: 212,   ratePer100: 1.50 },
    { upTo: 97000,    threshold: 36000,   base: 497,   ratePer100: 1.75 },
    { upTo: 364000,   threshold: 97000,   base: 1564,  ratePer100: 3.50 },
    { upTo: 1212000,  threshold: 364000,  base: 10909, ratePer100: 4.50 },
    { upTo: 3636000,  threshold: 1212000, base: 49069, ratePer100: 5.50 },
    { upTo: Infinity, threshold: 3636000, base: 182390,ratePer100: 7.00 }
  ]),
  VIC: (p) => {
    if (p <= 25000)    return p * 0.014;
    if (p <= 130000)   return 350 + (p - 25000) * 0.024;
    if (p <= 960000)   return 2870 + (p - 130000) * 0.06;
    if (p <= 2000000)  return p * 0.055;
    return 110000 + (p - 2000000) * 0.065;
  },
  QLD: (p) => tieredDuty(p, [
    { upTo: 5000,     threshold: 0,       base: 0,     ratePer100: 0.00 },
    { upTo: 75000,    threshold: 5000,    base: 0,     ratePer100: 1.50 },
    { upTo: 540000,   threshold: 75000,   base: 1050,  ratePer100: 3.50 },
    { upTo: 1000000,  threshold: 540000,  base: 17325, ratePer100: 4.50 },
    { upTo: Infinity, threshold: 1000000, base: 38025, ratePer100: 5.75 }
  ]),
  WA: (p) => tieredDuty(p, [
    { upTo: 120000,   threshold: 0,       base: 0,     ratePer100: 1.90 },
    { upTo: 150000,   threshold: 120000,  base: 2280,  ratePer100: 2.85 },
    { upTo: 360000,   threshold: 150000,  base: 3135,  ratePer100: 3.80 },
    { upTo: 725000,   threshold: 360000,  base: 11115, ratePer100: 4.75 },
    { upTo: Infinity, threshold: 725000,  base: 28453, ratePer100: 5.15 }
  ]),
  SA: (p) => tieredDuty(p, [
    { upTo: 12000,    threshold: 0,       base: 0,     ratePer100: 1.00 },
    { upTo: 30000,    threshold: 12000,   base: 120,   ratePer100: 2.00 },
    { upTo: 50000,    threshold: 30000,   base: 480,   ratePer100: 3.00 },
    { upTo: 100000,   threshold: 50000,   base: 1080,  ratePer100: 3.50 },
    { upTo: 200000,   threshold: 100000,  base: 2830,  ratePer100: 4.00 },
    { upTo: 250000,   threshold: 200000,  base: 6830,  ratePer100: 4.25 },
    { upTo: 300000,   threshold: 250000,  base: 8955,  ratePer100: 4.75 },
    { upTo: 500000,   threshold: 300000,  base: 11330, ratePer100: 5.00 },
    { upTo: Infinity, threshold: 500000,  base: 21330, ratePer100: 5.50 }
  ]),
  TAS: (p) => tieredDuty(p, [
    { upTo: 3000,     threshold: 0,       base: 50,    ratePer100: 0.00 },
    { upTo: 25000,    threshold: 3000,    base: 50,    ratePer100: 1.75 },
    { upTo: 75000,    threshold: 25000,   base: 435,   ratePer100: 2.25 },
    { upTo: 200000,   threshold: 75000,   base: 1560,  ratePer100: 3.50 },
    { upTo: 375000,   threshold: 200000,  base: 5935,  ratePer100: 4.00 },
    { upTo: 725000,   threshold: 375000,  base: 12935, ratePer100: 4.25 },
    { upTo: Infinity, threshold: 725000,  base: 27810, ratePer100: 4.50 }
  ]),
  ACT: (p) => tieredDuty(p, [
    { upTo: 260000,   threshold: 0,       base: 0,     ratePer100: 0.49 },
    { upTo: 300000,   threshold: 260000,  base: 1274,  ratePer100: 2.20 },
    { upTo: 500000,   threshold: 300000,  base: 2154,  ratePer100: 3.40 },
    { upTo: 750000,   threshold: 500000,  base: 8954,  ratePer100: 4.32 },
    { upTo: 1000000,  threshold: 750000,  base: 19754, ratePer100: 5.90 },
    { upTo: 1455000,  threshold: 1000000, base: 34504, ratePer100: 6.40 },
    { upTo: Infinity, threshold: 1455000, base: 63624, ratePer100: 4.54 }
  ]),
  NT: (p) => {
    if (p <= 525000) {
      const v = p / 1000;
      return (0.06571441 * v * v) + 15 * v;
    }
    if (p <= 3000000) return p * 0.0495;
    if (p <= 5000000) return p * 0.0575;
    return p * 0.0595;
  }
};

// First-home-buyer concessions (simplified)
function applyFhbConcession(state, price, duty) {
  switch (state) {
    case 'NSW':
      if (price <= 800000) return 0;
      if (price <= 1000000) return duty * ((price - 800000) / 200000);
      return duty;
    case 'VIC':
      if (price <= 600000) return 0;
      if (price <= 750000) return duty * ((price - 600000) / 150000);
      return duty;
    case 'QLD':
      if (price <= 700000) return 0;
      if (price <= 800000) return duty * ((price - 700000) / 100000);
      return duty;
    case 'WA':
      if (price <= 450000) return 0;
      if (price <= 600000) return duty * ((price - 450000) / 150000);
      return duty;
    case 'SA':
      if (price <= 650000) return 0;
      return duty;
    case 'TAS':
      if (price <= 750000) return duty * 0.5;
      return duty;
    case 'ACT':
      if (price <= 1000000) return 0;
      return duty;
    case 'NT':
      return Math.max(duty - 10000, 0);
    default:
      return duty;
  }
}

let sdBuyer = 'oo';
document.querySelectorAll('#stamp .seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#stamp .seg').forEach(b => b.classList.toggle('active', b === btn));
    sdBuyer = btn.dataset.buyer;
    calcStampDuty();
  });
});

function calcStampDuty() {
  const price = +document.getElementById('sd-price').value || 0;
  const state = document.getElementById('sd-state').value;
  if (price <= 0) return;

  let duty = STAMP_DUTY[state](price);
  let note = 'Estimate only — verify with your state revenue office.';

  if (sdBuyer === 'fhb') {
    const concession = applyFhbConcession(state, price, duty);
    if (concession < duty) note = `First home buyer concession applied (${state}).`;
    duty = concession;
  } else if (sdBuyer === 'inv' && (state === 'NSW' || state === 'VIC')) {
    // Foreign-investor surcharges intentionally excluded; investor duty = same as OO for AU residents.
  }

  document.getElementById('sd-amount').textContent = fmt.format(Math.round(duty));
  document.getElementById('sd-rate').textContent = pct(duty / price);
  document.getElementById('sd-note').textContent = note;
}
['sd-price', 'sd-state'].forEach(id => document.getElementById(id).addEventListener('input', calcStampDuty));

/* ============================================================
   3. BORROWING POWER
   ============================================================ */
function calcBorrowing() {
  const income   = +document.getElementById('bp-income').value || 0;
  const expenses = +document.getElementById('bp-expenses').value || 0;
  const debts    = +document.getElementById('bp-debts').value || 0;
  const deps     = +document.getElementById('bp-deps').value || 0;
  const rate     = (+document.getElementById('bp-rate').value || 0) / 100;
  const termY    = +document.getElementById('bp-term').value || 0;
  const termM    = +document.getElementById('bp-term-months').value || 0;
  const term     = Math.max(1/12, termY + termM / 12);

  if (income <= 0) return;

  // Simplified after-tax calc (AU resident, 2024-25 brackets, no Medicare)
  const netAnnual = afterTax(income);
  const netMonthly = netAnnual / 12;

  const depCost = deps * 400;
  const surplus = netMonthly - expenses - debts - depCost;
  const maxPayment = Math.max(surplus * 0.85, 0); // lender buffer

  const r = rate / 12;
  const n = term * 12;
  const maxLoan = r === 0
    ? maxPayment * n
    : (maxPayment * (1 - Math.pow(1 + r, -n))) / r;

  document.getElementById('bp-amount').textContent = fmt.format(Math.round(maxLoan));
  document.getElementById('bp-payment').textContent = fmt2.format(maxPayment);
}

function afterTax(gross) {
  // 2024-25 stage-3 resident rates
  let tax = 0;
  if (gross > 190000)      tax = 51638 + (gross - 190000) * 0.45;
  else if (gross > 135000) tax = 31288 + (gross - 135000) * 0.37;
  else if (gross > 45000)  tax = 4288  + (gross - 45000)  * 0.30;
  else if (gross > 18200)  tax = (gross - 18200) * 0.16;
  return gross - tax;
}

['bp-income','bp-expenses','bp-debts','bp-deps','bp-rate','bp-term','bp-term-months']
  .forEach(id => document.getElementById(id).addEventListener('input', calcBorrowing));

/* ============================================================
   4. LMI ESTIMATOR
   ============================================================ */
// Simplified LMI premium % grid: rows = LVR band, cols = loan size band.
const LMI_GRID = {
  // LVR > 80% bands
  '81-85': { tiers: [[300000,0.475],[500000,0.568],[600000,0.781],[750000,0.904],[1000000,0.913],[Infinity,1.296]] },
  '85-87': { tiers: [[300000,0.727],[500000,0.969],[600000,1.234],[750000,1.388],[1000000,1.443],[Infinity,1.946]] },
  '87-90': { tiers: [[300000,1.234],[500000,1.622],[600000,1.984],[750000,2.169],[1000000,2.282],[Infinity,2.580]] },
  '90-91': { tiers: [[300000,2.013],[500000,2.518],[600000,3.222],[750000,3.305],[1000000,3.466],[Infinity,3.978]] },
  '91-95': { tiers: [[300000,2.661],[500000,3.351],[600000,3.800],[750000,3.929],[1000000,4.158],[Infinity,4.736]] },
  '95-97': { tiers: [[300000,3.353],[500000,3.881],[600000,4.450],[750000,4.612],[1000000,4.825],[Infinity,5.499]] }
};

function lmiBand(lvr) {
  if (lvr <= 0.80) return null;
  if (lvr <= 0.85) return '81-85';
  if (lvr <= 0.87) return '85-87';
  if (lvr <= 0.90) return '87-90';
  if (lvr <= 0.91) return '90-91';
  if (lvr <= 0.95) return '91-95';
  return '95-97';
}

function calcLMI() {
  const price   = +document.getElementById('lmi-price').value || 0;
  const deposit = +document.getElementById('lmi-deposit').value || 0;
  if (price <= 0) return;

  const loan = Math.max(price - deposit, 0);
  const lvr  = loan / price;

  document.getElementById('lmi-loan').textContent = fmt.format(loan);
  document.getElementById('lmi-lvr').textContent = pct(lvr);

  const band = lmiBand(lvr);
  if (!band) {
    document.getElementById('lmi-amount').textContent = '$0';
    return;
  }
  const grid = LMI_GRID[band];
  let rate = grid.tiers[grid.tiers.length - 1][1];
  for (const [cap, r] of grid.tiers) {
    if (loan <= cap) { rate = r; break; }
  }
  const premium = loan * (rate / 100);
  document.getElementById('lmi-amount').textContent = fmt.format(Math.round(premium));
}
['lmi-price','lmi-deposit'].forEach(id => document.getElementById(id).addEventListener('input', calcLMI));

/* ============================================================
   MY LOAN — existing-loan reconstruction + forward projection.
   Figura-style: progressive disclosure, multi-event extras and
   rate changes, optional property tracking.
   ============================================================ */
let elFreq = 'monthly';
let elType = 'existing';       // 'existing' | 'new'
let elExtras = [];              // [{date:'2025-06', amount:500, freq:'monthly'}]
let elRateChanges = [];         // [{date:'2027-01', rate:5.5}]

function parseYearMonth(str) {
  if (!str) return null;
  const [y, m] = str.split('-').map(Number);
  if (!y || !m) return null;
  return { y, m };
}
function monthsBetween(from, to) {
  if (!from || !to) return 0;
  return (to.y - from.y) * 12 + (to.m - from.m);
}

/* ---------- Segmented controls (frequency + loan type) ---------- */
document.querySelectorAll('#myloan [data-elfreq]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#myloan [data-elfreq]').forEach(b => b.classList.toggle('active', b === btn));
    elFreq = btn.dataset.elfreq;
    calcExistingLoan();
  });
});
document.querySelectorAll('#myloan [data-eltype]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#myloan [data-eltype]').forEach(b => b.classList.toggle('active', b === btn));
    elType = btn.dataset.eltype;
    updateMyLoanModeUI();
    calcExistingLoan();
  });
});

function updateMyLoanModeUI() {
  const termWrap = document.getElementById('el-term-wrap');
  const startWrap = document.getElementById('el-start-wrap');
  const amountLabel = document.getElementById('el-amount-label');
  const paymentLabel = document.getElementById('el-payment-label');
  const paymentInput = document.getElementById('el-payment');

  if (elType === 'existing') {
    termWrap.style.display = 'none';
    startWrap.style.display = 'none';
    amountLabel.textContent = 'Current balance';
    paymentLabel.textContent = 'Repayment amount';
    paymentInput.placeholder = 'e.g. 3500';
  } else {
    termWrap.style.display = '';
    startWrap.style.display = 'none';
    amountLabel.textContent = 'Loan amount';
    paymentLabel.textContent = 'Repayment override';
    paymentInput.placeholder = 'Auto-calculated';
  }
}

/* ---------- Event-list rendering (extras + rate changes) ---------- */
function renderEventList(listId, items, kind) {
  const root = document.getElementById(listId);
  const today = new Date();
  const todayYM = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  root.innerHTML = items.map((it, idx) => {
    if (kind === 'extra') {
      return `<div class="event-item" data-idx="${idx}" data-kind="extra">
        <input type="month" value="${it.date || todayYM}" data-prop="date" aria-label="Date">
        <input type="number" inputmode="decimal" value="${it.amount || 0}" placeholder="Amount $" data-prop="amount" aria-label="Amount">
        <select data-prop="freq" aria-label="Frequency">
          <option value="once" ${it.freq === 'once' ? 'selected' : ''}>One-off</option>
          <option value="weekly" ${it.freq === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="fortnightly" ${it.freq === 'fortnightly' ? 'selected' : ''}>Fortnightly</option>
          <option value="monthly" ${(!it.freq || it.freq === 'monthly') ? 'selected' : ''}>Monthly</option>
          <option value="yearly" ${it.freq === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
        <button type="button" class="remove-event" aria-label="Remove">×</button>
      </div>`;
    }
    return `<div class="event-item" data-idx="${idx}" data-kind="rate">
      <input type="month" value="${it.date || todayYM}" data-prop="date" aria-label="Date">
      <div class="input-suffix" style="grid-column: span 2;">
        <input type="number" inputmode="decimal" step="0.01" value="${it.rate || ''}" placeholder="New rate" data-prop="rate" aria-label="Rate">
        <span>%</span>
      </div>
      <button type="button" class="remove-event" aria-label="Remove">×</button>
    </div>`;
  }).join('');
  // Update count chip
  const countId = kind === 'extra' ? 'el-extras-count' : 'el-rates-count';
  const chip = document.getElementById(countId);
  if (items.length > 0) { chip.hidden = false; chip.textContent = items.length; }
  else { chip.hidden = true; }
}

document.querySelectorAll('#myloan .add-event').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.action === 'add-extra') {
      elExtras.push({ date: '', amount: 500, freq: 'monthly' });
      renderEventList('el-extras-list', elExtras, 'extra');
    } else {
      elRateChanges.push({ date: '', rate: '' });
      renderEventList('el-rates-list', elRateChanges, 'rate');
    }
    calcExistingLoan();
    SHARE.updateHash();
  });
});

// Delegated input + remove handlers for event lists
document.getElementById('myloan').addEventListener('input', (e) => {
  const item = e.target.closest('.event-item');
  if (!item) return;
  const idx = +item.dataset.idx;
  const kind = item.dataset.kind;
  const prop = e.target.dataset.prop;
  const arr = kind === 'extra' ? elExtras : elRateChanges;
  if (!arr[idx]) return;
  arr[idx][prop] = prop === 'amount' || prop === 'rate' ? +e.target.value || '' : e.target.value;
  calcExistingLoan();
});
document.getElementById('myloan').addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-event');
  if (!btn) return;
  const item = btn.closest('.event-item');
  const idx = +item.dataset.idx;
  const kind = item.dataset.kind;
  if (kind === 'extra') { elExtras.splice(idx, 1); renderEventList('el-extras-list', elExtras, 'extra'); }
  else { elRateChanges.splice(idx, 1); renderEventList('el-rates-list', elRateChanges, 'rate'); }
  calcExistingLoan();
  SHARE.updateHash();
});

/* ---------- Core simulator (event-driven) ---------- */
/**
 * @param opts {
 *   amount, baseRate, termMonths, ioMonths,
 *   offset, endWhenOffset,
 *   overridePay,           // 0 = auto
 *   extras: [{date,amount,freq}], rateChanges: [{date,rate}],
 *   startYM   // { y, m } — anchors event dates to month indices
 * }
 */
function simulateScenario(opts) {
  const rows = [];
  let balance = opts.amount;
  let cumInterest = 0;
  let month = 0;
  const totalMonths = opts.termMonths;
  const ioMonths = opts.ioMonths || 0;
  const safetyCap = totalMonths + 720;

  // Pre-translate event dates into month indices from start
  const extrasByMonth = (m) => {
    let sum = 0;
    opts.extras.forEach(ev => {
      if (!ev.amount) return;
      const evDate = parseYearMonth(ev.date);
      if (!evDate) return;
      const evMonth = monthsBetween(opts.startYM, evDate) + 1;  // 1-indexed
      if (evMonth > m) return;
      if (ev.freq === 'once') {
        if (evMonth === m) sum += +ev.amount;
      } else if (ev.freq === 'monthly') {
        sum += +ev.amount;
      } else if (ev.freq === 'fortnightly') {
        sum += +ev.amount * 26 / 12;
      } else if (ev.freq === 'weekly') {
        sum += +ev.amount * 52 / 12;
      } else if (ev.freq === 'yearly') {
        if ((m - evMonth) % 12 === 0) sum += +ev.amount;
      }
    });
    return sum;
  };

  // Sorted rate changes by month index
  const sortedChanges = opts.rateChanges
    .filter(c => c.rate && c.date && parseYearMonth(c.date))
    .map(c => ({ month: monthsBetween(opts.startYM, parseYearMonth(c.date)) + 1, rate: +c.rate / 100 }))
    .sort((a, b) => a.month - b.month);

  let currentRate = opts.baseRate;
  let amortPay = opts.overridePay > 0
    ? opts.overridePay
    : pmt(opts.amount, opts.baseRate, (totalMonths - ioMonths) / 12, 12);

  while (balance > 0.01 && month < safetyCap) {
    month++;

    // Apply any rate changes at this month
    const change = sortedChanges.find(c => c.month === month);
    if (change) {
      currentRate = change.rate;
      if (month > ioMonths && opts.overridePay <= 0) {
        amortPay = pmt(balance, currentRate, Math.max(1, totalMonths - month + 1) / 12, 12);
      }
    }

    const r = currentRate / 12;
    const interestBase = Math.max(balance - opts.offset, 0);
    const interest = interestBase * r;
    const extraThisMonth = extrasByMonth(month);

    // End-when-fully-offset shortcut
    if (opts.endWhenOffset && opts.offset >= balance) break;

    let payment, principal;
    if (month <= ioMonths) {
      // IO — payment covers interest only; extras still hit principal
      payment = interest + extraThisMonth;
      principal = Math.min(extraThisMonth, balance);
    } else {
      payment = amortPay + extraThisMonth;
      principal = payment - interest;
      if (principal <= 0) {
        rows.push({ month, payment, interest, principal: 0, balance, rate: currentRate });
        break;
      }
      if (principal > balance) {
        principal = balance;
        payment = interest + principal;
      }
    }
    balance -= principal;
    cumInterest += interest;
    rows.push({ month, payment, interest, principal, balance, rate: currentRate });
    if (balance <= 0.01) break;
  }
  return { rows, cumInterest, monthsToPayoff: rows.length };
}

/* ---------- Calc entry point ---------- */
function calcExistingLoan() {
  const amount  = +document.getElementById('el-amount').value || 0;
  const yrs     = +document.getElementById('el-term-years').value || 0;
  const moPart  = +document.getElementById('el-term-months').value || 0;
  // In Existing mode, term inputs are hidden — default to 60yr safety cap
  const termMonths = elType === 'existing' ? 720 : Math.max(1, yrs * 12 + moPart);
  const rate    = (+document.getElementById('el-rate').value || 0) / 100;
  const offset  = +document.getElementById('el-offset').value || 0;
  const endWhenOffset = document.getElementById('el-offset-end').checked;
  const overridePay = +document.getElementById('el-payment').value || 0;
  const ioY     = +document.getElementById('el-io-years').value || 0;
  const ioM     = +document.getElementById('el-io-months').value || 0;
  const ioMonths = Math.min(ioY * 12 + ioM, termMonths - 1);
  const propVal = +document.getElementById('el-prop-value').value || 0;
  const propGr  = (+document.getElementById('el-prop-growth').value || 0) / 100;
  if (amount <= 0 || rate <= 0) return;

  // In Existing mode, repayment is required (we don't have a term to derive it from)
  if (elType === 'existing' && overridePay <= 0) {
    document.getElementById('el-current').textContent = '—';
    document.getElementById('el-time-left').textContent = 'Enter repayment ↑';
    document.getElementById('el-finish').textContent = '—';
    document.getElementById('el-interest-future').textContent = '—';
    document.getElementById('el-interest-total').textContent = '—';
    document.getElementById('el-progress-pct').textContent = '—';
    document.getElementById('el-progress-fill').style.width = '0%';
    document.getElementById('el-progress-time').textContent = '—';
    return;
  }

  const startStr = document.getElementById('el-start').value;
  // Existing mode: anchor events to today (we don't track history)
  const startYM  = elType === 'existing'
    ? { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
    : (parseYearMonth(startStr) || { y: new Date().getFullYear(), m: new Date().getMonth() + 1 });

  const today = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  const monthsElapsed = elType === 'new' && parseYearMonth(startStr)
    ? Math.max(0, monthsBetween(parseYearMonth(startStr), today))
    : 0;

  // User's repayment is per their chosen frequency — convert to monthly for the simulator
  const periodsPerYear = elFreq === 'monthly' ? 12 : elFreq === 'fortnightly' ? 26 : 52;
  const monthlyOverride = overridePay > 0 ? overridePay * periodsPerYear / 12 : 0;

  const baseOpts = {
    amount, baseRate: rate, termMonths, ioMonths,
    offset, endWhenOffset,
    overridePay: monthlyOverride,
    extras: elExtras, rateChanges: elRateChanges,
    startYM
  };

  const sim = simulateScenario(baseOpts);

  // Reconstruction only makes sense in New mode with start date provided
  const showReconstruction = elType === 'new' && monthsElapsed > 0;

  const sliceEnd = Math.min(monthsElapsed, sim.rows.length);
  let interestPaidToDate = 0, principalPaidToDate = 0;
  for (let i = 0; i < sliceEnd; i++) {
    interestPaidToDate += sim.rows[i].interest;
    principalPaidToDate += sim.rows[i].principal;
  }
  const currentBalance = showReconstruction && sliceEnd > 0 ? sim.rows[sliceEnd - 1].balance : amount;
  const monthsRemaining = Math.max(0, sim.rows.length - (showReconstruction ? monthsElapsed : 0));
  const interestRemaining = showReconstruction ? sim.cumInterest - interestPaidToDate : sim.cumInterest;
  const pctPaid = showReconstruction ? Math.min(100, (principalPaidToDate / amount) * 100) : 0;

  // Baseline scenarios for "saved by" cards (no offset, no extras, no rate changes)
  const simBase = simulateScenario({ ...baseOpts, offset: 0, extras: [], rateChanges: [] });
  const totalLifeNow = sim.rows.length;
  const totalLifeBase = simBase.rows.length;
  const timeSavedTotal = Math.max(0, totalLifeBase - totalLifeNow);

  let timeSavedOffset = 0, timeSavedExtra = 0;
  if (offset > 0) {
    const simOff = simulateScenario({ ...baseOpts, extras: [] });
    timeSavedOffset = Math.max(0, totalLifeBase - simOff.rows.length);
  }
  if (elExtras.some(e => e.amount > 0)) {
    const simExt = simulateScenario({ ...baseOpts, offset: 0 });
    timeSavedExtra = Math.max(0, totalLifeBase - simExt.rows.length);
  }

  // --- Render ---
  // "Where you are now" section: hide entirely in Existing mode (user already knows)
  // and in New mode without start date.
  const whereSection = document.querySelectorAll('#myloan .section-heading')[0];
  const whereCard = document.getElementById('el-current').closest('.result-card').parentNode;
  // (We can't easily hide individual sub-cards; instead toggle visibility of each card)
  const currentCard = document.getElementById('el-current').closest('.result-card');
  const progressEl  = document.querySelector('#myloan .progress-wrap');
  const histRow     = document.getElementById('el-interest-paid').closest('.result-row');

  if (showReconstruction) {
    if (whereSection) whereSection.style.display = '';
    currentCard.style.display = '';
    progressEl.style.display = '';
    histRow.style.display = '';
    document.getElementById('el-current').textContent = fmt.format(Math.round(currentBalance));
    document.getElementById('el-progress-pct').textContent = pctPaid.toFixed(1) + '%';
    document.getElementById('el-progress-fill').style.width = pctPaid + '%';
    document.getElementById('el-progress-time').textContent = `Month ${monthsElapsed} of ${sim.rows.length}`;
    document.getElementById('el-interest-paid').textContent = fmt.format(interestPaidToDate);
    document.getElementById('el-principal-paid').textContent = fmt.format(principalPaidToDate);
  } else {
    if (whereSection) whereSection.style.display = 'none';
    currentCard.style.display = 'none';
    progressEl.style.display = 'none';
    histRow.style.display = 'none';
  }

  document.getElementById('el-time-left').textContent = formatMonths(monthsRemaining);
  document.getElementById('el-interest-future').textContent = fmt.format(interestRemaining);
  document.getElementById('el-interest-total').textContent = fmt.format(sim.cumInterest);

  if (monthsRemaining > 0) {
    const finish = new Date();
    finish.setMonth(finish.getMonth() + monthsRemaining);
    document.getElementById('el-finish').textContent =
      finish.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
  } else {
    document.getElementById('el-finish').textContent = 'Paid off';
  }

  // Property tracking
  const propRow = document.getElementById('el-property-row');
  if (propVal > 0) {
    // Adjust property value for growth since start
    const yearsElapsed = monthsElapsed / 12;
    const currentPropValue = propVal * Math.pow(1 + propGr, 0);  // value entered IS current
    const equity = Math.max(currentPropValue - currentBalance, 0);
    const lvr = currentBalance / currentPropValue;
    document.getElementById('el-lvr').textContent = (lvr * 100).toFixed(1) + '%';
    document.getElementById('el-equity').textContent = fmt.format(Math.round(equity));
    propRow.hidden = false;
  } else {
    propRow.hidden = true;
  }

  // Offset & property summary chips
  const offsetChip = document.getElementById('el-offset-summary');
  if (offset > 0) { offsetChip.hidden = false; offsetChip.textContent = fmt.format(offset); }
  else { offsetChip.hidden = true; }
  const propChip = document.getElementById('el-prop-summary');
  if (propVal > 0) { propChip.hidden = false; propChip.textContent = fmt.format(propVal); }
  else { propChip.hidden = true; }

  showSavingsTime('el-saved-offset',  offset > 0 && timeSavedOffset > 0, timeSavedOffset);
  showSavingsTime('el-saved-extra',   elExtras.some(e => e.amount > 0) && timeSavedExtra > 0, timeSavedExtra);
  showSavingsTime('el-saved-combined',(offset > 0 || elExtras.some(e => e.amount > 0)) && timeSavedTotal > 0, timeSavedTotal);

  // Disclaimer text
  const flags = [];
  if (offset > 0)              flags.push('constant offset since start');
  if (ioMonths > 0)            flags.push(`${(ioMonths/12).toFixed(1).replace('.0','')}yr IO period`);
  if (elRateChanges.length > 0) flags.push(`${elRateChanges.length} rate change${elRateChanges.length>1?'s':''}`);
  if (elExtras.length > 0)     flags.push(`${elExtras.length} extra transaction${elExtras.length>1?'s':''}`);
  if (overridePay > 0)         flags.push('repayment overridden');
  document.getElementById('el-disclaimer').textContent =
    'Simulation models: ' + (flags.length ? flags.join(' · ') : 'constant rate, no extras, no offset') + '.';
}

['el-amount','el-term-years','el-term-months','el-rate','el-start','el-payment',
 'el-offset','el-offset-end','el-io-years','el-io-months','el-prop-value','el-prop-growth']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcExistingLoan);
    if (el && el.type === 'checkbox') el.addEventListener('change', calcExistingLoan);
  });

/* ============================================================
   BREAKDOWN — month-by-month simulation, chart, schedule.
   Treats the offset as constant for the life of the loan.
   ============================================================ */
let bdView = 'yearly';

document.querySelectorAll('#breakdown .seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#breakdown .seg').forEach(b => b.classList.toggle('active', b === btn));
    bdView = btn.dataset.bdview;
    calcBreakdown();
  });
});

function simulateLoan(amount, annualRate, termYears, offset, extraMonthly) {
  const r = annualRate / 12;
  const n = termYears * 12;
  const basePay = pmt(amount, annualRate, termYears, 12);
  const totalPay = basePay + extraMonthly;
  const rows = [];
  let balance = amount;
  let cumInterest = 0;
  let month = 0;

  while (balance > 0.01 && month < n + 600) {  // 600-mo safety cap on top of term
    month++;
    const interestBase = Math.max(balance - offset, 0);
    const interest = interestBase * r;
    let principal = totalPay - interest;
    if (principal <= 0) {
      // Payment can't even cover interest — loan never pays off, stop.
      rows.push({ month, payment: totalPay, interest, principal: 0, balance });
      break;
    }
    if (principal > balance) principal = balance;
    const payment = interest + principal;
    balance -= principal;
    cumInterest += interest;
    rows.push({ month, payment, interest, principal, balance });
    if (balance <= 0.01) break;
  }
  return { rows, basePay, totalPay, cumInterest, monthsToPayoff: rows.length };
}

function calcBreakdown() {
  const amount = +document.getElementById('bd-amount').value || 0;
  const rate   = (+document.getElementById('bd-rate').value || 0) / 100;
  const termY  = +document.getElementById('bd-term').value || 0;
  const termM  = +document.getElementById('bd-term-months').value || 0;
  const term   = Math.max(1/12, termY + termM / 12);
  const offset = +document.getElementById('bd-offset').value || 0;
  const extra  = +document.getElementById('bd-extra').value || 0;
  if (amount <= 0) return;

  const sim = simulateLoan(amount, rate, term, offset, extra);
  document.getElementById('bd-interest').textContent = fmt.format(sim.cumInterest);

  if (sim.rows.length > 0) {
    const finish = new Date();
    finish.setMonth(finish.getMonth() + sim.rows.length);
    document.getElementById('bd-finish').textContent =
      finish.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
  } else {
    document.getElementById('bd-finish').textContent = '—';
  }

  renderChart(sim, amount);
  renderSchedule(sim);
}

function renderChart(sim, amount) {
  const svg = document.getElementById('bd-chart');
  const W = 600, H = 260, padL = 50, padR = 18, padT = 12, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const rows = sim.rows;
  if (rows.length === 0) { svg.innerHTML = ''; return; }

  const maxBal = amount;
  let cumP = 0, cumI = 0;
  const points = rows.map((row, i) => {
    cumP += row.principal;
    cumI += row.interest;
    return { x: i, bal: row.balance, cumI, cumP };
  });
  // Anchor at month 0
  points.unshift({ x: -1, bal: amount, cumI: 0, cumP: 0 });

  const xMax = rows.length;
  const xScale = x => padL + ((x + 1) / xMax) * innerW;
  const yScale = v => padT + (1 - v / maxBal) * innerH;

  const buildPath = key =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p[key]).toFixed(1)}`).join(' ');

  const balArea =
    `M ${xScale(-1)} ${yScale(0)} ` +
    points.map(p => `L ${xScale(p.x).toFixed(1)} ${yScale(p.bal).toFixed(1)}`).join(' ') +
    ` L ${xScale(xMax - 1)} ${yScale(0)} Z`;

  // Y axis ticks (5 lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const v = maxBal * t;
    const y = yScale(v);
    const label = '$' + Math.round(v / 1000) + 'k';
    return `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>` +
           `<text class="axis-label" x="${padL - 6}" y="${y + 3}" text-anchor="end">${label}</text>`;
  }).join('');

  // X axis ticks (years)
  const years = Math.ceil(rows.length / 12);
  const tickEvery = years <= 10 ? 1 : years <= 20 ? 2 : 5;
  let xTicks = '';
  for (let y = 0; y <= years; y += tickEvery) {
    const xPos = xScale(y * 12 - 1);
    xTicks += `<line class="axis-tick" x1="${xPos}" x2="${xPos}" y1="${H - padB}" y2="${H - padB + 4}"/>` +
              `<text class="axis-label" x="${xPos}" y="${H - padB + 16}" text-anchor="middle">${y}y</text>`;
  }

  svg.innerHTML =
    yTicks +
    xTicks +
    `<line class="axis" x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}"/>` +
    `<line class="axis" x1="${padL}" x2="${padL}" y1="${padT}" y2="${H - padB}"/>` +
    `<path class="area area-balance" d="${balArea}"/>` +
    `<path class="line line-principal" d="${buildPath('cumP')}"/>` +
    `<path class="line line-interest"  d="${buildPath('cumI')}"/>` +
    `<path class="line line-balance"   d="${buildPath('bal')}"/>`;
}

function renderSchedule(sim) {
  const tbody = document.getElementById('bd-schedule-body');
  const rows = sim.rows;
  if (rows.length === 0) { tbody.innerHTML = ''; return; }

  let html = '';
  if (bdView === 'monthly') {
    // Show ALL months (table is scrollable). Format compact dollars.
    const cap = Math.min(rows.length, 600);
    for (let i = 0; i < cap; i++) {
      const r = rows[i];
      html += `<tr>` +
        `<td>${i + 1}</td>` +
        `<td class="num">${fmt2.format(r.payment)}</td>` +
        `<td class="num">${fmt2.format(r.interest)}</td>` +
        `<td class="num">${fmt2.format(r.principal)}</td>` +
        `<td class="num">${fmt.format(r.balance)}</td>` +
        `</tr>`;
    }
  } else {
    // Aggregate by calendar year of the loan (12-month blocks)
    let year = 0;
    while (year * 12 < rows.length) {
      const slice = rows.slice(year * 12, (year + 1) * 12);
      const pay = slice.reduce((s, r) => s + r.payment, 0);
      const intr = slice.reduce((s, r) => s + r.interest, 0);
      const prin = slice.reduce((s, r) => s + r.principal, 0);
      const endBal = slice[slice.length - 1].balance;
      year++;
      html += `<tr class="year-row">` +
        `<td>Year ${year}</td>` +
        `<td class="num">${fmt.format(pay)}</td>` +
        `<td class="num">${fmt.format(intr)}</td>` +
        `<td class="num">${fmt.format(prin)}</td>` +
        `<td class="num">${fmt.format(endBal)}</td>` +
        `</tr>`;
    }
  }
  tbody.innerHTML = html;
}

['bd-amount','bd-rate','bd-term','bd-term-months','bd-offset','bd-extra']
  .forEach(id => document.getElementById(id).addEventListener('input', calcBreakdown));

/* ---------- Shared helpers ---------- */
function formatMonths(m) {
  if (!isFinite(m) || m <= 0) return '—';
  const y = Math.floor(m / 12);
  const mo = Math.round(m - y * 12);
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
}

/* ---------- Initial render ---------- */
SHARE.hydrate();
updateMyLoanModeUI();
calcRepayments();
calcPayoff();
calcExistingLoan();
calcBreakdown();
calcStampDuty();
calcBorrowing();
calcLMI();
SHARE.updateHash();
