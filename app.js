/* ============================================================
   LoanMate — calculation engine + UI logic
   One simulation engine powers the entire Loan tab: hero figure,
   savings, chart, and schedule always agree.
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
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t === btn);
      t.setAttribute('aria-selected', t === btn ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === target));
    SHARE.setTab(target);
    updateMiniBar();
  });
});
document.querySelectorAll('.tab').forEach(t =>
  t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false'));

/* ============================================================
   URL SHARE — serialize all inputs into the # hash so scenarios
   can be linked / bookmarked. Legacy params from the pre-merge
   tabs (rep-/po-/el-/bd-) are translated so old links keep working.
   ============================================================ */
const SHARE = (() => {
  const FIELDS = [
    'ln-amount','ln-rate','ln-rate2','ln-term','ln-term-months','ln-payment','ln-extra',
    'ln-offset','ln-io-years','ln-io-months','ln-start','ln-prop-value','ln-prop-growth',
    'ln-charge','ln-days',
    'sd-price','sd-state',
    'bp-income','bp-expenses','bp-debts','bp-deps','bp-rate','bp-term','bp-term-months',
    'lmi-price','lmi-deposit'
  ];
  const CHECKBOXES = ['ln-offset-end'];
  // Old per-tab params -> unified Loan params (first writer wins)
  const LEGACY = {
    'el-amount': 'ln-amount', 'po-balance': 'ln-amount', 'rep-amount': 'ln-amount', 'bd-amount': 'ln-amount',
    'el-rate': 'ln-rate', 'po-rate': 'ln-rate', 'rep-rate': 'ln-rate', 'bd-rate': 'ln-rate',
    'rep-rate2': 'ln-rate2',
    'el-term-years': 'ln-term', 'rep-term': 'ln-term', 'bd-term': 'ln-term',
    'el-term-months': 'ln-term-months', 'rep-term-months': 'ln-term-months', 'bd-term-months': 'ln-term-months',
    'el-payment': 'ln-payment', 'po-payment': 'ln-payment',
    'el-offset': 'ln-offset', 'po-offset': 'ln-offset', 'rep-offset': 'ln-offset', 'bd-offset': 'ln-offset',
    'po-extra': 'ln-extra', 'rep-extra': 'ln-extra', 'bd-extra': 'ln-extra',
    'po-charge': 'ln-charge', 'po-days': 'ln-days',
    'el-start': 'ln-start', 'el-io-years': 'ln-io-years', 'el-io-months': 'ln-io-months',
    'el-prop-value': 'ln-prop-value', 'el-prop-growth': 'ln-prop-growth',
    'el-offset-end': 'ln-offset-end',
    'elExtras': 'lnExtras', 'elRates': 'lnRates',
    'elFreq': 'lnFreq', 'poFreq': 'lnFreq', 'repFreq': 'lnFreq',
    'elType': 'lnType', 'repType': 'lnPtype', 'bdView': 'lnView'
  };
  const LEGACY_TABS = { repayments: 'loan', payoff: 'loan', myloan: 'loan', breakdown: 'loan' };
  let suppress = false;

  function serialize() {
    const params = new URLSearchParams();
    FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.value === '' || el.value == null) return;
      params.set(id, el.classList.contains('money') ? String(parseMoney(el.value)) : el.value);
    });
    CHECKBOXES.forEach(id => {
      const el = document.getElementById(id);
      if (el) params.set(id, el.checked ? '1' : '0');
    });
    const cmp = document.getElementById('ln-compare-section');
    if (cmp && cmp.open) params.set('cmpOpen', '1');
    params.set('lnFreq', lnFreq);
    params.set('lnType', lnType);
    params.set('lnPtype', lnPtype);
    params.set('lnView', lnView);
    params.set('sdBuyer', sdBuyer);
    params.set('bpHousehold', bpHousehold);
    if (lnExtras.length > 0) params.set('lnExtras', JSON.stringify(lnExtras));
    if (lnRates.length > 0)  params.set('lnRates',  JSON.stringify(lnRates));
    const active = document.querySelector('.tab.active');
    if (active) params.set('tab', active.dataset.tab);
    return params.toString();
  }

  function updateHash() {
    if (suppress) return;
    history.replaceState(null, '', '#' + serialize());
  }

  function hydrate() {
    if (!location.hash || location.hash.length < 2) return;
    suppress = true;
    try {
      const params = new URLSearchParams(location.hash.slice(1));
      // Translate legacy links from the pre-merge tabs
      Object.entries(LEGACY).forEach(([oldKey, newKey]) => {
        if (params.has(oldKey) && !params.has(newKey)) params.set(newKey, params.get(oldKey));
      });
      if (params.has('tab') && LEGACY_TABS[params.get('tab')]) {
        params.set('tab', LEGACY_TABS[params.get('tab')]);
      }
      // A Payoff link implies an existing loan
      if (!params.has('lnType') && params.has('po-balance')) params.set('lnType', 'existing');

      FIELDS.forEach(id => {
        if (params.has(id)) {
          const el = document.getElementById(id);
          if (el) el.value = params.get(id);
        }
      });
      formatAllMoney();
      CHECKBOXES.forEach(id => {
        if (params.has(id)) {
          const el = document.getElementById(id);
          if (el) el.checked = params.get(id) === '1';
        }
      });
      if (params.get('cmpOpen') === '1') {
        const cmp = document.getElementById('ln-compare-section');
        if (cmp) cmp.open = true;
      }
      if (params.has('lnExtras')) {
        try { lnExtras = JSON.parse(params.get('lnExtras')) || []; } catch { lnExtras = []; }
        renderEventList('ln-extras-list', lnExtras, 'extra');
      }
      if (params.has('lnRates')) {
        try { lnRates = JSON.parse(params.get('lnRates')) || []; } catch { lnRates = []; }
        renderEventList('ln-rates-list', lnRates, 'rate');
      }
      if (params.has('lnType'))  clickSeg('#loan', 'data-ltype',  params.get('lnType'));
      if (params.has('lnFreq'))  clickSeg('#loan', 'data-lfreq',  params.get('lnFreq'));
      if (params.has('lnPtype')) clickSeg('#loan', 'data-lptype', params.get('lnPtype'));
      if (params.has('lnView'))  clickSeg('#loan', 'data-lview',  params.get('lnView'));
      if (params.has('sdBuyer')) clickSeg('#stamp', 'data-buyer', params.get('sdBuyer'));
      if (params.has('bpHousehold')) clickSeg('#borrow', 'data-household', params.get('bpHousehold'));
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

function formatMonths(m) {
  if (!isFinite(m) || m <= 0) return '—';
  let y = Math.floor(m / 12);
  let mo = Math.round(m - y * 12);
  if (mo === 12) { y += 1; mo = 0; }  // carry: avoid "1 yr 12 mo"
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
}

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
function currentYM() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* ============================================================
   LOAN — unified calculator (new + existing), event-driven.
   ============================================================ */
let lnFreq = 'monthly';
let lnType = 'new';           // 'new' | 'existing'
let lnPtype = 'pi';           // 'pi' | 'io' (quick toggle, new mode)
let lnView = 'yearly';        // schedule granularity
let lnExtras = [];            // [{date:'2026-07', amount:500, freq:'monthly'}]
let lnRates = [];             // [{date:'2027-01', rate:5.5}]

/* ---------- Segmented controls ---------- */
function setLnFreq(f) {
  lnFreq = f;
  document.querySelectorAll('[data-lfreq]').forEach(b =>
    b.classList.toggle('active', b.dataset.lfreq === f));
  const word = f === 'monthly' ? '/ month' : f === 'fortnightly' ? '/ fortnight' : '/ week';
  document.getElementById('ln-freq-label').textContent = lnType === 'new' ? word : '';
  document.getElementById('ln-pay-label').textContent = word;
  calcLoan();
}
document.querySelectorAll('[data-lfreq]').forEach(btn => {
  btn.addEventListener('click', () => setLnFreq(btn.dataset.lfreq));
});

document.querySelectorAll('#loan [data-ltype]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#loan [data-ltype]').forEach(b => b.classList.toggle('active', b === btn));
    lnType = btn.dataset.ltype;
    updateLoanModeUI();
    calcLoan();
  });
});

