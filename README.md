# Greenroom — Settlement Health Interpretation Layer

## Short overview

Greenroom is shaped as software for independent music venues handling bookings, advancing, and post-show settlements. In real venues, settlement data rarely lines up cleanly: structured deal fields drift from what was agreed in email, totals get finalized in spreadsheets, and status fields can disagree with recoup lines or sign-off text.

This fork focuses on a **lightweight interpretation layer** for that mess. It does not pretend to finish every deal in-app. Instead, it gives venue operators a **single, calm read** on whether what’s logged in Greenroom is internally consistent enough to trust before they spend time on the worksheet, email, or wire.

The implementation is **read-only and request-time derived**: small deterministic checks, one panel on the settle page, and tests that lock down edge cases so the interpretation stays predictable as seed data grows.

## What I built

- Deterministic **settlement health** derivation (`lib/settlementHealth/derive.ts`) — tool support, total drift vs worksheet, disputed recoups, paid-with-open-recoup, sign-off vs disputed status.
- **Single operational panel** on `/shows/[id]/settle` — status, headline, and findings list; no extra workflow or write paths.
- **Consolidated dispute and reconciliation signals** in that panel so the page doesn’t pile on competing banners and pulses.
- **Reduced duplicate urgency** (page wash, duplicate recoup callout, pulsing header badge) so lifecycle and worksheet stay contextual without alert fatigue.
- **Lightweight regression tests** (`npm run test:health`) for ordering, thresholds, null settlement row, and a few realistic edge cases.

## Product principles

- Human-centered operational UX (especially under time pressure).
- Deterministic-first interpretation — evidence in copy, no black box.
- Calm escalation: reserve strong treatment for issues that actually change trust in the number.
- Additive architecture: interpret existing data; don’t rewrite settlement workflow.
- AI, if added later, as **support for explanation** — not autonomous decisions.

## Scope intentionally excluded

- No settlement workflow rewrite or state machine enforcement in product code.
- No write paths, Server Actions, or database migrations for this layer.
- No AI-generated verdicts or automated status changes.
- No browser automation / E2E suite.
- No expansion of in-app settlement math to cover every deal type (that gap stays part of the case).

## Local development

Requires **Node.js 20+**. From the repo root:

```bash
npm install
npm run db:reset
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Optional: `npm run test:health` runs the settlement health unit tests.

## Suggested validation flows

- **Coastal Spell** — search or open `/shows/show_coastal_spell_dispute` → Settle: unsupported deal, disputed recoup, notes vs status tension.
- **Paid + disputed recoup** — seeded breadcrumb pattern (e.g. BC3-style rows): health should surface `paid_open_recoup` without treating the page as “done.”
- **Healthy flat guarantee** — pick a simple flat past show with no findings: clear state, humble headline.
- **Unsupported deal** — vs / % net / door: tool-unsupported finding, spreadsheet-oriented copy, worksheet empty state unchanged below.

## Notes

The goal was not to “solve settlement,” but to ship a **trustworthy operational interpretation** on top of data the app already has — so operators can see ambiguity, drift, and open items in one place before they act.
