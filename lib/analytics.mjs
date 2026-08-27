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
  row.push(cell.trim()); if (row.some(v => v !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
const num = v => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
export function readiness(rows) {
  if (!rows.length) return { score: 0, issues: ['No data loaded'], strengths: [] };
  const keys = new Set(Object.keys(rows[0]));
  let score = 35; const issues = [], strengths = [];
  const checks = [['spend',12,['spend','cost']],['revenue',12,['revenue','sales']],['conversions',8,['conversions','orders']],['date',8,['date','day','week']],['channel',7,['channel','platform']],['campaign',5,['campaign']]];
  for (const [label, pts, aliases] of checks) {
    if (aliases.some(a => keys.has(a))) { score += pts; strengths.push(`${label} available`); }
    else issues.push(`Missing ${label} field`);
  }
  const hasExperiment = ['variant','treatment','control','group'].some(k => keys.has(k));
  if (hasExperiment) { score += 8; strengths.push('Experiment-group field detected'); }
  const hasInternal = ['internal_revenue','backend_revenue','orders_internal'].some(k => keys.has(k));
  if (hasInternal) { score += 5; strengths.push('Internal outcome source detected'); }
  if (rows.length >= 26) { score += 5; strengths.push('Useful longitudinal depth'); }
  else issues.push('Short history limits time-series inference');
  return { score: Math.min(100, score), issues: issues.slice(0,5), strengths: strengths.slice(0,5) };
}
export function evidenceLevel(rows) {
  if (!rows.length) return { level: 'INSUFFICIENT', reason: 'Load data first.', rank: 0 };
  const keys = new Set(Object.keys(rows[0]));
  const experiment = ['variant','treatment','control','group'].some(k => keys.has(k)) && ['conversions','orders','converted'].some(k => keys.has(k));
  const geoHoldout = (keys.has('geo') || keys.has('region')) && (keys.has('holdout') || keys.has('treatment'));
  const longitudinal = (keys.has('date') || keys.has('week')) && rows.length >= 52 && (keys.has('spend') || keys.has('cost')) && (keys.has('revenue') || keys.has('sales'));
  if (experiment) return { level: 'EXPERIMENTAL', reason: 'Treatment/group and outcome fields support controlled comparison, subject to design validity.', rank: 4 };
  if (geoHoldout) return { level: 'QUASI-EXPERIMENTAL', reason: 'Geo/region plus holdout structure may support incrementality analysis if assignment was credible.', rank: 3 };
  if (longitudinal) return { level: 'ASSOCIATIONAL / MMM-READY', reason: 'Longitudinal spend and outcome history can support modeled association; causal claims still require stronger design.', rank: 2 };
  return { level: 'DESCRIPTIVE', reason: 'The uploaded data supports performance description and reconciliation, not causal lift.', rank: 1 };
}
export function summarizeCampaigns(rows, margin = 0.55) {
  const groups = new Map();
  for (const r of rows) {
    const key = r.campaign || r.channel || r.platform || 'All traffic';
    const g = groups.get(key) || { name:key, spend:0, revenue:0, conversions:0, internalRevenue:0, impressions:0, clicks:0 };
    g.spend += num(r.spend || r.cost); g.revenue += num(r.revenue || r.sales); g.conversions += num(r.conversions || r.orders);
    g.internalRevenue += num(r.internal_revenue || r.backend_revenue); g.impressions += num(r.impressions); g.clicks += num(r.clicks); groups.set(key,g);
  }
  return [...groups.values()].map(g => {
    const contribution = g.revenue * margin - g.spend;
    return { ...g, roas: g.spend ? g.revenue/g.spend : 0, cpa: g.conversions ? g.spend/g.conversions : 0, contribution, ctr: g.impressions ? g.clicks/g.impressions : 0, discrepancy: g.internalRevenue ? (g.revenue-g.internalRevenue)/g.internalRevenue : 0 };
  }).sort((a,b)=>b.contribution-a.contribution);
}
export function reconcile(rows) {
  let platform=0, internal=0;
  for (const r of rows) { platform += num(r.revenue || r.sales); internal += num(r.internal_revenue || r.backend_revenue); }
  return { platform, internal, delta: internal ? platform-internal : 0, pct: internal ? (platform-internal)/internal : 0, available: internal > 0 };
}
function normalCdf(x) { const t = 1/(1+0.2316419*Math.abs(x)); const d = 0.3989423*Math.exp(-x*x/2); const p = 1-d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return x > 0 ? p : 1-p; }
export function experimentStats(rows) {
  if (!rows.length) return null;
  const keys = new Set(Object.keys(rows[0])); const groupKey = ['variant','group','treatment'].find(k=>keys.has(k));
  if (!groupKey) return null;
  const map = new Map();
  for (const r of rows) { const name = r[groupKey] || 'unknown'; const g = map.get(name) || {name, users:0, conversions:0}; g.users += num(r.users || r.sessions || r.visitors || r.impressions); g.conversions += num(r.conversions || r.orders || r.converted); map.set(name,g); }
  const groups=[...map.values()].filter(g=>g.users>0); if(groups.length!==2) return null;
  const [a,b]=groups; const p1=a.conversions/a.users,p2=b.conversions/b.users, pooled=(a.conversions+b.conversions)/(a.users+b.users);
  const se=Math.sqrt(pooled*(1-pooled)*(1/a.users+1/b.users)); const z=se? (p2-p1)/se:0; const p=2*(1-normalCdf(Math.abs(z)));
  const diff=p2-p1; const seDiff=Math.sqrt(p1*(1-p1)/a.users+p2*(1-p2)/b.users);
  return { a:{...a,rate:p1}, b:{...b,rate:p2}, lift:p1?diff/p1:0, diff, z, p, ci:[diff-1.96*seDiff,diff+1.96*seDiff], significant:p<0.05 };
}
export function budgetPlan(campaigns, budget) {
  const viable = campaigns.filter(c=>c.spend>0);
  const scores = viable.map(c => ({...c, score: Math.max(0.05, (c.contribution/c.spend)+1)})); const total = scores.reduce((s,c)=>s+c.score,0) || 1;
  return scores.map(c=>({ name:c.name, current:c.spend, suggested:budget*c.score/total, confidence: c.revenue>0 && c.conversions>=10 ? 'medium' : 'low' })).sort((a,b)=>b.suggested-a.suggested);
}
export function decisionFor(c) { if (c.spend <= 0) return 'INVESTIGATE'; if (c.contribution > 0 && c.roas >= 2) return 'INCREASE'; if (c.contribution > 0) return 'HOLD'; if (c.roas < 0.8) return 'STOP / REVIEW'; return 'INVESTIGATE'; }
