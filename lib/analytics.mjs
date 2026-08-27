export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(v => v !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const num = v => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const nonBlank = v => String(v ?? '').trim() !== '';
const keysOf = rows => new Set(rows.flatMap(r => Object.keys(r)));
const hasAny = (keys, aliases) => aliases.some(k => keys.has(k));
const findKey = (keys, aliases) => aliases.find(k => keys.has(k));

function randomizationEvidence(rows) {
  const keys = keysOf(rows);
  const booleanKey = findKey(keys, ['randomized','randomised','random_assignment']);
  if (booleanKey && rows.some(r => /^(1|true|yes|y|randomized|randomised)$/i.test(String(r[booleanKey] ?? '').trim()))) return true;
  const methodKey = findKey(keys, ['assignment_method','experiment_design','design']);
  if (methodKey && rows.some(r => /random|rct/i.test(String(r[methodKey] ?? '')))) return true;
  return false;
}

function experimentStructure(rows) {
  const keys = keysOf(rows);
  return {
    groupKey: findKey(keys, ['variant','group','treatment']),
    outcomeKey: findKey(keys, ['conversions','orders','converted']),
    denominatorKey: findKey(keys, ['users','sessions','visitors']),
    randomized: randomizationEvidence(rows)
  };
}

export function readiness(rows) {
  if (!rows.length) return { score: 0, issues: ['No data loaded'], strengths: [] };
  const keys = keysOf(rows);
  let score = 35;
  const issues = [], strengths = [];
  const checks = [
    ['spend',12,['spend','cost']],['revenue',12,['revenue','sales']],['conversions',8,['conversions','orders']],
    ['date',8,['date','day','week']],['channel',7,['channel','platform']],['campaign',5,['campaign']]
  ];
  for (const [label, pts, aliases] of checks) {
    if (hasAny(keys, aliases)) { score += pts; strengths.push(`${label} available`); }
    else issues.push(`Missing ${label} field`);
  }
  const exp = experimentStructure(rows);
  if (exp.groupKey && exp.outcomeKey && exp.denominatorKey) {
    if (exp.randomized) { score += 8; strengths.push('Randomized experiment structure documented'); }
    else issues.push('Experiment-like columns found, but randomized assignment is not documented');
  } else if (exp.groupKey) issues.push('Experiment group exists but users/sessions and outcome fields are incomplete');

  const internalKey = findKey(keys, ['internal_revenue','backend_revenue']);
  const internalComplete = !!internalKey && rows.every(r => nonBlank(r[internalKey]));
  if (internalComplete) { score += 5; strengths.push('Complete internal revenue outcome detected'); }
  else if (internalKey) issues.push('Internal revenue is partial; campaign decisions should not mix revenue bases');

  if (rows.length >= 26) { score += 5; strengths.push('Useful longitudinal depth'); }
  else issues.push('Short history limits time-series inference');
  return { score: Math.min(100, score), issues: issues.slice(0,6), strengths: strengths.slice(0,6) };
}

export function evidenceLevel(rows) {
  if (!rows.length) return { level: 'INSUFFICIENT', reason: 'Load data first.', rank: 0 };
  const keys = keysOf(rows);
  const exp = experimentStructure(rows);
  const experimentCandidate = !!(exp.groupKey && exp.outcomeKey && exp.denominatorKey);
  const geoHoldout = (keys.has('geo') || keys.has('region')) && (keys.has('holdout') || keys.has('treatment'));
  const longitudinal = (keys.has('date') || keys.has('week')) && rows.length >= 52 && hasAny(keys,['spend','cost']) && hasAny(keys,['revenue','sales','internal_revenue','backend_revenue']);

  if (experimentCandidate && exp.randomized) return { level: 'EXPERIMENTAL', reason: 'Two-group outcome data includes a valid user/session denominator and explicit randomized-assignment metadata. Instrumentation still needs real-world verification.', rank: 4 };
  if (geoHoldout) return { level: 'QUASI-EXPERIMENTAL CANDIDATE', reason: 'Geo/region plus holdout structure may support incrementality analysis, but assignment credibility and pre-period comparability must be verified before causal claims.', rank: 3 };
  if (longitudinal) return { level: 'ASSOCIATIONAL / MMM-CANDIDATE', reason: 'Longitudinal spend and outcome history can support modeled association. A production MMM still needs diagnostics, controls and enough variation.', rank: 2 };
  if (experimentCandidate) return { level: 'DESCRIPTIVE / EXPERIMENT-CANDIDATE', reason: 'Group, outcome and exposure fields are present, but randomized assignment is not documented. The file can describe group differences, not establish causal lift.', rank: 1 };
  return { level: 'DESCRIPTIVE', reason: 'The uploaded data supports performance description and reconciliation, not causal lift.', rank: 1 };
}

function internalRevenueInfo(rows) {
  const keys = keysOf(rows);
  const key = findKey(keys, ['internal_revenue','backend_revenue']);
  if (!key) return { key:null, count:0, complete:false };
  const count = rows.filter(r => nonBlank(r[key])).length;
  return { key, count, complete: rows.length > 0 && count === rows.length };
}

export function summarizeCampaigns(rows, margin = 0.55, revenueBasis = 'auto') {
  const internal = internalRevenueInfo(rows);
  const resolvedBasis = revenueBasis === 'internal' && internal.complete ? 'internal' : revenueBasis === 'platform' ? 'platform' : internal.complete ? 'internal' : 'platform';
  const groups = new Map();
  for (const r of rows) {
    const key = r.campaign || r.channel || r.platform || 'All traffic';
    const g = groups.get(key) || { name:key, spend:0, platformRevenue:0, internalRevenue:0, conversions:0, impressions:0, clicks:0 };
    g.spend += num(r.spend || r.cost);
    g.platformRevenue += num(r.revenue || r.sales);
    g.internalRevenue += internal.key ? num(r[internal.key]) : 0;
    g.conversions += num(r.conversions || r.orders);
    g.impressions += num(r.impressions);
    g.clicks += num(r.clicks);
    groups.set(key,g);
  }
  return [...groups.values()].map(g => {
    const revenue = resolvedBasis === 'internal' ? g.internalRevenue : g.platformRevenue;
    const contribution = revenue * margin - g.spend;
    return {
      ...g, revenue, revenueBasis: resolvedBasis, contribution,
      roas: g.spend ? revenue/g.spend : 0,
      cpa: g.conversions ? g.spend/g.conversions : 0,
      ctr: g.impressions ? g.clicks/g.impressions : 0,
      discrepancy: g.internalRevenue ? (g.platformRevenue-g.internalRevenue)/g.internalRevenue : 0
    };
  }).sort((a,b)=>b.contribution-a.contribution);
}

export function reconcile(rows) {
  const internalInfo = internalRevenueInfo(rows);
  let platform=0, internal=0;
  for (const r of rows) {
    platform += num(r.revenue || r.sales);
    if (internalInfo.key && nonBlank(r[internalInfo.key])) internal += num(r[internalInfo.key]);
  }
  const complete = internalInfo.complete;
  return {
    platform, internal,
    delta: complete ? platform-internal : 0,
    pct: complete && internal ? (platform-internal)/internal : null,
    available: internalInfo.count > 0,
    complete,
    coverage: rows.length ? internalInfo.count/rows.length : 0
  };
}

function normalCdf(x) {
  const t = 1/(1+0.2316419*Math.abs(x));
  const d = 0.3989423*Math.exp(-x*x/2);
  const p = 1-d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return x > 0 ? p : 1-p;
}

export function experimentStats(rows) {
  if (!rows.length) return null;
  const structure = experimentStructure(rows);
  if (!structure.groupKey || !structure.outcomeKey || !structure.denominatorKey || !structure.randomized) return null;
  const map = new Map();
  for (const r of rows) {
    const name = r[structure.groupKey] || 'unknown';
    const g = map.get(name) || {name, users:0, conversions:0};
    g.users += num(r[structure.denominatorKey]);
    g.conversions += num(r[structure.outcomeKey]);
    map.set(name,g);
  }
  const groups=[...map.values()].filter(g=>g.users>0 && g.conversions>=0 && g.conversions<=g.users);
  if(groups.length!==2) return null;
  const [a,b]=groups;
  const p1=a.conversions/a.users,p2=b.conversions/b.users, pooled=(a.conversions+b.conversions)/(a.users+b.users);
  const se=Math.sqrt(pooled*(1-pooled)*(1/a.users+1/b.users));
  const z=se ? (p2-p1)/se : 0;
  const p=2*(1-normalCdf(Math.abs(z)));
  const diff=p2-p1;
  const seDiff=Math.sqrt(p1*(1-p1)/a.users+p2*(1-p2)/b.users);
  return { a:{...a,rate:p1}, b:{...b,rate:p2}, lift:p1?diff/p1:0, diff, z, p, ci:[diff-1.96*seDiff,diff+1.96*seDiff], significant:p<0.05 };
}

export function budgetPlan(campaigns, budget) {
  const viable = campaigns.filter(c=>c.spend>0);
  const positive = viable.map(c => ({...c, score: Math.max(0, c.contribution/c.spend)}));
  const positiveTotal = positive.reduce((s,c)=>s+c.score,0);
  if (positiveTotal > 0) {
    return positive.map(c=>({
      name:c.name,current:c.spend,suggested:budget*c.score/positiveTotal,
      confidence:c.revenue>0 && c.conversions>=10?'medium':'low'
    })).sort((a,b)=>b.suggested-a.suggested);
  }
  const spendTotal = viable.reduce((s,c)=>s+c.spend,0) || 1;
  return viable.map(c=>({name:c.name,current:c.spend,suggested:budget*c.spend/spendTotal,confidence:'low'})).sort((a,b)=>b.suggested-a.suggested);
}

export function decisionFor(c) {
  if (c.spend <= 0) return 'INVESTIGATE';
  if (c.contribution > 0 && c.roas >= 2) return 'SCALE CANDIDATE';
  if (c.contribution > 0) return 'HOLD';
  if (c.roas < 0.8) return 'STOP / REVIEW';
  return 'INVESTIGATE';
}
