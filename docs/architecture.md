# Architecture

## Overview

```
 wallet  --->  checkout UI  --->  router contract  --->  merchant settlement address
                                      |
                                      +--> registry (requests, receipts)
                                      +--> fee splitter --> treasury
 site / apps  <--- public RPC + indexers (read only)
```

## Components

### Payment registry
Stores payment requests: `id`, `merchant`, `amount`, `denomination`, `expiry`, `status`. A request is created by the merchant and can only move from `open` to `settled`, `expired` or `cancelled`.

### Router
Takes a request id and a payer's chosen asset, returns a firm quote, and on a single signature moves funds to the merchant and the fee splitter. Emits `Settled(requestId, payer, merchant, asset, amount, fee)`.

### Fee splitter
Divides the protocol fee between treasury and merchant-bond rewards using on-chain ratios that governance can adjust behind a time delay.

### Merchant bond vault
Holds bonds that back refunds and disputes. Slashing conditions are explicit and referenced by receipt id.

### Read layer
The website never trusts a private database. It reads chain state directly:

- `eth_chainId` must equal `4663`, otherwise the UI treats all chain data as unconfirmed
- `eth_blockNumber` and `eth_gasPrice` drive the live network cards
- Chain TVL comes from a public aggregator; if the chain is not listed, the card says so instead of guessing

## Chain parameters

| Field | Value |
| --- | --- |
| Network | Robinhood Chain |
| Chain id | 4663 |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |

## Front-end structure

- `src/registry.js` is the single register of external facts. Each record has a state: `stated`, `absent` or `unconfirmed`.
- `src/tokens.css` holds every colour literal.
- `src/main.js` renders records, polls live data and handles motion. All motion has an instant fallback under `prefers-reduced-motion`.

## Failure behaviour

| Condition | Result |
| --- | --- |
| RPC unreachable | Cards show an em dash, status pill reads Offline |
| Chain id mismatch | Treated as unreachable |
| Contract address absent | Copy slot is inert, pair count is not queried |
| Aggregator missing the chain | TVL card marked unconfirmed |

## Security boundaries

Contracts hold no upgrade keys without a timelock. Quotes expire. The checkout UI never asks for a seed phrase or a private key under any circumstance. See the [security policy](../.github/SECURITY.md).
