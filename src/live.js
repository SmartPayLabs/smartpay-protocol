import { $, $$, reduce, copyText } from './ui.js';
import { isStated, isAddress } from './registry.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* exponential backoff with jitter */
export async function backoff(fn, { tries = 4, base = 500, max = 8000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (e && e.final) break;
      if (i < tries - 1) await sleep(Math.min(max, base * 2 ** i) * (0.75 + Math.random() * 0.5));
    }
  }
  throw last;
}
const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`http ${r.status}`); return r.json(); });

/* ---------- formatting ---------- */
const fInt = (n) => Math.round(n).toLocaleString('en-US');
const fUsd = (n) => '$' + (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
const fGwei = (n) => n.toFixed(n < 1 ? 4 : 2);
const fPrice = (n) => '$' + (n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 0.01 ? n.toFixed(4) : n.toFixed(8).replace(/0+$/, ''));
const fDate = (s) => new Date(s * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/* ---------- animated numbers (count-up, flash on change) ---------- */
const shown = {};
function setNum(key, value, fmt) {
  const el = $(`[data-k="${key}"]`);
  if (!el) return;
  if (value == null || Number.isNaN(value)) { el.textContent = '—'; return; }
  const prev = shown[key];
  shown[key] = value;
  if (prev === value) { if (el.querySelector('.skel')) el.textContent = fmt(value); return; }
  if (prev !== undefined) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 60); }
  if (reduce) { el.textContent = fmt(value); return; }
  const from = prev ?? 0, t0 = performance.now(), dur = 700;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
}
const setSub = (k, t) => { const e = $(`[data-sub="${k}"]`); if (e) e.textContent = t; };
const setH = (k, node) => { const e = $(`[data-h="${k}"]`); if (e) e.replaceChildren(node); };
const txt = (s) => document.createTextNode(s);
const showRetry = (key, on) => $$(`[data-retry="${key}"]`).forEach((b) => { b.hidden = !on; });
const hasSkel = (el) => !!el && !!el.querySelector('.skel');

function pill(live, text) { const p = $('#pill'); p.dataset.live = String(live); $('#pill-text').textContent = text; }

