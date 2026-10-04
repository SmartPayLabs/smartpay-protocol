import { $, $$, reduce } from './ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Inert rehearsal of a send. No wallet, no network, no value moves.
export function initSim() {
  const run = $('#sim-run'); const out = $('#sim-out'); const steps = $$('#steps li');
  const chips = $$('.amounts button');
  let amount = '12.40'; let busy = false;

  chips.forEach((b) => b.addEventListener('click', () => {
    if (busy) return;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    amount = b.dataset.amt;
    reset();
    out.textContent = `Sample amount set to $${amount}.`;
  }));

  function reset() { steps.forEach((s) => s.classList.remove('now', 'done')); run.textContent = 'Run demo'; }

  run.addEventListener('click', async () => {
    if (busy) return;
    busy = true; run.disabled = true; reset();
    const labels = [`Locking a quote for $${amount}…`, 'Waiting for a simulated approval…', 'Writing a sample receipt…'];
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('now'); out.textContent = labels[i];
      if (!reduce) await sleep(750);
      steps[i].classList.replace('now', 'done');
    }
    out.textContent = `Receipt written. Corner Cafe is credited $${amount}. Nothing real moved.`;
    run.textContent = 'Replay'; run.disabled = false; busy = false;
  });
}
