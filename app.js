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

/* ---------- Tab switching ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === target));
  });
});

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
const repIds = ['rep-amount', 'rep-rate', 'rep-term', 'rep-offset', 'rep-extra'];
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
  const term   = +document.getElementById('rep-term').value || 1;
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
  const term     = +document.getElementById('bp-term').value || 30;

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

['bp-income','bp-expenses','bp-debts','bp-deps','bp-rate','bp-term']
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
calcRepayments();
calcPayoff();
calcStampDuty();
calcBorrowing();
calcLMI();