document.querySelectorAll('#loan [data-lptype]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#loan [data-lptype]').forEach(b => b.classList.toggle('active', b === btn));
    lnPtype = btn.dataset.lptype;
    calcLoan();
  });
});

document.querySelectorAll('#loan [data-lview]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#loan [data-lview]').forEach(b => b.classList.toggle('active', b === btn));
    lnView = btn.dataset.lview;
    calcLoan();
  });
});

function updateLoanModeUI() {
  const isNew = lnType === 'new';
  document.getElementById('ln-term-wrap').style.display   = isNew ? '' : 'none';
  document.getElementById('ln-start-wrap').style.display  = isNew ? '' : 'none';
  document.getElementById('ln-ptype-wrap').style.display  = isNew ? '' : 'none';
  document.getElementById('ln-freq-wrap').style.display   = isNew ? 'none' : '';
  document.getElementById('ln-hero-pills').style.display  = isNew ? '' : 'none';
  document.getElementById('ln-verifier-section').style.display = isNew ? 'none' : '';
  document.getElementById('ln-amount-label').textContent  = isNew ? 'Loan amount' : 'Current balance';
  document.getElementById('ln-payment-label').textContent = isNew ? 'Repayment override' : 'Repayment amount';
  document.getElementById('ln-pay-label').hidden = isNew;
  const pay = document.getElementById('ln-payment');
  pay.placeholder = isNew ? 'Auto-calculated' : 'e.g. 3,500';
  document.getElementById('ln-hero-label').textContent = isNew ? 'Repayment' : 'Time remaining';
  const word = lnFreq === 'monthly' ? '/ month' : lnFreq === 'fortnightly' ? '/ fortnight' : '/ week';
  document.getElementById('ln-freq-label').textContent = isNew ? word : '';
  heroAnim.last['ln-hero'] = null;   // don't animate across mode switches
}

/* ---------- Event lists (dated extras + rate changes) ---------- */
function renderEventList(listId, items, kind) {
  const root = document.getElementById(listId);
  const todayYM = currentYM();
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
  const countId = kind === 'extra' ? 'ln-extras-count' : 'ln-rates-count';
  const chip = document.getElementById(countId);
  if (items.length > 0) { chip.hidden = false; chip.textContent = items.length; }
  else { chip.hidden = true; }
}

document.querySelectorAll('#loan .add-event').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.action === 'add-extra') {
      lnExtras.push({ date: currentYM(), amount: 500, freq: 'monthly' });
      renderEventList('ln-extras-list', lnExtras, 'extra');
    } else {
      lnRates.push({ date: currentYM(), rate: '' });
      renderEventList('ln-rates-list', lnRates, 'rate');
    }
    calcLoan();
    SHARE.updateHash();
  });
});

document.getElementById('loan').addEventListener('input', (e) => {
  const item = e.target.closest('.event-item');
  if (!item) return;
  const idx = +item.dataset.idx;
  const kind = item.dataset.kind;
  const prop = e.target.dataset.prop;
  const arr = kind === 'extra' ? lnExtras : lnRates;
  if (!arr[idx]) return;
  arr[idx][prop] = prop === 'amount' || prop === 'rate' ? +e.target.value || '' : e.target.value;
  calcLoan();
});
document.getElementById('loan').addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-event');
  if (!btn) return;
  const item = btn.closest('.event-item');
  const idx = +item.dataset.idx;
  const kind = item.dataset.kind;
  if (kind === 'extra') { lnExtras.splice(idx, 1); renderEventList('ln-extras-list', lnExtras, 'extra'); }
  else { lnRates.splice(idx, 1); renderEventList('ln-rates-list', lnRates, 'rate'); }
  calcLoan();
  SHARE.updateHash();
});

