import test from 'node:test'; import assert from 'node:assert/strict';
import {parseCsv, readiness, evidenceLevel, summarizeCampaigns, reconcile, experimentStats, budgetPlan} from '../lib/analytics.mjs';

test('quoted CSV parsing',()=>{const r=parseCsv('campaign,revenue\n"Brand, Search",1200');assert.equal(r[0].campaign,'Brand, Search');});
test('readiness rewards core fields',()=>{const rows=parseCsv('date,campaign,spend,revenue,conversions\n2026-01-01,A,100,300,3');assert.ok(readiness(rows).score>=70);});
test('experiment design is recognized',()=>{const rows=parseCsv('variant,users,conversions\nA,1000,100\nB,1000,130');assert.equal(evidenceLevel(rows).level,'EXPERIMENTAL');});
test('contribution uses gross margin',()=>{const rows=parseCsv('campaign,spend,revenue,conversions\nA,100,400,10');const c=summarizeCampaigns(rows,.5)[0];assert.equal(c.contribution,100);});
test('platform reconciliation detects overstatement',()=>{const rows=parseCsv('revenue,internal_revenue\n120,100');assert.equal(reconcile(rows).pct,.2);});
test('experiment stats detects meaningful lift',()=>{const rows=parseCsv('variant,users,conversions\nA,10000,1000\nB,10000,1200');const s=experimentStats(rows);assert.ok(s && s.p<.05 && s.lift>.1);});
test('budget plan respects total budget',()=>{const rows=parseCsv('campaign,spend,revenue,conversions\nA,100,400,20\nB,100,200,10');const p=budgetPlan(summarizeCampaigns(rows,.5),1000);assert.ok(Math.abs(p.reduce((s,x)=>s+x.suggested,0)-1000)<1e-6);});
