# Contributing to SmartPay

Thanks for helping. This guide keeps changes small, reviewable and consistent.

## Getting started

```bash
npm install
npm run build
npm run gates
```

Both commands must exit 0 before you open a pull request.

## Ground rules

- **Register first.** Any external fact (address, social URL, chain detail) goes into `src/registry.js` as a record with a state. Do not hard-code it in markup.
- **No link without a statement.** Records that are not `stated` must not render an `href`.
- **Colours live in one file.** Add literals to `src/tokens.css` only, with a provenance comment. Reference variables everywhere else.
- **Accessibility is a gate.** Interactive elements are at least 48 px, there is no horizontal overflow at 360 to 1440 px, and every animation has a reduced-motion fallback.
- **Write your own copy.** Site text must be original. The copy gate compares against reference text and fails on shared two-word phrases.

## Pull requests

1. Open an issue first for anything larger than a typo.
2. Keep one concern per pull request.
3. Describe what changed and how you checked it. Include screenshots for visual work at a narrow and a wide width.
4. Add or adjust a gate if you introduce behaviour worth protecting.

## Commit style

Short imperative subject line, a blank line, then the reasoning if it is not obvious. Example: `Derive social handle from stored URL`.

## Code style

Plain HTML, CSS and ES modules. No framework, no build-time transforms. Match the surrounding file.

## Reporting problems

Bugs and ideas go in the issue tracker. Security problems do not: follow the [security policy](SECURITY.md).