/* ---------- Core simulator (event-driven, monthly cadence) ---------- */
/**
 * @param opts {
 *   amount, baseRate, termMonths, ioMonths,
 *   offset, endWhenOffset,
 *   overridePay,           // monthly equivalent; 0 = auto from term
 *   extras: [{date,amount,freq}], rateChanges: [{date,rate}],
 *   startYM                // { y, m } — anchors event dates to month indices
 * }
 */
function simulateScenario(opts) {
  const rows = [];
  let balance = opts.amount;
  let cumInterest = 0;
  let month = 0;
  let neverPays = false;
  const totalMonths = opts.termMonths;
  const ioMonths = opts.ioMonths || 0;
  const safetyCap = totalMonths + 720;

  const extrasByMonth = (m) => {
    let sum = 0;
    opts.extras.forEach(ev => {
      if (!ev.amount) return;
      const evDate = parseYearMonth(ev.date);
      // Blank/unparseable date = active from the start of the simulation
      const evMonth = evDate ? Math.max(1, monthsBetween(opts.startYM, evDate) + 1) : 1;
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

  const sortedChanges = opts.rateChanges
    .filter(c => c.rate)
    .map(c => {
      const d = parseYearMonth(c.date);
      return { month: d ? Math.max(1, monthsBetween(opts.startYM, d) + 1) : 1, rate: +c.rate / 100 };
    })
    .sort((a, b) => a.month - b.month);

  let currentRate = opts.baseRate;
  let amortPay = opts.overridePay > 0
    ? opts.overridePay
    : pmt(opts.amount, opts.baseRate, (totalMonths - ioMonths) / 12, 12);

  // Days in the m-th simulated month (1-indexed), anchored to the loan's
  // calendar start — gives Actual/365 daily accrual incl. leap years.
  const daysInMonth = (m) => {
    const idx = opts.startYM.m - 1 + (m - 1);
    return new Date(opts.startYM.y + Math.floor(idx / 12), (idx % 12) + 1, 0).getDate();
  };

  while (balance > 0.01 && month < safetyCap) {
    month++;

    const change = sortedChanges.find(c => c.month === month);
    if (change) {
      currentRate = change.rate;
      if (month > ioMonths && opts.overridePay <= 0) {
        amortPay = pmt(balance, currentRate, Math.max(1, totalMonths - month + 1) / 12, 12);
      }
    }

    const interestBase = Math.max(balance - opts.offset, 0);
    // Daily accrual (Actual/365), charged monthly — like a real lender
    const interest = interestBase * (currentRate / 365) * daysInMonth(month);
    const extraThisMonth = extrasByMonth(month);

    if (opts.endWhenOffset && opts.offset >= balance) break;

    let payment, principal;
    if (month <= ioMonths) {
      payment = interest + extraThisMonth;
      principal = Math.min(extraThisMonth, balance);
    } else {
      payment = amortPay + extraThisMonth;
      principal = payment - interest;
      if (principal <= 0) {
        rows.push({ month, payment, interest, principal: 0, balance, rate: currentRate });
        neverPays = true;
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
  const unpaid = neverPays || (month >= safetyCap && balance > 0.01);
  return { rows, cumInterest, monthsToPayoff: rows.length, unpaid };
}

function simTotals(sim) {
  const paid = sim.rows.reduce((s, r) => s + r.payment, 0);
  return { paid, interest: sim.cumInterest, principal: Math.max(paid - sim.cumInterest, 0) };
}

/* ---------- Loan calc entry point ---------- */
function calcLoan() {
  const isNew  = lnType === 'new';
  const amount = num('ln-amount');
  const rate   = (+document.getElementById('ln-rate').value || 0) / 100;
  const termY  = +document.getElementById('ln-term').value || 0;
  const termM  = +document.getElementById('ln-term-months').value || 0;
  const termMonths = isNew ? Math.max(1, termY * 12 + termM) : 720;
  const payment = num('ln-payment');
  const extra   = num('ln-extra');
  const offset  = num('ln-offset');
  const endWhenOffset = document.getElementById('ln-offset-end').checked;
  const ioY = +document.getElementById('ln-io-years').value || 0;
  const ioM = +document.getElementById('ln-io-months').value || 0;
  const ioMonths = Math.min(ioY * 12 + ioM, termMonths - 1);
  const propVal = num('ln-prop-value');
  const propGr  = (+document.getElementById('ln-prop-growth').value || 0) / 100;
  const startStr = document.getElementById('ln-start').value;
  if (amount <= 0 || rate <= 0) return;

  const ppy = lnFreq === 'monthly' ? 12 : lnFreq === 'fortnightly' ? 26 : 52;
  const rFreq = rate / ppy;
  const monthlyExtra = extra > 0 ? extra * ppy / 12 : 0;
  const monthlyOverride = payment > 0 ? payment * ppy / 12 : 0;
  const hasExtras = monthlyExtra > 0 || lnExtras.some(e => e.amount > 0);

  // Element handles
  const hero = document.getElementById('ln-hero');
  const guard = document.getElementById('ln-guard');
  const payErr = document.getElementById('ln-payment-error');
  const payWrap = document.getElementById('ln-payment').closest('.input-prefix');
  const piWrap = document.getElementById('ln-pi-wrap');
  const projection = document.getElementById('ln-projection');
  const cardsRow1 = document.getElementById('ln-c1').closest('.result-row');
  const cardsRow2 = document.getElementById('ln-c3').closest('.result-row');
  const nowBlock = document.getElementById('ln-now-block');
  const ioNote = document.getElementById('ln-io-note');
  const freqNote = document.getElementById('ln-freq-note');
  const comparePanel = document.getElementById('ln-compare-panel');
  const comparePill = document.getElementById('ln-compare-pill');
  const emptyPrompt = document.getElementById('ln-empty');

  const hideProjection = (v) => {
    piWrap.style.display = v ? 'none' : '';
    projection.style.display = v ? 'none' : '';
    cardsRow1.style.display = v ? 'none' : '';
    cardsRow2.style.display = v ? 'none' : '';
    ['ln-saved-offset', 'ln-saved-extra', 'ln-saved-combined'].forEach(id =>
      document.getElementById(id + '-card').hidden = v || true);
    if (v) { emptyPrompt.hidden = true; nowBlock.hidden = true; comparePanel.hidden = true; comparePill.hidden = true; }
  };

  payErr.hidden = true;
  payWrap.classList.remove('invalid');
  guard.hidden = true;
  ioNote.hidden = true;

  // Existing loan needs a repayment to project anything
  if (!isNew && payment <= 0) {
    hero.textContent = '—';
    guard.hidden = false;
    hideProjection(true);
    updateMiniBar();
    return;
  }

  // Interest-only quick answer (new mode)
  if (isNew && lnPtype === 'io') {
    const ioPay = Math.max(amount - offset, 0) * rFreq + extra;
    setMoneyAnimated(hero, ioPay);
    ioNote.hidden = false;
    freqNote.hidden = true;
    hideProjection(true);
    updateMiniBar();
    return;
  }

  // --- Simulate the actual scenario ---
  const startYM = !isNew
    ? { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
    : (parseYearMonth(startStr) || { y: new Date().getFullYear(), m: new Date().getMonth() + 1 });
  const today = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  const monthsElapsed = isNew && parseYearMonth(startStr)
    ? Math.max(0, monthsBetween(parseYearMonth(startStr), today))
    : 0;

  const combinedExtras = monthlyExtra > 0
    ? [...lnExtras, { date: '', amount: monthlyExtra, freq: 'monthly' }]
    : lnExtras;

  const opts = {
    amount, baseRate: rate, termMonths, ioMonths,
    offset, endWhenOffset,
    overridePay: monthlyOverride,
    extras: combinedExtras, rateChanges: lnRates,
    startYM
  };
  const sim = simulateScenario(opts);

  // Payment can't cover interest → field-level error
  if (sim.unpaid) {
    const minPay = Math.max(amount - offset, 0) * rFreq;
    payErr.textContent = `Too low — ${lnFreq} interest alone is ${fmt2.format(minPay)} on this balance, so the loan would never reduce.`;
    payErr.hidden = false;
    payWrap.classList.add('invalid');
    hero.textContent = '—';
    hideProjection(true);
    updateMiniBar();
    return;
  }

  hideProjection(false);
  const totals = simTotals(sim);

  // --- Hero ---
  if (isNew) {
    const displayBase = payment > 0
      ? payment
      : pmt(amount, rate, (termMonths - ioMonths) / 12, ppy);
    setMoneyAnimated(hero, displayBase + extra);
  } else {
    hero.textContent = formatMonths(sim.rows.length);
  }

  // --- Cards ---
  const finishBase = isNew && parseYearMonth(startStr) ? parseYearMonth(startStr) : today;
  const finish = new Date(finishBase.y, finishBase.m - 1, 1);
  finish.setMonth(finish.getMonth() + sim.rows.length);
  const finishStr = sim.rows.length > 0
    ? finish.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : '—';

  if (isNew) {
    document.getElementById('ln-c1-label').textContent = 'Total interest';
    document.getElementById('ln-c1').textContent = fmt.format(totals.interest);
    document.getElementById('ln-c2-label').textContent = 'Total cost';
    document.getElementById('ln-c2').textContent = fmt.format(totals.paid);
    document.getElementById('ln-c3-label').textContent = 'Loan paid off';
    document.getElementById('ln-c3').textContent = finishStr;
    document.getElementById('ln-c4-label').textContent = 'Actual term';
    document.getElementById('ln-c4').textContent = formatMonths(sim.rows.length);
  } else {
    document.getElementById('ln-c1-label').textContent = 'Interest remaining';
    document.getElementById('ln-c1').textContent = fmt.format(totals.interest);
    document.getElementById('ln-c2-label').textContent = 'Total remaining cost';
    document.getElementById('ln-c2').textContent = fmt.format(totals.paid);
    document.getElementById('ln-c3-label').textContent = 'Finish date';
    document.getElementById('ln-c3').textContent = finishStr;
    document.getElementById('ln-c4-label').textContent = 'Principal remaining';
    document.getElementById('ln-c4').textContent = fmt.format(amount);
  }

  // --- Principal vs interest bar ---
  const split = totals.principal + totals.interest;
  const pShare = split > 0 ? totals.principal / split : 0;
  document.getElementById('ln-pi-principal').style.width = (pShare * 100).toFixed(1) + '%';
  document.getElementById('ln-pi-interest').style.width = ((1 - pShare) * 100).toFixed(1) + '%';
  document.getElementById('ln-pi-plabel').textContent = fmt.format(totals.principal);
  document.getElementById('ln-pi-ilabel').textContent = fmt.format(totals.interest);

  // --- Where you are now (new loan with a past start date) ---
  const showNow = isNew && monthsElapsed > 0;
  nowBlock.hidden = !showNow;
  let currentBalance = amount;
  if (showNow) {
    const sliceEnd = Math.min(monthsElapsed, sim.rows.length);
    let intPaid = 0, prinPaid = 0;
    for (let i = 0; i < sliceEnd; i++) {
      intPaid += sim.rows[i].interest;
      prinPaid += sim.rows[i].principal;
    }
    currentBalance = sliceEnd > 0 ? sim.rows[sliceEnd - 1].balance : amount;
    const pctPaid = Math.min(100, (prinPaid / amount) * 100);
    document.getElementById('ln-current').textContent = fmt.format(Math.round(currentBalance));
    document.getElementById('ln-interest-paid').textContent = fmt.format(intPaid);
    document.getElementById('ln-progress-pct').textContent = pctPaid.toFixed(1) + '%';
    document.getElementById('ln-progress-fill').style.width = pctPaid + '%';
    document.getElementById('ln-progress-time').textContent = `Month ${monthsElapsed} of ${sim.rows.length}`;
  }

  // --- Property tracking ---
  const propRow = document.getElementById('ln-property-row');
  if (propVal > 0) {
    const equity = Math.max(propVal - currentBalance, 0);
    const lvr = currentBalance / propVal;
    document.getElementById('ln-lvr').textContent = (lvr * 100).toFixed(1) + '%';
    document.getElementById('ln-equity').textContent = fmt.format(Math.round(equity));
    propRow.hidden = false;
  } else {
    propRow.hidden = true;
  }

  // --- Savings vs no-offset / no-extras baseline (rate changes kept) ---
  const simBase = simulateScenario({ ...opts, offset: 0, extras: [] });
  const baseTotals = simTotals(simBase);
  const showSaving = (id, show, dInt, dMo) => {
    const card = document.getElementById(id + '-card');
    card.hidden = !show;
    if (show) {
      document.getElementById(id).textContent =
        dMo > 0 ? `${fmt.format(dInt)} · ${formatMonths(dMo)}` : fmt.format(dInt);
    }
  };
  let offInt = 0, offMo = 0, extInt = 0, extMo = 0;
  if (offset > 0) {
    const simOff = simulateScenario({ ...opts, extras: [] });
    offInt = Math.max(0, baseTotals.interest - simOff.cumInterest);
    offMo  = Math.max(0, simBase.rows.length - simOff.rows.length);
  }
  if (hasExtras) {
    const simExt = simulateScenario({ ...opts, offset: 0 });
    extInt = Math.max(0, baseTotals.interest - simExt.cumInterest);
    extMo  = Math.max(0, simBase.rows.length - simExt.rows.length);
  }
  const comboInt = Math.max(0, baseTotals.interest - totals.interest);
  const comboMo  = Math.max(0, simBase.rows.length - sim.rows.length);
  showSaving('ln-saved-offset', offset > 0 && offInt > 0, offInt, offMo);
  showSaving('ln-saved-extra',  hasExtras && extInt > 0, extInt, extMo);
  showSaving('ln-saved-combined', (offset > 0 || hasExtras) && comboInt > 0, comboInt, comboMo);
  emptyPrompt.hidden = (offset > 0 || hasExtras);

  // --- Chart + schedule ---
  document.getElementById('ln-chart-title').textContent =
    isNew ? 'Loan balance over time' : 'Remaining balance from today';
  renderChart(sim, amount);
  renderSchedule(sim);

  // --- Frequency honesty note (new mode, non-monthly) ---
  if (isNew && lnFreq !== 'monthly') {
    const label = lnFreq === 'fortnightly' ? 'fortnight' : 'week';
    const lenderDiv = lnFreq === 'fortnightly' ? 2 : 4;
    const realWeeks = lnFreq === 'fortnightly' ? 26 : 52;
    const monthlyPay = pmt(amount, rate, (termMonths - ioMonths) / 12, 12);
    const shown = payment > 0 ? payment + extra
      : pmt(amount, rate, (termMonths - ioMonths) / 12, ppy) + extra;
    freqNote.hidden = false;
    freqNote.innerHTML =
      `<strong>Heads up — ${label}ly repayments don't automatically shorten your loan.</strong> ` +
      `Many lenders simply divide your monthly payment by ${lenderDiv}, ` +
      `which means a ${label}ly payment of <strong>${fmt2.format(monthlyPay * 12 / (lenderDiv * 12))}</strong> (their default) ` +
      `pays exactly the same as monthly. ` +
      `To genuinely save interest, pay the true ${label}ly amortising amount of ` +
      `<strong>${fmt2.format(shown)}</strong> shown above (≈ monthly × 12 ÷ ${realWeeks}).`;
  } else {
    freqNote.hidden = true;
  }

  // --- Rate comparison (rate-change events excluded from both sides) ---
  const compareOpen = document.getElementById('ln-compare-section').open;
  const rate2 = (+document.getElementById('ln-rate2').value || 0) / 100;
  if (compareOpen && rate2 > 0) {
    const cmpA = simulateScenario({ ...opts, rateChanges: [] });
    const cmpB = simulateScenario({ ...opts, rateChanges: [], baseRate: rate2 });
    const tA = simTotals(cmpA), tB = simTotals(cmpB);

    document.getElementById('ln-compare-rateA').textContent = (rate * 100).toFixed(2) + '%';
    document.getElementById('ln-compare-rateB').textContent = (rate2 * 100).toFixed(2) + '%';

    let r1A, r1B, r1Label;
    if (isNew) {
      r1Label = 'Repayment';
      const payA = (payment > 0 ? payment : pmt(amount, rate,  (termMonths - ioMonths) / 12, ppy)) + extra;
      const payB = (payment > 0 ? payment : pmt(amount, rate2, (termMonths - ioMonths) / 12, ppy)) + extra;
      r1A = fmt2.format(payA);
      r1B = fmt2.format(payB);
      const payDelta = payB - payA;
      document.getElementById('ln-delta-1-label').textContent =
        'Per ' + (lnFreq === 'monthly' ? 'month' : lnFreq === 'fortnightly' ? 'fortnight' : 'week');
      document.getElementById('ln-delta-pay').textContent =
        Math.abs(payDelta) < 0.005 ? '$0' : (payDelta < 0 ? '−' : '+') + fmt2.format(Math.abs(payDelta));
    } else {
      r1Label = 'Time left';
      r1A = formatMonths(cmpA.rows.length);
      r1B = formatMonths(cmpB.rows.length);
      const moDelta = cmpB.rows.length - cmpA.rows.length;
      document.getElementById('ln-delta-1-label').textContent = 'Time difference';
      document.getElementById('ln-delta-pay').textContent =
        moDelta === 0 ? '0 mo' : (moDelta < 0 ? '−' : '+') + formatMonths(Math.abs(moDelta));
    }
    document.getElementById('ln-compare-r1-label').textContent = r1Label;
    document.getElementById('ln-compare-r1-labelB').textContent = r1Label;
    document.getElementById('ln-compare-payA').textContent = r1A;
    document.getElementById('ln-compare-payB').textContent = r1B;
    document.getElementById('ln-compare-intA').textContent = fmt.format(tA.interest);
    document.getElementById('ln-compare-intB').textContent = fmt.format(tB.interest);
    document.getElementById('ln-compare-costA').textContent = fmt.format(tA.paid);
    document.getElementById('ln-compare-costB').textContent = fmt.format(tB.paid);

    const bankA = document.getElementById('ln-compare-bankA');
    const bankB = document.getElementById('ln-compare-bankB');
    bankA.classList.remove('winner');
    bankB.classList.remove('winner');
    const cheaperIsB = tB.interest < tA.interest;
    if (cheaperIsB) bankB.classList.add('winner');
    else if (tA.interest < tB.interest) bankA.classList.add('winner');

    const intDelta = Math.abs(tA.interest - tB.interest);
    document.getElementById('ln-delta-headline').innerHTML =
      intDelta < 1
        ? 'Both rates produce the same total cost.'
        : `${cheaperIsB ? 'The lower rate' : 'Your current rate'} saves <strong>${fmt.format(intDelta)}</strong> over the loan.`;
    document.getElementById('ln-delta-int').textContent =
      intDelta < 1 ? '$0' : (cheaperIsB ? '−' : '+') + fmt.format(intDelta);

    comparePanel.hidden = false;
    comparePill.hidden = false;
  } else {
    comparePanel.hidden = true;
    comparePill.hidden = true;
  }

  // --- Verifier + disclaimer ---
  if (!isNew) calcVerifier();
  const flags = [];
  if (offset > 0)        flags.push('constant offset');
  if (ioMonths > 0)      flags.push(`${(ioMonths / 12).toFixed(1).replace('.0', '')}yr IO period`);
  if (lnRates.length > 0) flags.push(`${lnRates.length} rate change${lnRates.length > 1 ? 's' : ''}`);
  if (lnExtras.length > 0 || monthlyExtra > 0) {
    const n = lnExtras.length + (monthlyExtra > 0 ? 1 : 0);
    flags.push(`${n} extra repayment stream${n > 1 ? 's' : ''}`);
  }
  document.getElementById('ln-disclaimer').textContent =
    'Simulation models: ' + (flags.length ? flags.join(' · ') : 'constant rate, no extras, no offset') + '.';

  updateMiniBar();
}

/* ---------- Interest-charge verifier (existing loans) ---------- */
function calcVerifier() {
  const balance = num('ln-amount');
  const rate    = (+document.getElementById('ln-rate').value || 0) / 100;
  const charge  = num('ln-charge');
  const days    = +document.getElementById('ln-days').value || 30;
  if (balance <= 0 || charge <= 0 || rate <= 0) return;
  const dailyRate = rate / 365;
  const effective = charge / (dailyRate * days);
  const impliedOffset = Math.max(balance - effective, 0);
  document.getElementById('ln-implied-offset').textContent = fmt.format(Math.round(impliedOffset));
}

/* ---------- Chart (hand-rolled SVG) ---------- */
function renderChart(sim, amount) {
  const svg = document.getElementById('ln-chart');
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
  points.unshift({ x: -1, bal: amount, cumI: 0, cumP: 0 });

  const xMax = rows.length;
  const xScale = x => padL + ((x + 1) / xMax) * innerW;
  const yScale = v => padT + (1 - Math.min(v, maxBal) / maxBal) * innerH;

  const buildPath = key =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p[key]).toFixed(1)}`).join(' ');

  const balArea =
    `M ${xScale(-1)} ${yScale(0)} ` +
    points.map(p => `L ${xScale(p.x).toFixed(1)} ${yScale(p.bal).toFixed(1)}`).join(' ') +
    ` L ${xScale(xMax - 1)} ${yScale(0)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const v = maxBal * t;
    const y = yScale(v);
    const label = '$' + Math.round(v / 1000) + 'k';
    return `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>` +
           `<text class="axis-label" x="${padL - 6}" y="${y + 3}" text-anchor="end">${label}</text>`;
  }).join('');

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

/* ---------- Schedule table ---------- */
function renderSchedule(sim) {
  const tbody = document.getElementById('ln-schedule-body');
  const rows = sim.rows;
  if (rows.length === 0) { tbody.innerHTML = ''; return; }

  let html = '';
  if (lnView === 'monthly') {
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

['ln-amount', 'ln-rate', 'ln-rate2', 'ln-term', 'ln-term-months', 'ln-payment', 'ln-extra',
 'ln-offset', 'ln-io-years', 'ln-io-months', 'ln-start', 'ln-prop-value', 'ln-prop-growth']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calcLoan);
  });
document.getElementById('ln-offset-end').addEventListener('change', calcLoan);
document.getElementById('ln-compare-section').addEventListener('toggle', calcLoan);
['ln-charge', 'ln-days'].forEach(id =>
  document.getElementById(id).addEventListener('input', calcVerifier));

/* ============================================================
   STAMP DUTY (AU states)
   Simplified scales — verify with state revenue offices.
   ============================================================ */
function tieredDuty(price, tiers) {
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
  const price = num('sd-price');
  const state = document.getElementById('sd-state').value;
  if (price <= 0) return;

  let duty = STAMP_DUTY[state](price);
  let note = 'Estimate only — verify with your state revenue office.';

  if (sdBuyer === 'fhb') {
    const concession = applyFhbConcession(state, price, duty);
    if (concession < duty) note = `First home buyer concession applied (${state}).`;
    duty = concession;
  }

  document.getElementById('sd-amount').textContent = fmt.format(Math.round(duty));
  document.getElementById('sd-rate').textContent = pct(duty / price);
  document.getElementById('sd-note').textContent = note;
  updateMiniBar();
}
['sd-price', 'sd-state'].forEach(id => document.getElementById(id).addEventListener('input', calcStampDuty));

/* ============================================================
   BORROWING POWER
   ============================================================ */
let bpHousehold = 'single';
document.querySelectorAll('#borrow [data-household]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#borrow [data-household]').forEach(b => b.classList.toggle('active', b === btn));
    bpHousehold = btn.dataset.household;
    calcBorrowing();
  });
});

