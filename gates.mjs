import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import puppeteer from 'puppeteer-core';
import { registry, STATES, isAddress, handleFromUrl } from './src/registry.js';

const results = [];
const gate = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); };
const read = (p) => readFileSync(p, 'utf8');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk('src');
const text = (exts) => src.filter((f) => exts.includes(extname(f))).map((f) => ({ f, t: read(f) }));

/* ---- static gates ---- */
gate('register: every record has a valid state', Object.values(registry).every((r) => STATES.includes(r.state)));
gate('register: absent records carry no url/value', Object.values(registry).filter((r) => r.state === 'absent').every((r) => !r.url && !r.value));
gate('link: handle derived from stored URL', handleFromUrl('https://x.com/Example_1') === 'Example_1' && handleFromUrl(null) === null);
const hex = '0x' + 'aB09'.repeat(10);
gate('0x gate: accepts valid + lowercase hex, rejects short/non-hex', isAddress(hex) && isAddress(hex.toLowerCase()) && !isAddress('0x123') && !isAddress('0x' + 'zz'.repeat(20)));

const colorRe = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\blab\(|\blch\(/;
const stray = text(['.css', '.html', '.js', '.svg']).filter(({ f, t }) => !f.endsWith('tokens.css') && colorRe.test(t.replace(/0x[0-9a-fA-F]+/g, '')));
// favicon is the one asset that cannot read tokens; it must still be oklch chroma-0
const strayNonFav = stray.filter(({ f }) => !f.endsWith('favicon.svg'));
gate('palette: no color literals outside tokens.css', strayNonFav.length === 0, strayNonFav.map((s) => s.f).join(','));
const tok = read('src/tokens.css');
const hexes = [...new Set((tok.match(/#[0-9a-fA-F]{6}/g) || []).map((h) => h.toLowerCase()))];
gate('palette: every sampled literal has provenance (k-means/modal + file + pixel coordinate)', /k-means/.test(tok) && hexes.length >= 5 && hexes.every((h) => new RegExp(h + String.raw`[^\n]*\(\d+,\d+\)`, 'i').test(tok)), hexes.join(','));
gate('css: no ch units', !text(['.css', '.html']).some(({ t }) => /\d\s?ch\b/.test(t)));
gate('hygiene: no CLAUDE.md / .claude / AI attribution', !existsSync('CLAUDE.md') && !existsSync('.claude') && !text(['.css', '.html', '.js', '.svg']).some(({ t }) => /co-authored-by|generated with|claude|anthropic/i.test(t)));
gate('css: reduced-motion fallback present', /prefers-reduced-motion:\s*reduce/.test(read('src/styles.css')));

/* ---- browser gates ---- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const u = req.url.split('?')[0]; const p = join('dist', u === '/' ? 'index.html' : u);
  if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const exe = [process.env.BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
await browser.defaultBrowserContext().overridePermissions(base.slice(0, -1), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
const consoleErrors = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ w = 1366, h = 800, reduce = false, latency = 0, fixture = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.setRequestInterception(true);
  page.on('request', async (r) => {
    const url = r.url();
    if (url.startsWith(base)) return r.continue();
    await delay(latency);
    const json = (b) => r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (url.includes('rpc.mainnet.chain.robinhood.com')) {
      const { method: m, params } = JSON.parse(r.postData());
      if (m === 'eth_getBlockByNumber') return json({ jsonrpc: '2.0', id: 1, result: params[0] === 'latest' ? { number: '0x3e8', timestamp: '0xf4240' } : { number: '0x384', timestamp: '0xf4227' } });
      return json({ jsonrpc: '2.0', id: 1, result: { eth_chainId: '0x1237', eth_blockNumber: '0x3e8', eth_gasPrice: '0x3b9aca00' }[m] });
    }
    if (url.includes('historicalChainTvl')) return json(Array.from({ length: 120 }, (_, i) => ({ date: 1700000000 + 86400 * i, tvl: 1000000 + i * 10000 })));
    if (url.includes('api.llama.fi')) return json([{ name: 'Robinhood Chain', tvl: 2500000 }]);
    if (url.includes('dexscreener.com/latest/dex/search')) return json({ pairs: [
      { chainId: 'robinhood', url: 'https://dexscreener.com/robinhood/beta', baseToken: { symbol: 'BETA', name: 'Beta' }, quoteToken: { symbol: 'WETH' }, priceUsd: '0.00001234', priceChange: { h24: -2.1 }, liquidity: { usd: 100 } },
      { chainId: 'robinhood', url: 'https://dexscreener.com/robinhood/alpha', baseToken: { symbol: 'ALPHA', name: 'Alpha' }, quoteToken: { symbol: 'WETH' }, priceUsd: '1.2345', priceChange: { h24: 5.5 }, liquidity: { usd: 5000 }, info: { imageUrl: 'https://dd.dexscreener.com/a.png' } },
      { chainId: 'other', baseToken: { symbol: 'SKIP' } }] });
    if (url.includes('dd.dexscreener.com')) return r.respond({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
    if (url.includes('dexscreener')) return json({ pairs: [{ chainId: 'robinhood' }, { chainId: 'robinhood' }] });
    return r.abort();
  });
  await page.evaluateOnNewDocument((fx) => {
    window.__POLL_MS__ = 400;
    if (fx) window.__REGISTRY_OVERRIDE__ = fx;
  }, fixture);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return page;
}

const BPS = [360, 390, 430, 1366, 1440];
for (const w of BPS) {
  const page = await open({ w, h: 800, reduce: true });
  await page.waitForFunction(() => document.querySelector('[data-k="block"]')?.textContent.includes('1,000'), { timeout: 5000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('a[href],button,[role="button"],input,select,textarea')].filter((e) => e.getClientRects().length).map((e) => { const b = e.getBoundingClientRect(); return { t: e.outerHTML.slice(0, 50), w: b.width, h: b.height }; }).filter((b) => b.w < 47.99 || b.h < 47.99);
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, bad };
  });
  gate(`${w}px: no overflow, all tap targets >= 48px`, m.sw <= m.iw && m.bad.length === 0, `scrollWidth ${m.sw} vs ${m.iw} ${JSON.stringify(m.bad)}`);
  await page.close();
}

{ // CA slot top + visible, absent state, no date, no hrefs
  const page = await open({ w: 390, reduce: true });
  await page.evaluate(() => scrollTo(0, 0));
  const r = await page.evaluate(() => {
    const e = document.querySelector('#ca'); const b = e.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, text: e.innerText, socialsHref: document.querySelectorAll('#socials a').length, inert: document.querySelectorAll('#socials [aria-disabled="true"]').length, caBtn: !!e.querySelector('button') };
  });
  gate('CA slot: visible at top of page', r.top >= 0 && r.bottom <= 220, `${r.top}-${r.bottom}`);
  if (registry.ca.state === 'stated') gate('CA slot: stated -> full address in a copy button', r.caBtn && r.text.includes(registry.ca.value), r.text);
  else gate('CA slot: inert + no date while absent', !r.caBtn && !/\b(19|20)\d{2}\b|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(r.text), r.text);
  gate('socials: no href for unstated records (both inert)', r.socialsHref === 0 && r.inert === 2);
  await page.close();
}
{ // stated fixture: full address, click-to-copy button, linked socials
  const fx = { domain: { state: 'stated', value: 'smartpay.network' }, ca: { state: 'stated', value: hex }, x: { state: 'stated', url: 'https://x.com/fixture' }, github: { state: 'absent', url: null }, chain: registry.chain };
  const page = await open({ w: 360, reduce: true, fixture: fx });
  const r = await page.evaluate(() => { const b = document.querySelector('#ca button'); return { txt: b?.innerText || '', links: [...document.querySelectorAll('#socials a')].map((a) => a.href), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  gate('CA stated: full address shown in a copy button, no overflow', r.txt.includes(hex) && r.sw <= r.iw);
  gate('socials stated: only stated record links', r.links.length === 1 && r.links[0] === 'https://x.com/fixture');
  await page.close();
}
{ // skeleton -> live values
  const page = await open({ w: 1366, latency: 1200 });
  await delay(150);
  const sk = await page.evaluate(() => document.querySelectorAll('#stats .skel').length);
  gate('skeletons: shown for every network-backed value before arrival', sk === (registry.ca.state === 'stated' ? 4 : 3), `count ${sk}`);
  await page.waitForFunction(() => document.querySelector('[data-k="block"]')?.textContent === '1,000' && document.querySelector('[data-k="tvl"]')?.textContent === '$2.50M' && document.querySelector('[data-k="gas"]')?.textContent === '1.00', { timeout: 9000 }).then(() => gate('live: values resolve and count-up lands on final', true)).catch(async () => gate('live: values resolve and count-up lands on final', false, await page.evaluate(() => document.querySelector('#stats').innerText)));
  const pairs = await page.evaluate(() => document.querySelector('[data-k="pairs"]').textContent + '|' + document.querySelector('[data-sub="pairs"]').textContent);
  const pill = await page.waitForFunction(() => document.querySelector('#pill').dataset.live === 'true', { timeout: 3000 }).then(() => true).catch(() => false);
  if (registry.ca.state === 'stated') {
    const n = await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-k="pairs"]').textContent), { timeout: 5000 }).then(() => true).catch(() => false);
    gate('pairs count from DexScreener when CA stated + status pill live', pill && n, pairs);
  } else gate('pairs honest while CA absent (no fabricated number) + status pill live', pill && pairs.startsWith('—') && /waiting/.test(pairs), pairs);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await delay(250);
  const sc = await page.evaluate(() => document.querySelector('#progress').style.transform);
  gate('scroll progress bar reaches full', /scaleX\((1|0\.99\d*)\)/.test(sc), sc);
  await page.close();
}
{ // reduced motion + copy
  const page = await open({ w: 1366, reduce: true });
  const r = await page.evaluate(() => ({ op: getComputedStyle(document.querySelector('.reveal')).opacity, anim: getComputedStyle(document.querySelector('.dot')).animationName, body: document.body.innerText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ') }));
  gate('reduced-motion: content instantly visible, no animation', r.op === '1');
  const refCopy = 'pay it all with fomo from rides to entertainment food travel and more use fomo to pay for what you want wherever you go one wallet endless possibilities your favorite brands services and experiences all accessible through one simple payment experience your money your way spend on the things you love without the usual limitations fomo gives you more freedom in how you pay from netflix to your next trip entertainment travel food gaming and more one payment experience for the things you use every day more ways to spend turn your fomo balance into real world possibilities from everyday essentials to experiences worth remembering anything anywhere with fomo your next coffee ride meal game or getaway could be just a payment away pay anything with fomo pay anything anywhere with fomo hi users you never have to leave your trading app again for payments more moments less hassle total balance recent payments all activity date made status verified';
  const bi = (s) => { const w = s.split(/\s+/).filter(Boolean); return new Set(w.slice(1).map((x, i) => w[i] + ' ' + x)); };
  const ref = bi(refCopy); const proper = new Set(['robinhood chain', 'smartpay network']); /* proper names, not copy */ const shared = [...bi(r.body)].filter((g) => ref.has(g) && !proper.has(g));
  gate('copy: zero shared 2-grams with reference fixture', shared.length === 0, shared.join(','));
  await page.close();
}
{ // premium widgets, fed by synthetic fixtures
  const page = await open({ w: 1366, reduce: true });
  await page.waitForFunction(() => document.querySelectorAll('#pairs .pair').length === 2 && document.querySelector('#spark .spark-line'), { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#pairs .pair')].map((e) => e.innerText.replace(/\s+/g, ' ')), chips: document.querySelectorAll('#marquee .chip').length, imgs: document.querySelectorAll('#pairs img').length }));
  gate('top pairs + marquee: name, price, 24h change from fixtures (sorted by liquidity)', r.rows.length === 2 && /ALPHA.*\$1\.23.*▲ 5\.50%/.test(r.rows[0]) && /BETA.*▼ 2\.10%/.test(r.rows[1]) && r.chips >= 2 && r.imgs === 1, JSON.stringify(r));
  await page.focus('#spark');
  const pts = await page.$eval('.spark-line', (e) => e.getAttribute('d').split('L').length);
  const a = await page.$eval('#spark-read', (e) => e.textContent);
  await page.keyboard.press('ArrowLeft');
  const b = await page.$eval('#spark-read', (e) => e.textContent);
  gate('TVL sparkline: 90 points, keyboard readout moves a day', pts === 90 && a.startsWith('$2.19M') && b.startsWith('$2.18M'), pts + ' ' + a + ' ' + b);
  const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.focus('#theme'); await page.keyboard.press('Enter');
  const t = await page.evaluate(() => ({ th: document.documentElement.dataset.theme, pr: document.querySelector('#theme').getAttribute('aria-pressed'), bg: getComputedStyle(document.body).backgroundColor, toast: document.querySelector('#toast').textContent }));
  gate('theme toggle: keyboard flips to dark, recolors page, toasts', t.th === 'dark' && t.pr === 'true' && t.bg !== bg0 && /Dark mode on/.test(t.toast), JSON.stringify(t));
  await page.click('#sim-run');
  await page.waitForFunction(() => /Receipt written\./.test(document.querySelector('#sim-out').textContent), { timeout: 3000 }).catch(() => {});
  const done = await page.evaluate(() => document.querySelectorAll('#steps li.done').length);
  await page.click('#copy-rpc');
  const toast = await page.$eval('#toast', (e) => e.textContent);
  gate('payment demo completes (inert) + clipboard action toasts', done === 3 && toast === 'RPC URL copied', done + ' ' + toast);
  await page.close();
}
gate('console: no errors across all runs', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close(); server.close();
let fail = 0;
for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.info}`); }
console.log(`\n${results.length} gates, ${fail} failed`);
if (results.length > 30) { console.log('gate budget exceeded (max 30)'); process.exit(1); }
process.exit(fail ? 1 : 0);