export function startLive(registry) {
  const rpcUrl = registry.chain.rpc;
  const pollMs = window.__POLL_MS__ || 12000;
  const slowMs = pollMs * 8;

  /* ---------- RPC: block, gas, latency, block time ---------- */
  const rpc = (method, params = []) => fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
    .then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error.message); return j.result; });

  let rpcFails = 0;
  async function pollRpc() {
    try {
      const t0 = performance.now();
      const [cid, blk, gas] = await backoff(() => Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber'), rpc('eth_gasPrice')]), { tries: 2, base: 400 });
      const ms = performance.now() - t0;
      if (parseInt(cid, 16) !== registry.chain.id) { const e = new Error('chain id mismatch'); e.final = true; throw e; }
      const n = parseInt(blk, 16);
      setNum('block', n, fInt);
      setNum('gas', Number(BigInt(gas)) / 1e9, fGwei);
      const slow = ms > 3000;
      pill(true, slow ? 'Degraded' : 'Live');
      const status = document.createDocumentFragment();
      const d = document.createElement('i'); d.className = 'hdot good'; status.append(d, txt(slow ? 'Degraded' : 'Healthy'));
      setH('status', status);
      setH('latency', txt(`${Math.round(ms)} ms`));
      showRetry('rpc', false);
      rpcFails = 0;
      blockTime(n);
      return true;
    } catch {
      rpcFails++;
      setNum('block', null); setNum('gas', null);
      setSub('block', 'unconfirmed'); setSub('gas', 'unconfirmed');
      pill(false, 'Offline');
      const status = document.createDocumentFragment();
      const d = document.createElement('i'); d.className = 'hdot'; status.append(d, txt('Unreachable'));
      setH('status', status); setH('latency', txt('—')); setH('blocktime', txt('—'));
      showRetry('rpc', true);
      return false;
    }
  }
  async function blockTime(n) {
    try {
      const span = 100;
      const [a, b] = await Promise.all([rpc('eth_getBlockByNumber', ['latest', false]), rpc('eth_getBlockByNumber', ['0x' + (n - span).toString(16), false])]);
      const dn = parseInt(a.number, 16) - parseInt(b.number, 16);
      const dt = parseInt(a.timestamp, 16) - parseInt(b.timestamp, 16);
      if (!(dn > 0) || !(dt >= 0)) throw new Error('bad block data');
      const s = dt / dn;
      setH('blocktime', txt(s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`));
    } catch { setH('blocktime', txt('—')); }
  }
  let rpcTimer;
  async function rpcLoop() {
    const ok = await pollRpc();
    rpcTimer = setTimeout(rpcLoop, ok ? pollMs : Math.min(60000, pollMs * 2 ** Math.min(rpcFails, 5)));
  }

  /* ---------- TVL + 90 day sparkline ---------- */
  let series = [];
  function drawSpark() {
    const box = $('#spark');
    if (series.length < 2) { box.replaceChildren(); return false; }
    const W = 300, H = 120, pad = 8;
    const vals = series.map((p) => p.tvl); const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = series.map((p, i) => [(i / (series.length - 1)) * W, H - pad - ((p.tvl - lo) / span) * (H - pad * 2)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c-ink);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--c-ink);stop-opacity:0"/></linearGradient></defs>` +
      `<path class="spark-area" d="${line}L${W} ${H}L0 ${H}Z" fill="url(#sg)"/><path class="spark-line" d="${line}"/><line class="spark-cur" x1="0" x2="0" y1="0" y2="${H}"/>`;
    const dot = document.createElement('i'); dot.className = 'spark-dot';
    box.replaceChildren(svg, dot);
    const cur = svg.querySelector('.spark-cur');
    let idx = series.length - 1;
    const read = $('#spark-read');
    const show = (i) => {
      idx = Math.max(0, Math.min(series.length - 1, i));
      const [x, y] = pts[idx];
      cur.setAttribute('x1', x); cur.setAttribute('x2', x);
      dot.style.left = (x / W * 100) + '%'; dot.style.top = (y / H * 100) + '%';
      const p = series[idx];
      read.replaceChildren(txt(fUsd(p.tvl)));
      const s = document.createElement('small'); s.textContent = fDate(p.date); read.append(s);
    };
    const fromEvent = (e) => { const r = box.getBoundingClientRect(); show(Math.round(((e.clientX - r.left) / r.width) * (series.length - 1))); };
    box.onpointermove = (e) => { box.classList.add('on'); fromEvent(e); };
    box.onpointerdown = (e) => { box.classList.add('on'); fromEvent(e); };
    box.onpointerleave = () => { box.classList.remove('on'); show(series.length - 1); };
    box.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(series.length - 1); }
    };
    show(series.length - 1);
    return true;
  }
  const sparkFail = (msg) => {
    $('#spark').replaceChildren();
    const r = $('#spark-read'); r.replaceChildren(txt('—')); const s = document.createElement('small'); s.textContent = msg; r.append(s);
  };
  async function loadTvl() {
    let listed;
    try {
      const chains = await backoff(() => getJson('https://api.llama.fi/v2/chains'));
      listed = chains.find((x) => /robinhood/i.test(x.name));
      if (!listed) { const e = new Error('not listed'); e.notListed = true; e.final = true; throw e; }
      setNum('tvl', listed.tvl, fUsd);
      setSub('tvl', 'via DefiLlama');
      showRetry('tvl', false);
    } catch (e) {
      setNum('tvl', null);
      setSub('tvl', e && e.notListed ? 'not listed on the aggregator yet' : 'unconfirmed');
      sparkFail(e && e.notListed ? 'Not listed yet' : 'Unconfirmed');
      showRetry('tvl', !(e && e.notListed));
      return;
    }
    try {
      const hist = await backoff(() => getJson('https://api.llama.fi/v2/historicalChainTvl/' + encodeURIComponent(listed.name)));
      series = (Array.isArray(hist) ? hist : []).filter((p) => Number.isFinite(p.date) && Number.isFinite(p.tvl)).slice(-90);
      if (!drawSpark()) sparkFail('No history yet');
    } catch { sparkFail('History unavailable'); showRetry('tvl', true); }
  }

  /* ---------- pairs + marquee ---------- */
  function logoEl(info, symbol) {
    const l = document.createElement('span'); l.className = 'logo';
    const url = info && typeof info.imageUrl === 'string' && info.imageUrl.startsWith('https://') ? info.imageUrl : null;
    const fallback = () => { l.replaceChildren(txt((symbol || '?').slice(0, 1).toUpperCase())); };
    if (url) { const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.onerror = fallback; im.src = url; l.append(im); } else fallback();
    return l;
  }
  function renderPairs(list) {
    const ul = $('#pairs');
    if (!list.length) { const li = document.createElement('li'); li.className = 'msg'; li.textContent = 'No pairs listed yet.'; ul.replaceChildren(li); return; }
    ul.replaceChildren(...list.slice(0, 6).map((p) => {
      const li = document.createElement('li');
      const safe = typeof p.url === 'string' && p.url.startsWith('https://dexscreener.com/');
      const row = document.createElement(safe ? 'a' : 'div'); row.className = 'pair';
      if (safe) { row.href = p.url; row.target = '_blank'; row.rel = 'noopener noreferrer'; }
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = p.baseToken.symbol;
      const sm = document.createElement('small'); sm.textContent = `${p.baseToken.name || p.baseToken.symbol} / ${(p.quoteToken && p.quoteToken.symbol) || '—'}`; nm.append(sm);
      const px = document.createElement('div'); px.className = 'px';
      const price = parseFloat(p.priceUsd);
      px.textContent = Number.isFinite(price) ? fPrice(price) : '—';
      const ch = Number(p.priceChange && p.priceChange.h24);
      const c = document.createElement('small');
      c.textContent = Number.isFinite(ch) ? `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%` : '—';
      px.append(c);
      row.append(logoEl(p.info, p.baseToken.symbol), nm, px);
      li.append(row); return li;
    }));
  }
  function renderMarquee(list) {
    const box = $('#marquee');
    const seen = new Set(); const toks = [];
    for (const p of list) { if (!seen.has(p.baseToken.symbol)) { seen.add(p.baseToken.symbol); toks.push(p); } if (toks.length >= 16) break; }
    if (!toks.length) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'No tokens indexed yet.'; box.classList.remove('run'); box.replaceChildren(d); return; }
    const mk = (p, dup) => {
      const c = document.createElement('span'); c.className = 'chip' + (dup ? ' dup' : ''); if (dup) c.setAttribute('aria-hidden', 'true');
      const price = parseFloat(p.priceUsd);
      c.append(logoEl(p.info, p.baseToken.symbol), txt(p.baseToken.symbol));
      if (Number.isFinite(price)) { const s = document.createElement('small'); s.textContent = fPrice(price); c.append(s); }
      return c;
    };
    const reps = Math.max(2, Math.ceil(10 / toks.length) * 2);
    const chips = document.createElement('div'); chips.className = 'chips';
    for (let r = 0; r < reps; r++) toks.forEach((p) => chips.append(mk(p, r > 0)));
    box.replaceChildren(chips);
    box.style.setProperty('--dur', Math.max(24, toks.length * reps * 2.4) + 's');
    if (!reduce) box.classList.add('run');
  }
  async function loadPairs() {
    // headline count needs a stated contract address; never invent a number
    const ca = registry.ca;
    if (isStated(ca) && isAddress(ca.value)) {
      try {
        const j = await backoff(() => getJson(`https://api.dexscreener.com/latest/dex/tokens/${ca.value}`));
        setNum('pairs', (j.pairs || []).filter((p) => /robinhood/i.test(p.chainId)).length, fInt);
      } catch { setNum('pairs', null); setSub('pairs', 'unconfirmed'); }
    } else { setNum('pairs', null); setSub('pairs', 'waiting on contract address'); }
    try {
      const j = await backoff(() => getJson('https://api.dexscreener.com/latest/dex/search?q=robinhood'));
      const list = (j.pairs || []).filter((p) => /robinhood/i.test(p.chainId || '') && p.baseToken && p.baseToken.symbol)
        .sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
      renderPairs(list); renderMarquee(list); showRetry('pairs', false);
    } catch {
      const li = document.createElement('li'); li.className = 'msg'; li.textContent = '—  Could not load pairs.';
      $('#pairs').replaceChildren(li);
      const d = document.createElement('div'); d.className = 'empty'; d.textContent = '—'; $('#marquee').classList.remove('run'); $('#marquee').replaceChildren(d);
      showRetry('pairs', true);
    }
  }

  /* ---------- wiring ---------- */
  const retries = { rpc: () => { clearTimeout(rpcTimer); rpcLoop(); }, tvl: loadTvl, pairs: loadPairs };
  $$('[data-retry]').forEach((b) => b.addEventListener('click', () => retries[b.dataset.retry]()));
  $('#copy-rpc').addEventListener('click', () => copyText(rpcUrl, 'RPC URL'));

  rpcLoop(); loadTvl(); loadPairs();
  setInterval(() => { loadTvl(); loadPairs(); }, slowMs);
}