function calcBorrowing() {
  const income   = num('bp-income');
  const expenses = num('bp-expenses');
  const debts    = num('bp-debts');
  const deps     = +document.getElementById('bp-deps').value || 0;
  const rate     = (+document.getElementById('bp-rate').value || 0) / 100;
  const termY    = +document.getElementById('bp-term').value || 0;
  const termM    = +document.getElementById('bp-term-months').value || 0;
  const term     = Math.max(1 / 12, termY + termM / 12);

  if (income <= 0) return;

  const netAnnual = afterTax(income) - medicareLevy(income, bpHousehold, deps);
  const netMonthly = netAnnual / 12;

  // Lenders floor declared expenses at the HEM benchmark
  const hem = hemMonthly(income, bpHousehold, deps);
  const living = Math.max(expenses, hem);
  const note = document.getElementById('bp-hem-note');
  if (hem > expenses) {
    note.hidden = false;
    note.innerHTML = `Assessed using the <strong>HEM benchmark of ${fmt.format(Math.round(hem))}/month</strong> ` +
      `instead of your declared ${fmt.format(expenses)} — lenders ignore declared expenses below HEM.`;
  } else {
    note.hidden = true;
  }

  const surplus = netMonthly - living - debts;
  const maxPayment = Math.max(surplus * 0.85, 0);

  const r = rate / 12;
  const n = term * 12;
  const maxLoan = r === 0
    ? maxPayment * n
    : (maxPayment * (1 - Math.pow(1 + r, -n))) / r;

  document.getElementById('bp-amount').textContent = fmt.format(Math.round(maxLoan));
  document.getElementById('bp-payment').textContent = fmt2.format(maxPayment);
  updateMiniBar();
}

