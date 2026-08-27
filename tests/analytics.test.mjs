import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv, readiness, evidenceLevel, summarizeCampaigns, reconcile, experimentStats, budgetPlan} from '../lib/analytics.mjs';

test('quoted CSV parsing',()=>{
  const r=parseCsv('campaign,revenue\n"Brand, Search",1200');
  assert.equal(r[0].campaign,'Brand, Search');
});

test('readiness rewards core fields',()=>{
  const rows=parseCsv('date,campaign,spend,revenue,conversions\n2026-01-01,A,100,300,3');
  assert.ok(readiness(rows).score>=70);
});

test('group columns alone do not become experimental evidence',()=>{
  const rows=parseCsv('variant,users,conversions\nA,1000,100\nB,1000,130');
  assert.equal(evidenceLevel(rows).level,'DESCRIPTIVE / EXPERIMENT-CANDIDATE');
  assert.equal(experimentStats(rows),null);
});

test('explicit randomized assignment plus users enables experimental analysis',()=>{
  const rows=parseCsv('variant,users,conversions,randomized\nA,10000,1000,yes\nB,10000,1200,yes');
  assert.equal(evidenceLevel(rows).level,'EXPERIMENTAL');
  const s=experimentStats(rows);
  assert.ok(s && s.p<.05 && s.lift>.1);
});

test('impressions are not accepted as a binomial experiment denominator',()=>{
  const rows=parseCsv('variant,impressions,conversions,randomized\nA,10000,1000,yes\nB,10000,1200,yes');
  assert.notEqual(evidenceLevel(rows).level,'EXPERIMENTAL');
  assert.equal(experimentStats(rows),null);
});

test('complete internal revenue becomes the automatic decision basis',()=>{
  const rows=parseCsv('campaign,spend,revenue,internal_revenue,conversions\nA,100,400,250,10');
  const c=summarizeCampaigns(rows,.5,'auto')[0];
  assert.equal(c.revenueBasis,'internal');
  assert.equal(c.revenue,250);
  assert.equal(c.contribution,25);
});

test('partial internal revenue never silently mixes revenue bases',()=>{
  const rows=parseCsv('campaign,spend,revenue,internal_revenue\nA,100,400,250\nB,100,300,');
  const rec=reconcile(rows);
  assert.equal(rec.complete,false);
  assert.equal(rec.pct,null);
  assert.ok(readiness(rows).issues.some(x=>x.includes('partial')));
  const campaigns=summarizeCampaigns(rows,.5,'auto');
  assert.ok(campaigns.every(c=>c.revenueBasis==='platform'));
});

test('platform reconciliation detects complete overstatement',()=>{
  const rows=parseCsv('revenue,internal_revenue\n120,100');
  const rec=reconcile(rows);
  assert.equal(rec.complete,true);
  assert.equal(rec.pct,.2);
});

test('budget plan preserves total budget and does not fund negative-contribution campaigns when positives exist',()=>{
  const rows=parseCsv('campaign,spend,revenue,conversions\nA,100,500,20\nB,100,50,10');
  const p=budgetPlan(summarizeCampaigns(rows,.5,'platform'),1000);
  assert.ok(Math.abs(p.reduce((s,x)=>s+x.suggested,0)-1000)<1e-6);
  assert.equal(p.find(x=>x.name==='B')?.suggested,0);
});
