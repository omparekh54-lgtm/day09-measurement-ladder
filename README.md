# Measurement Ladder

Day 09 of the 100 Days of Data Science challenge.

Measurement Ladder is a privacy-first marketing measurement workbench that starts with a methodological question: **what is the strongest claim this uploaded data can legitimately support?** It then reconciles campaign economics, internal vs platform revenue, controlled experiments when the design is explicitly documented, and a scenario-only budget sandbox.

## Why this is not just another attribution dashboard

Most dashboards begin by assigning credit. Measurement Ladder begins by limiting the claim. It separates platform-reported revenue from backend-observed revenue, refuses to call group differences experimental without explicit randomized-assignment metadata, and never upgrades observational performance data into causal lift.

## Core workflow

1. Upload a campaign CSV or use the optional demo.
2. Review measurement readiness and data-quality blockers.
3. Inspect the evidence-strength rung and the exact reason it was chosen.
4. Review campaign economics using a user-controlled gross-margin assumption.
5. Reconcile platform-reported revenue against internal/backend revenue.
6. When internal revenue is complete, use it automatically for decision economics or deliberately switch to platform revenue for sensitivity analysis.
7. Only when a two-group file includes a valid `users`/`sessions`/`visitors` denominator **and explicit randomized-assignment metadata**, inspect conversion lift, z-test p-value and a 95% confidence interval.
8. Stress-test a scenario budget; positive observed contribution efficiency can influence allocation, while negative-contribution campaigns receive no scenario budget when positive alternatives exist.
9. Export a decision memo that states the evidence level and revenue basis used.

## Input contract

CSV is the production input. Useful columns include `date`/`week`, `channel`/`platform`, `campaign`, `spend`/`cost`, `revenue`/`sales`, `internal_revenue` or `backend_revenue`, `conversions`/`orders`, `impressions`, `clicks`, and optional `geo`/`region` + `holdout` fields.

For randomized experiment analysis, provide:

- `variant` / `group` / `treatment`
- `conversions` / `orders` / `converted`
- a user-level denominator: `users` / `sessions` / `visitors`
- explicit randomization metadata such as `randomized=yes`, `random_assignment=yes`, or an `assignment_method` / `experiment_design` value containing `random` or `RCT`

**Impressions are intentionally not accepted as the denominator for a binary user-conversion test**, because repeated exposures are not independent users.

The app processes uploaded CSVs in the browser. There is no application database.

## Methodology

- **Readiness score:** transparent completeness heuristic that rewards core performance fields, complete backend outcomes, useful longitudinal depth, and properly documented experiment structure.
- **Evidence ladder:** randomized group + outcome + valid user/session denominator can reach Experimental; geo/holdout structure is only a Quasi-experimental Candidate until assignment credibility and pre-period comparability are verified; sufficiently long spend/outcome series is Associational / MMM-candidate, not a fitted causal MMM.
- **Economics:** contribution after media = `decision-basis revenue × gross margin − spend`.
- **Revenue basis:** complete internal/backend revenue becomes the automatic basis for ROAS, contribution, decision cues and the budget sandbox. Partial backend revenue is never silently mixed with platform revenue; in that case decisions stay on one consistent platform basis and reconciliation reports coverage rather than a misleading aggregate gap.
- **Reconciliation:** compares platform and internal totals only when backend coverage is complete. Partial coverage is shown as coverage, not an apples-to-oranges percentage gap.
- **Experiment:** simple two-proportion pooled z-test with a 95% interval for the absolute conversion-rate difference, only after the structural randomization checks above pass.
- **Budget sandbox:** a transparent heuristic using positive observed contribution efficiency. It is a scenario aid, not an incremental-response curve.

## Confidence & honesty layer

- **Known from data:** spend, supplied revenue, conversions and backend coverage.
- **Estimated:** contribution after applying the user's gross-margin assumption; experiment lift/p-value/CI only for analysis-qualified randomized files.
- **Heuristic:** readiness score, evidence-rung detection, Scale Candidate/Hold/Investigate/Stop cue and budget weights.
- **Not claimed:** platform attribution truth, incremental ROAS from observational rows, causal impact of budget changes, or production MMM validity.

## QA improvements in this release

- Prevented group/outcome columns alone from being labelled Experimental.
- Required explicit randomized-assignment evidence plus a valid user/session denominator for experiment statistics.
- Removed impressions as a conversion-test denominator.
- Made complete backend/internal revenue the default decision basis instead of reconciling it and then ignoring it.
- Prevented partial internal revenue from creating misleading aggregate reconciliation gaps or mixed-basis campaign economics.
- Changed the budget sandbox so negative-contribution campaigns receive zero scenario allocation whenever positive-contribution alternatives exist.
- Renamed `INCREASE` to **Scale Candidate** to make clear that observed economics identify a test candidate, not proven incremental lift.
- Added keyboard-operated upload buttons, clearer form labels, dialog semantics and explicit revenue-basis visibility.
- Production `npm run build` is now gated by the analytics regression suite.
- Added GitHub Actions CI for `npm test` and the full Next.js production build.

## Tests

`npm test` now covers quoted CSV parsing, readiness scoring, experiment-candidate vs randomized-experiment evidence, rejection of impression-only experiment denominators, internal-revenue decision basis, partial-backend safeguards, complete reconciliation and budget preservation/negative-campaign exclusion.

## Local development

```bash
npm install
npm test
npm run build
npm run dev
```

## Limitations

- CSV only; direct ad-platform APIs are intentionally out of scope.
- Explicit randomization metadata in a CSV is still **user-supplied evidence**, not independent verification that the real-world assignment process was valid.
- Experiment support is limited to a simple two-group binary-outcome analysis; no sequential testing, CUPED, covariate adjustment, multiple-testing correction or automated sample-ratio mismatch inference is included.
- Geo/holdout files are only marked as quasi-experimental candidates; this release does not fit synthetic-control, diff-in-diff or geo-lift models.
- No production MMM is fit in-browser; the app only identifies when data begins to look longitudinally suitable.
- Budget allocation is a scenario heuristic and should never be represented as a causal forecast.
- Naming-taxonomy cleanup, identity resolution and multi-touch path reconstruction are not implemented.

## Deployment

Designed for Next.js 16 and Vercel. No environment variables are required.