function afterTax(gross) {
  // 2024-25 stage-3 resident rates (excl. Medicare levy — see medicareLevy)
  let tax = 0;
  if (gross > 190000)      tax = 51638 + (gross - 190000) * 0.45;
  else if (gross > 135000) tax = 31288 + (gross - 135000) * 0.37;
  else if (gross > 45000)  tax = 4288  + (gross - 45000)  * 0.30;
  else if (gross > 18200)  tax = (gross - 18200) * 0.16;
  return gross - tax;
}

function medicareLevy(gross, household, deps) {
  // 2% levy with low-income shade-in: levy = min(2% × income, 10% × (income − threshold)).
  // 2024–25 thresholds: single $27,222; family $45,907 + $4,216 per dependant.
  const threshold = household === 'couple' ? 45907 + 4216 * deps : 27222;
  if (gross <= threshold) return 0;
  return Math.min(0.02 * gross, 0.10 * (gross - threshold));
}

function hemMonthly(grossAnnual, household, deps) {
  // Simplified HEM: base by household, + per-dependant, scaling gently with income.
  const base = household === 'couple' ? 3100 : 1750;
  const depCost = 550 * deps;
  const uplift = Math.min(1500, Math.max(0, (grossAnnual - 80000) / 12 * 0.025));
  return base + depCost + uplift;
}

