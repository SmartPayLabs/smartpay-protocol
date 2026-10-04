# Tokenomics

> **Status: framework only.** No supply, allocation, vesting schedule or contract address has been stated. Nothing in this file is an offer, a promise of return or financial advice. Figures will be added here only when they are final and verifiable onchain.

## Principles

These constraints apply to any token model SmartPay publishes.

1. **Utility before speculation.** The asset exists to make the network work: paying fees, securing merchant bonds and steering governance of the fee schedule.
2. **Everything verifiable.** Supply, treasury wallets and vesting contracts are published as addresses, not screenshots.
3. **No hidden mint.** Supply changes only through rules written down in advance.
4. **Aligned unlocks.** Team and early-contributor allocations vest over multiple years with a cliff, enforced by contract.

## Intended roles

| Role | Description |
| --- | --- |
| Network fee | A small, transparent fee on each settlement, shown in the quote |
| Merchant bond | Merchants lock a bond that backs refund and dispute commitments |
| Governance | Holders vote on fee bands, supported assets and treasury grants |
| Incentives | Rewards for early merchants and integrators, released on usage |

## Fee flow

```
payer -> router -> merchant (amount)
                -> protocol fee -> treasury / bond rewards
```

The share sent to each destination will be declared before launch and changeable only by governance vote with a delay.

## Disclosure checklist before launch

- [ ] Final contract address published and verified
- [ ] Total supply and allocation table published
- [ ] Vesting contracts deployed and linked
- [ ] Treasury multisig signers published
- [ ] Independent audit report linked
