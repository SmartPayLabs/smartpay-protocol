# SmartPay

SmartPay is an onchain payment network on **Robinhood Chain** (chain id 4663). One balance, verified receipts, and checkout flows for the things people buy every week: streaming plans, rides, meals, game top-ups, flights and stays.

Site: <https://smartpay.network>

## Status

Early build. The marketing site is live-data aware (block height, gas, chain TVL) and every external fact it shows is tracked in a single register, so nothing is displayed as true until it has been stated.

| Item | State |
| --- | --- |
| Website | in progress |
| Contract address | not stated yet |
| Payment contracts | design phase, see [architecture](docs/architecture.md) |
| Audit | not started |

## Repository layout

```
src/        static site (HTML, CSS, ES modules)
docs/       whitepaper, tokenomics, roadmap, architecture
brand/      logo files
reference/  product slides used as the source for site messaging
gates.mjs   automated checks (layout, tap targets, copy, palette)
```

## Develop

```bash
npm install
npm run build   # copies src/ to dist/
npm run gates   # runs the quality gates against dist/
```

The gates open the built site in a real browser at five widths (360, 390, 430, 1366, 1440 px), using synthetic network fixtures only.

## Principles

1. **Register first.** Every external fact (contract address, social links, chain details) is a record with a state of `stated`, `absent` or `unconfirmed`.
2. **Links are derived.** Store the URL, derive the handle. Unstated records render without a link.
3. **Hex addresses are valid input.** Validation checks shape and never rejects `0x` outright.
4. **One tokens file.** Colour literals live in `src/tokens.css` and nowhere else.

## Documentation

- [Whitepaper](docs/whitepaper.md)
- [Tokenomics](docs/tokenomics.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Contributing](.github/CONTRIBUTING.md)
- [Security policy](.github/SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).