['bp-income', 'bp-expenses', 'bp-debts', 'bp-deps', 'bp-rate', 'bp-term', 'bp-term-months']
  .forEach(id => document.getElementById(id).addEventListener('input', calcBorrowing));

/* ============================================================
   LMI ESTIMATOR
   ============================================================ */
const LMI_GRID = {
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
  const price   = num('lmi-price');
  const deposit = num('lmi-deposit');
  if (price <= 0) return;

  const loan = Math.max(price - deposit, 0);
  const lvr  = loan / price;

  document.getElementById('lmi-loan').textContent = fmt.format(loan);
  document.getElementById('lmi-lvr').textContent = pct(lvr);

  const band = lmiBand(lvr);
  if (!band) {
    document.getElementById('lmi-amount').textContent = '$0';
    updateMiniBar();
    return;
  }
  const grid = LMI_GRID[band];
  let rate = grid.tiers[grid.tiers.length - 1][1];
  for (const [cap, r] of grid.tiers) {
    if (loan <= cap) { rate = r; break; }
  }
  const premium = loan * (rate / 100);
  document.getElementById('lmi-amount').textContent = fmt.format(Math.round(premium));
  updateMiniBar();
}
['lmi-price', 'lmi-deposit'].forEach(id => document.getElementById(id).addEventListener('input', calcLMI));

