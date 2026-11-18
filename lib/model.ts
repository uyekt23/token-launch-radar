// The token radar's model (radar-2): one snapshot of the protocol universe in, one ranked board out.
//
// Where the house starter (radar-1) priced every protocol at one flat multiple of TVL, this model
// derives what a launch is worth from the snapshot's own market evidence:
//
//   1. Peer multiples. Every protocol in the snapshot that already has a token is a priced peer.
//      For each category, the peers' market-cap/TVL ratios give a median multiple. A category with
//      at least MIN_CATEGORY_PEERS peers speaks for itself, shrunk toward the global median so a
//      small sample cannot shout (weight n/(n+K)). A category with too few peers falls back to its
//      economic group's median (curators and allocators price like yield businesses, and so on),
//      and a category with no priced peers anywhere near it falls back to the global median.
//   2. Momentum. TVL growth over the last 7 days, clamped hard (the snapshot carries outliers past
//      +4000%), moves the value by at most GROWTH_WEIGHT of the clamped move.
//   3. Maturity. A protocol DefiLlama has tracked longer has survived more of the market; its
//      launch prices closer to the peer multiple. The factor runs from MATURITY_FLOOR for a
//      brand-new listing to 1.0 at MATURITY_DAYS.
//   4. Breadth. Each extra chain a protocol runs on widens the set of wallets that can farm it:
//      +BREADTH_PER_CHAIN per chain, capped.
//
//   implied = TVL x category multiple x momentum x maturity x breadth
//
// The board ranks every protocol that passes the watchlist's own screen (no token recorded, not a
// wrapped/staked/bridged product, not an exchange, not a versioned pool of another protocol) at any
// TVL the snapshot carries: the 40-name watchlist at the $50M floor is the head of the board, and
// the rows below the floor are the early radar — the launches a farmer can still be early to.
// Live-token protocols are never ranked; the dashboard shows them apart, at the market's own
// values, because they are the evidence the multiples come from. No protocol name is ever
// special-cased: the same functions score every row, and every figure on the board can be
// recomputed from the snapshot alone.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  shrink_k: number;
  min_category_peers: number;
  multiple_min: number;
  multiple_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  shrink_k: 6,
  min_category_peers: 4,
  multiple_min: 0.02,
  multiple_max: 1.5,
  growth_weight: 0.35,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.02,
  breadth_max_chains: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 30;

/**
 * Economic peer groups: categories whose tokens price off the same kind of cash flow. Used only
 * when a category has too few priced peers of its own; the group's multiple is the median of every
 * priced peer in the group, computed from the snapshot at run time, never written down here.
 */
