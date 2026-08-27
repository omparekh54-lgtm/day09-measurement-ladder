# Measurement Ladder

Day 09 of the 100 Days of Data Science challenge.

Measurement Ladder is a privacy-first marketing measurement workbench that starts with a methodological question: **what is the strongest claim this uploaded data can legitimately support?** It then reconciles campaign economics, internal vs platform revenue, controlled experiments when present, and a scenario-only budget sandbox.

## Why this is not just another attribution dashboard

Most dashboards begin by assigning credit. Measurement Ladder begins by limiting the claim. It labels the current evidence as **Descriptive, Associational/MMM-ready, Quasi-experimental, or Experimental** based on the structure actually present, and it never upgrades observational performance data into causal lift.

## Core workflow

1. Upload a campaign CSV or use the optional demo.
2. Review the measurement-readiness score and data-quality blockers.
3. Inspect the evidence-strength rung and why it was chosen.
4. Review campaign economics using a user-controlled gross-margin assumption.
5. Reconcile platform-reported revenue against internal/backend revenue when available.
6. If a valid 2-group experiment is present, inspect conversion lift, z-test p-value, and a 95% confidence interval.
7. Stress-test a scenario budget; allocations are explicitly labelled heuristic, not causal.
8. Export an Increase / Hold / Investigate / Stop decision memo.

## Input contract

CSV is the production input. Useful columns include `date`/`week`, `channel`/`platform`, `campaign`, `spend`/`cost`, `revenue`/`sales`, `internal_revenue` or `backend_revenue`, `conversions`/`orders`, `impressions`, `clicks`, experiment fields such as `variant`/`group`/`treatment` plus `users`/`sessions`, and optional `geo`/`region` + `holdout` fields.

The app processes uploaded CSVs in the browser. There is no application database.

## Methodology

- **Readiness score:** transparent completeness heuristic rewarding core performance, longitudinal, experiment and internal-outcome fields.
- **Evidence ladder:** controlled group + outcome data can reach Experimental; geo/holdout structure is Quasi-experimental; sufficiently long spend/outcome series is only labelled Associational / MMM-ready; other campaign files remain Descriptive.
- **Economics:** ROAS, CPA, and contribution after media = `revenue × gross margin − spend`.
- **Reconciliation:** compares platform revenue with internal observed revenue when both are supplied.
- **Experiment:** two-proportion pooled z-test with 95% confidence interval for the absolute conversion-rate difference. The UI still warns that randomization/instrumentation validity must be checked.
- **Budget sandbox:** transparent allocation heuristic based on observed contribution efficiency. It is a simulation aid, not an incremental-response curve.

## Confidence & honesty layer

- **Known from data:** spend, revenue, conversions, platform/internal discrepancy.
- **Statistical estimate:** experiment lift, p-value and confidence interval; contribution after applying the user's gross-margin assumption.
- **Heuristic:** readiness score, evidence-rung detection, Increase/Hold/Investigate/Stop cue, budget weights.
- **Not claimed:** platform attribution truth, incremental ROAS from observational rows, causal impact of budget changes, or MMM validity without appropriate time-series depth and diagnostics.

## Tests

`npm test` covers quoted CSV parsing, readiness scoring, evidence-level detection, contribution economics, platform reconciliation, controlled-experiment statistics and budget-total preservation.

## Local development

```bash
npm install
npm test
npm run build
npm run dev
```

## Limitations

- CSV only in this release; ad-platform APIs are intentionally out of scope.
- Evidence-rung detection evaluates file structure, not the real-world integrity of randomization or geo assignment.
- Experiment support is limited to a simple two-group binary-outcome analysis.
- No production MMM is fit in-browser; the app only identifies when the data starts to look longitudinally suitable.
- Budget allocation is a scenario heuristic and should never be represented as a causal forecast.
- Naming-taxonomy cleanup, identity resolution and multi-touch path reconstruction are not implemented.

## Deployment

Designed for Next.js 16 and Vercel. No environment variables are required.
