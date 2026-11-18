# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/uyekt23/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/uyekt23/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads one sealed snapshot of the protocol universe (every protocol
DefiLlama tracks at $5M+ TVL) and ranks every protocol that has not launched a token yet by
**implied launch value** — what its token would be worth if it launched at the valuation the
market already gives its priced peers — with a concrete farm plan for each row.

The valuation model (radar-2, in `lib/model.ts`) derives everything from the snapshot itself:

- **Category multiple** — the median market-cap/TVL of the protocols in the same category that
  already have a token, shrunk toward the global median by sample size; sparse categories fall
  back to an economic peer group (allocation, credit, trading, stable-assets), then to the
  global median.
- **Momentum** — 7-day TVL change, clamped and weighted.
- **Maturity** — how long DefiLlama has tracked the protocol.
- **Breadth** — how many chains it runs on.

The board carries the whole 40-protocol watchlist ($50M+ TVL, no token) plus every other
protocol that passes the same screen below the floor — the early rows a farmer can still be
early to. Protocols that already trade are shown apart in the dashboard, at the market's own
values: they are the evidence the multiples come from, never ranked rows.

## Run it

Node.js 22 or newer, standard library only:

```sh
node main.ts --input <dir-or-file> --output <dir>
```

`--input` names the snapshot (`snapshot.json` inside a directory, or the file itself; the
grader mounts it at `/input`). The program writes `board.json` (the ranked board),
`data.js` and a static, offline `dashboard/` with three screenshots, and `dossier.json`
built with the vendored `vendor/makefun-board.ts`. Two runs over the same snapshot write
identical bytes.

Open `dashboard/index.html` from the output folder to read the board: it is sortable and
filterable, every protocol has a detail view with the model's arithmetic and its farm plan,
and the Live and Multiples tabs show the peer evidence behind every price.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) in the token-radar-01 bounty.</sub>
