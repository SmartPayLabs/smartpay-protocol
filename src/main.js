import { registry as defaultRegistry, isStated, isAddress, handleFromUrl } from './registry.js';
import { $, copyText, initTheme, initMotion } from './ui.js';
import { startLive } from './live.js';
import { initSim } from './sim.js';

const registry = window.__REGISTRY_OVERRIDE__ || defaultRegistry;

/* ---------- CA slot ---------- */
function renderCA() {
  const host = $('#ca');
  const r = registry.ca;
  if (isStated(r) && isAddress(r.value)) {
    const b = document.createElement('button');
    b.className = 'ca-btn'; b.type = 'button';
    b.setAttribute('aria-label', 'Copy contract address');
    b.innerHTML = '<span class="ca-label">CA</span><span class="ca-addr"></span><span class="ca-hint">Tap to copy</span>';
    $('.ca-addr', b).textContent = r.value;
    const hint = $('.ca-hint', b);
    b.addEventListener('click', async () => {
      const ok = await copyText(r.value, 'Address');
      hint.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => (hint.textContent = 'Tap to copy'), 1600);
    });
    host.replaceChildren(b);
  } else {
    const d = document.createElement('div');
    d.className = 'ca-slot';
    d.innerHTML = '<span class="ca-label">CA</span><span class="ca-addr">Not stated yet</span>';
    host.replaceChildren(d);
  }
}

/* ---------- socials ---------- */
const ICONS = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.2 2H21l-6.5 7.4L22 22h-6l-4.7-6.2L5.8 22H3l7-8L2 2h6.1l4.2 5.6zm-1 18h1.7L7 3.9H5.2z"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
};
function renderSocials() {
  const host = $('#socials');
  host.replaceChildren();
  for (const k of ['x', 'github']) {
    const r = registry[k];
    const label = k === 'x' ? 'X' : 'GitHub';
    if (isStated(r) && r.url) {
      const a = document.createElement('a');
      a.className = 'icon'; a.href = r.url; a.rel = 'noopener noreferrer'; a.target = '_blank';
      const h = handleFromUrl(r.url);
      a.setAttribute('aria-label', h ? `${label} @${h}` : label);
      a.innerHTML = ICONS[k];
      host.append(a);
    } else {
      const s = document.createElement('span');
      s.className = 'icon'; s.setAttribute('role', 'img'); s.setAttribute('aria-label', `${label} not available yet`);
      s.setAttribute('aria-disabled', 'true'); s.dataset.inert = k;
      s.innerHTML = ICONS[k];
      host.append(s);
    }
  }
}

renderCA(); renderSocials(); initTheme(); initMotion(); initSim();
$('#foot-domain').textContent = isStated(registry.domain) ? registry.domain.value : '';
$('#pill').dataset.live = 'false';
startLive(registry);
