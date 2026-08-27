export type GenericRow = Record<string,string>;
export function parseCsv(text:string): GenericRow[];
export function readiness(rows:GenericRow[]): {score:number;issues:string[];strengths:string[]};
export function evidenceLevel(rows:GenericRow[]): {level:string;reason:string;rank:number};
export function summarizeCampaigns(rows:GenericRow[], margin?:number): Array<{name:string;spend:number;revenue:number;conversions:number;internalRevenue:number;impressions:number;clicks:number;roas:number;cpa:number;contribution:number;ctr:number;discrepancy:number}>;
export function reconcile(rows:GenericRow[]): {platform:number;internal:number;delta:number;pct:number;available:boolean};
export function experimentStats(rows:GenericRow[]): null | {a:{name:string;users:number;conversions:number;rate:number};b:{name:string;users:number;conversions:number;rate:number};lift:number;diff:number;z:number;p:number;ci:[number,number];significant:boolean};
export function budgetPlan(campaigns:ReturnType<typeof summarizeCampaigns>, budget:number): Array<{name:string;current:number;suggested:number;confidence:string}>;
export function decisionFor(c:{spend:number;contribution:number;roas:number}): string;