/* ============================================================
   UI HELPERS — money formatting, sliders, steppers, CTA chips,
   hero count-up, mobile mini-bar
   ============================================================ */
function parseMoney(v) { return +String(v).replace(/[^0-9.]/g, '') || 0; }
function num(id) { return parseMoney(document.getElementById(id).value); }

function formatMoneyEl(el, force) {
  const raw = el.value;
  // While typing, let cents-in-progress through untouched ("2800." / "2800.8");
  // force=true (defaults, hydration) formats everything.
  if (raw === '' || (!force && (/\.\d?$/.test(raw) || raw.endsWith('.')))) return;
  const n = parseMoney(raw);
  const hasCents = /\.\d/.test(raw);
  el.value = n ? n.toLocaleString('en-AU', hasCents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) : '';
}
function formatAllMoney() {
  document.querySelectorAll('input.money').forEach(el => formatMoneyEl(el, true));
}
document.querySelectorAll('input.money').forEach(el => {
  el.addEventListener('input', () => {
    const fromEnd = el.value.length - (el.selectionStart ?? el.value.length);
    formatMoneyEl(el);
    const pos = Math.max(0, el.value.length - fromEnd);
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  });
});

/* Sliders <-> fields (two-way sync) */
document.querySelectorAll('input.slider').forEach(sl => {
  sl.addEventListener('input', () => {
    const src = document.getElementById(sl.dataset.for);
    if (!src) return;
    src.value = src.classList.contains('money') ? (+sl.value).toLocaleString('en-AU') : sl.value;
    src.dispatchEvent(new Event('input', { bubbles: true }));
  });
});
function syncSliders() {
  document.querySelectorAll('input.slider').forEach(sl => {
    const src = document.getElementById(sl.dataset.for);
    if (!src) return;
    const v = src.classList.contains('money') ? parseMoney(src.value) : +src.value;
    if (isFinite(v)) sl.value = v;
  });
}
// Keep any slider in step with its field as the user types
document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (!id || e.target.classList.contains('slider')) return;
  document.querySelectorAll(`input.slider[data-for="${id}"]`).forEach(sl => {
    const v = e.target.classList.contains('money') ? parseMoney(e.target.value) : +e.target.value;
    if (isFinite(v)) sl.value = v;
  });
});

