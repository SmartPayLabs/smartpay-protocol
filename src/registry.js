// Every external fact is one record. state: 'stated' | 'absent' | 'unconfirmed'
export const STATES = ['stated', 'absent', 'unconfirmed'];

export const registry = {
  domain:  { state: 'stated', value: 'smartpay.network' },
  ca:      { state: 'absent', value: null },
  x:       { state: 'absent', url: null },
  github:  { state: 'absent', url: null },
  chain:   { state: 'stated', name: 'Robinhood Chain', id: 4663, rpc: 'https://rpc.mainnet.chain.robinhood.com' },
};

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const isAddress = (s) => typeof s === 'string' && ADDRESS_RE.test(s);

// store URL, derive handle
export function handleFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg || null;
  } catch { return null; }
}
export const isStated = (r) => r && r.state === 'stated';
