# SmartPay Whitepaper

*Working draft. Figures marked TBD are intentionally unset until they are decided and published.*

## 1. The problem

Spending digital assets on ordinary things is still a chain of detours. A holder sells into a stablecoin, moves it to an exchange, withdraws to a card, waits, and then pays. Every hop adds a fee, a delay and a place for something to go wrong. Merchants, meanwhile, see none of the benefits of open settlement: they wait days, absorb chargebacks and reconcile by hand.

## 2. What SmartPay is

SmartPay is a payment network on Robinhood Chain. A person holds a single balance. A merchant presents a request. The network quotes the total, takes the payment, credits the merchant and writes a receipt that anyone can verify. There is no card rail in the middle and no separate ledger to trust.

### Design goals

- **One balance, many places.** Streaming, rides, food, gaming and travel share the same funding source.
- **Quote before commit.** The payer sees the exact amount, the asset and the fee before signing.
- **Receipts that outlive the app.** Each settlement emits an event the payer, merchant and any auditor can read directly from the chain.
- **Boring for the user.** Nothing in the flow should require knowing what a bridge or a gas token is.

## 3. How a payment moves

1. A merchant integration creates a *payment request* with an amount, a currency denomination and an expiry.
2. The payer's wallet opens the request, and the router contract returns a firm quote in the payer's chosen asset.
3. The payer signs one transaction. The router pulls funds, pays the merchant's settlement address and emits a `Settled` event.
4. The receipt record references the request id, so refunds and disputes point at a real, immutable object.

Detailed component notes are in [architecture](architecture.md).

## 4. Why Robinhood Chain

Robinhood Chain gives SmartPay a settlement layer built with mainstream users in mind, fast block times and a familiar tooling surface. SmartPay reads chain state directly over public RPC and does not depend on an off-chain database to know whether a payment happened.

## 5. Merchants

Merchants integrate through a hosted checkout link or a small SDK. They choose whether to settle in the payment asset or in a stable denomination. Settlement is final once the event is emitted; refunds are explicit new transactions that reference the original receipt.

## 6. Risks

- **Smart-contract risk.** Router and registry contracts will be audited before holding user funds; audits will be published in full.
- **Pricing risk.** Quotes carry short expiries to limit exposure to volatile assets.
- **Dependency risk.** The network depends on Robinhood Chain liveness and on public RPC endpoints; clients fail closed when the chain id or block height cannot be confirmed.
- **Regulatory risk.** Payments touch regulated activity in many jurisdictions. Rollout will be region by region.

## 7. What is not decided yet

The contract address, the token model and the merchant fee schedule are not finalised. See [tokenomics](tokenomics.md) for the framework that will govern them.