/* Steppers (− / +) */
document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const el = document.getElementById(btn.dataset.for);
    if (!el) return;
    const step = +btn.dataset.step;
    let v = (+el.value || 0) + step;
    if (el.min !== '') v = Math.max(+el.min, v);
    if (el.max !== '') v = Math.min(+el.max, v);
    el.value = Math.abs(step) < 1 ? +v.toFixed(2) : Math.round(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

/* CTA chips — jump between calculators carrying values across */
document.querySelectorAll('.cta-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    (chip.dataset.map || '').split(',').filter(Boolean).forEach(pair => {
      const [srcId, dstId] = pair.split(':');
      const src = document.getElementById(srcId);
      const dst = document.getElementById(dstId);
      if (!src || !dst) return;
      const v = parseMoney(src.tagName === 'INPUT' ? src.value : src.textContent);
      if (!v) return;
      dst.value = dst.classList.contains('money') ? v.toLocaleString('en-AU') : v;
      dst.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const tabBtn = document.querySelector(`.tab[data-tab="${chip.dataset.goto}"]`);
    if (tabBtn) tabBtn.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* Hero count-up animation */
const heroAnim = { raf: 0, settle: 0, last: {} };
function setMoneyAnimated(el, value) {
  if (!isFinite(value)) { el.textContent = '—'; return; }
  const from = heroAnim.last[el.id];
  heroAnim.last[el.id] = value;
  // Skip the animation for first paint, tiny deltas, or hidden tabs
  // (rAF is throttled in background tabs and the value would stall mid-count).
  if (from == null || Math.abs(value - from) < 0.005 || document.hidden) {
    el.textContent = fmt2.format(value);
    return;
  }
  cancelAnimationFrame(heroAnim.raf);
  clearTimeout(heroAnim.settle);
  const t0 = performance.now(), dur = 320, diff = value - from;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt2.format(from + diff * e);
    if (k < 1) heroAnim.raf = requestAnimationFrame(tick);
  };
  heroAnim.raf = requestAnimationFrame(tick);
  // Guarantee the exact final value lands even if rAF is throttled
  heroAnim.settle = setTimeout(() => { el.textContent = fmt2.format(value); }, dur + 80);
}

/* Mobile mini-bar — mirrors the active panel's primary result while it's off-screen */
let miniCard = null;
let miniTick = false;
function updateMiniBar() {
  const bar = document.getElementById('mini-bar');
  if (!bar) return;
  const panel = document.querySelector('.panel.active');
  const card = panel ? panel.querySelector('.result-card.primary') : null;
  miniCard = (card && card.style.display !== 'none') ? card : null;
  if (!miniCard) { bar.hidden = true; return; }
  const label = miniCard.querySelector('.label');
  const value = miniCard.querySelector('.value');
  document.getElementById('mini-label').textContent = label ? label.textContent.trim() : '';
  document.getElementById('mini-value').textContent = value ? value.textContent.trim() : '';
  refreshMiniBarVisibility();
}
function refreshMiniBarVisibility() {
  const bar = document.getElementById('mini-bar');
  if (!bar || !miniCard) return;
  const r = miniCard.getBoundingClientRect();
  const inView = r.bottom > 0 && r.top < window.innerHeight;
  // Also hide near the very bottom of the page so the bar never sits on
  // top of the footer / assumptions the user is trying to read.
  const nearBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 120;
  bar.hidden = inView || nearBottom;
}
['scroll', 'resize'].forEach(ev => window.addEventListener(ev, () => {
  if (miniTick) return;
  miniTick = true;
  setTimeout(() => { miniTick = false; refreshMiniBarVisibility(); }, 120);
}, { passive: true }));

/* ---------- Theme toggle (light / dark, persisted) ---------- */
function applyThemeIcon() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('theme-icon-moon').hidden = dark;
  document.getElementById('theme-icon-sun').hidden = !dark;
  document.getElementById('theme-btn').setAttribute('aria-label',
    dark ? 'Switch to light mode' : 'Switch to dark mode');
}
document.getElementById('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('lnTheme', next); } catch (e) {}
  applyThemeIcon();
});
// Follow system changes until the user explicitly picks a theme
if (window.matchMedia) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let stored = null;
    try { stored = localStorage.getItem('lnTheme'); } catch (err) {}
    if (stored !== 'light' && stored !== 'dark') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      applyThemeIcon();
    }
  });
}
applyThemeIcon();

/* ---------- Print: expand collapsed sections so their content renders ---------- */
let printOpenedDetails = [];
window.addEventListener('beforeprint', () => {
  printOpenedDetails = Array.from(document.querySelectorAll('details:not([open])'));
  printOpenedDetails.forEach(d => { d.open = true; });
});
window.addEventListener('afterprint', () => {
  printOpenedDetails.forEach(d => { d.open = false; });
  printOpenedDetails = [];
});

/* ---------- Initial render ---------- */
SHARE.hydrate();
updateLoanModeUI();
formatAllMoney();
syncSliders();
calcLoan();
calcStampDuty();
calcBorrowing();
calcLMI();
SHARE.updateHash();
updateMiniBar();