export const PEER_GROUPS: Record<string, string> = {
  'Risk Curators': 'allocation',
  'Onchain Capital Allocator': 'allocation',
  Yield: 'allocation',
  'Yield Aggregator': 'allocation',
  'Liquidity Manager': 'allocation',
  Indexes: 'allocation',
  Farm: 'allocation',
  'Leveraged Farming': 'allocation',
  Lending: 'credit',
  CDP: 'credit',
  'CDP Manager': 'credit',
  'Uncollateralized Lending': 'credit',
  'Collateral Management': 'credit',
  'Collateral Markets': 'credit',
  'Interest Rate Derivatives': 'credit',
  Dexs: 'trading',
  Derivatives: 'trading',
  Options: 'trading',
  'Options Vault': 'trading',
  'Prediction Market': 'trading',
  'OTC Marketplace': 'trading',
  'NFT Marketplace': 'trading',
  Launchpad: 'trading',
  RWA: 'stable-assets',
  'Basis Trading': 'stable-assets',
  'Algo-Stables': 'stable-assets',
  'Dual-Token Stablecoin': 'stable-assets',
  'Stablecoin Wrapper': 'stable-assets',
  'Stablecoin Issuer': 'stable-assets',
  'Reserve Currency': 'stable-assets',
  Synthetics: 'stable-assets',
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    multiple_source: 'category' | 'group' | 'global';
    peer_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  multiple_source: 'category' | 'group' | 'global';
  peer_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** One category's peer evidence, for the dashboard's methodology table. */
export interface CategoryStat {
  category: string;
  group: string | null;
  peers: number;
  median_multiple: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_median_multiple: number;
  category_stats: CategoryStat[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list, computed on a sorted copy so the caller's order survives. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A priced peer: a protocol whose token the snapshot records, with a market cap and real TVL. */
function isPeer(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** The peer evidence of one snapshot: per-category ratios, per-group ratios, and the global median. */
export interface PeerEvidence {
  globalMedian: number;
  byCategory: Map<string, number[]>;
  byGroup: Map<string, number[]>;
  stats: CategoryStat[];
}

/** Collect every priced peer's market-cap/TVL ratio, by category and by economic group. */
export function peerEvidence(snapshot: Snapshot): PeerEvidence {
  const byCategory = new Map<string, number[]>();
  const byGroup = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (!isPeer(p)) continue;
    const ratio = p.mcap_usd! / p.tvl_usd;
    all.push(ratio);
    const category = p.category ?? 'Uncategorised';
    const list = byCategory.get(category) ?? [];
    list.push(ratio);
    byCategory.set(category, list);
    const group = PEER_GROUPS[category];
    if (group !== undefined) {
      const glist = byGroup.get(group) ?? [];
      glist.push(ratio);
      byGroup.set(group, glist);
    }
  }
  const globalMedian = all.length > 0 ? median(all) : 0.2;
  const categories = new Set<string>();
  for (const p of snapshot.protocols) categories.add(p.category ?? 'Uncategorised');
  const stats: CategoryStat[] = [...categories].sort().map((category) => {
    const ratios = byCategory.get(category) ?? [];
    return {
      category,
      group: PEER_GROUPS[category] ?? null,
      peers: ratios.length,
      median_multiple: ratios.length > 0 ? round4(median(ratios)) : null,
    };
  });
  return { globalMedian, byCategory, byGroup, stats };
}

/** Shrink a sample median toward the global median: weight n/(n+K), so small samples speak softly. */
function shrunk(sampleMedian: number, n: number, globalMedian: number, model: ModelConstants): number {
  const w = n / (n + model.shrink_k);
  return w * sampleMedian + (1 - w) * globalMedian;
}

function clampMultiple(value: number, model: ModelConstants): number {
  return Math.min(model.multiple_max, Math.max(model.multiple_min, value));
}

/** The multiple one category prices at, and where the evidence for it came from. */
export function categoryMultiple(
  category: string | null,
  evidence: PeerEvidence,
  model: ModelConstants = MODEL,
): { multiple: number; source: 'category' | 'group' | 'global'; peers: number } {
  const name = category ?? 'Uncategorised';
  const own = evidence.byCategory.get(name) ?? [];
  if (own.length >= model.min_category_peers) {
    return { multiple: round4(clampMultiple(shrunk(median(own), own.length, evidence.globalMedian, model), model)), source: 'category', peers: own.length };
  }
  const group = PEER_GROUPS[name];
  if (group !== undefined) {
    const grouped = evidence.byGroup.get(group) ?? [];
    if (grouped.length >= model.min_category_peers) {
      return { multiple: round4(clampMultiple(shrunk(median(grouped), grouped.length, evidence.globalMedian, model), model)), source: 'group', peers: grouped.length };
    }
  }
  return { multiple: round4(clampMultiple(evidence.globalMedian, model)), source: 'global', peers: 0 };
}

/** The factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  evidence: PeerEvidence,
  model: ModelConstants = MODEL,
): {
  implied: number;
  multiple: number;
  source: 'category' | 'group' | 'global';
  peers: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const { multiple, source, peers } = categoryMultiple(protocol.category, evidence, model);
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const breadthMult = 1 + extraChains * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return { implied, multiple, source, peers, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are products of another protocol, per the watchlist's own definition. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Name words that mark a wrapped or staked product of another protocol. */
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;

/** Names that begin with an exchange's name are that exchange's product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token and not a product of another protocol —
 * the watchlist's own screen, applied at every TVL, so the board is the watchlist's definition
 * carried below its floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (PRODUCT_NAME.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the rankable screen would pass over, because
  // the gate's coverage row is never gambled on a definition's edge.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol the snapshot carries, at any TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const evidence = peerEvidence(snapshot);
  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, snapshot.as_of, evidence, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      category_multiple: s.v.multiple,
      multiple_source: s.v.source,
      peer_count: s.v.peers,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core position, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a vault curated by ${name} on ${chain} and keep the vault shares in the wallet.`;
  if (c.includes('lend') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and leave the supplied balance untouched.`;
  if (c.includes('cdp')) return `Supply $${capital} of collateral to ${name} on ${chain} and mint a small amount of its stablecoin against it.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity, split between USDC and the pool's other asset, to ${name}'s main pool on ${chain}.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('basis')) return `Open the $${capital} basis position ${name} offers on ${chain}: the long and the short leg together, never one leg alone.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the wallet.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position in a liquid market on ${name}.`;
  if (c.includes('launchpad')) return `Register the wallet on ${name} and take part in one sale or one staking round with up to $${capital}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy until it expires.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and make it the wallet's home chain for a month.`;
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and switch on auto-compounding if it is offered.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second interaction: the action that makes the wallet a user, not a deposit. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator')) return `Move a small part of the deposit into a second ${name} vault on ${chain}, so the wallet holds two curated strategies, not one.`;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp')) return `Borrow a small amount against the position on ${name} and repay it a week later, so the wallet shows a full lend-and-borrow cycle.`;
  if (c.includes('dex')) return `Make two or three swaps through ${name}'s own interface on ${chain}, on different days, so the wallet trades as well as provides.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) return `Close the hedge and open a second, smaller one a week later, so the wallet shows repeated trading, not a single touch.`;
  if (c.includes('rwa') || c.includes('basis') || c.includes('stable')) return `Redeem a small slice of the position on ${name} and deposit it back the next day, so the wallet completes a full round trip.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim the staking rewards on ${name} once and restake them, so the wallet compounds instead of idling.`;
  return `Repeat the core action on ${name} once more with a small amount, on a different day, so the wallet shows a pattern of use.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm ${p.name} with, fund it on ${chain}, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the funding transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain),
      cost: 'about $3 of gas',
      time: '10 minutes',
    },
    {
      text: `Repeat one qualifying action on ${p.name} each week — a deposit, a swap, a claim or a vote — so the wallet reads as a regular user.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot window.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check ${p.name}'s own announcements and points or rewards page before you withdraw, and claim only from the link the protocol itself publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log; if a token launches, claim with the same wallet and decide your hold-or-sell split before the claim opens.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    multiple_source: row.model.multiple_source,
    peer_count: row.model.peer_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const evidence = peerEvidence(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_median_multiple: round4(evidence.globalMedian),
    category_stats: evidence.stats,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
