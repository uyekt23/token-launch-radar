// Token Launch Radar — entrypoint.
//
// What this program does, in one pass:
//   1. Loads a frozen snapshot of the DeFi protocol universe (JSON) from the input location.
//   2. Scores every protocol in it with the valuation model in lib/model.ts and arranges the
//      results into a ranked board of pre-token protocols with an implied launch value each.
//   3. Emits the deliverables into the output directory: board.json (the ranked board),
//      data.js (the same radar in script form for the dashboard), a copy of this repo's static
//      dashboard/ and screenshots/ folders, and finally dossier.json, the self-describing
//      summary the scorer rebuilds and compares byte for byte — which is why it is written last,
//      once everything it describes is already on disk.
//
// The grader runs this file with the snapshot mounted at /input and expects results in /output.
// To try it anywhere else, point MAKEFUN_OUTPUT_DIR at a scratch folder (or pass --output) and
// pass --input with either a snapshot.json file or the directory that contains one:
//
//   MAKEFUN_OUTPUT_DIR=./out node main.ts --input ./snapshot-dev.json
//
// Node 22+, standard library only.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// Size limits the dossier builder enforces, mirroring the scorer's own caps: how much dashboard
// text it will digest, how many screenshots it will carry and how large each may be, and how
// many files / bytes the dashboard folder may occupy in total.
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };

// Screenshot filenames must be plain portable names: a letter, digit or underscore first, then
// up to 127 more characters drawn from letters, digits, dot, underscore and dash.
const SCREENSHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

// This file's own directory, so the dashboard and screenshots that ship with the repo are found
// relative to the entrypoint rather than to wherever the process happens to be started.
const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** Reads one command-line option given as `--name value` or `--name=value`, else the fallback. */
function option(name: string, fallback: string): string {
  const flag = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === flag) {
      const next = argv[i + 1];
      if (next !== undefined) return next;
    } else if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return fallback;
}

/** Fails the run: message on stderr, process exits with the given code. */
function fail(code: number, message: string): never {
  process.stderr.write(`token-radar: ${message}\n`);
  process.exit(code);
}

/**
 * Copies every regular file directly inside `from` into `to`, skipping dotfiles, and returns the
 * names copied. A source directory that does not exist counts as empty rather than an error.
 */
function copyFolder(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    copied.push(name);
  }
  return copied;
}

function main(): void {
  // Resolve the snapshot file: --input may name the JSON file itself or its parent directory.
  const inputArg = option('input', '/input');
  const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(snapshotPath)) {
    fail(2, `no snapshot at ${snapshotPath} — pass --input <snapshot.json|directory> or mount the sealed input`);
  }
  const outputDir = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  // Score the snapshot. A board the gate would refuse is a build error, not an output.
  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    fail(1, `the model produced a board the gate refuses: ${issue}`);
  }

  // The board and the dashboard's data script.
  mkdirSync(outputDir, { recursive: true });
  const boardPath = join(outputDir, 'board.json');
  writeFileSync(boardPath, `${JSON.stringify({ rows: board })}\n`);
  const dataPath = join(outputDir, 'data.js');
  writeFileSync(dataPath, dataScript(radar));

  // The static dashboard and the screenshots that evidence it.
  const dashboardDir = join(outputDir, 'dashboard');
  copyFolder(join(repoDir, 'dashboard'), dashboardDir);
  const screenshotsDir = join(outputDir, 'screenshots');
  const shots = copyFolder(join(repoDir, 'screenshots'), screenshotsDir);
  if (shots.length < 3) {
    fail(1, `screenshots/ contributed ${shots.length} image(s); the entry needs at least 3 — the board, a protocol detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!SCREENSHOT_NAME.test(name)) {
      fail(1, `screenshots/${name} is not a plain file name (letters, digits and . _ -, 1–128 characters)`);
    }
  }

  // Written last on purpose: the dossier summarises the finished output folder, and the scorer
  // regenerates it from that folder and compares the bytes.
  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(
    dossierPath,
    buildDossier(outputDir, {
      text_max_bytes: TEXT_MAX_BYTES,
      screenshots: SCREENSHOT_CAPS,
      dashboard: DASHBOARD_CAPS,
    }),
  );

  process.stdout.write(
    `token-radar: ${snapshot.protocols.length} protocols in the snapshot, ${snapshot.watchlist.length} on the watchlist; ` +
      `board holds ${board.length} rows (${radar.early_size} early, ${radar.live_size} live-token set aside)\n`,
  );
  process.stdout.write(`token-radar: wrote ${boardPath}, ${dataPath}, ${dashboardDir}/, ${screenshotsDir}/ (${shots.length} images), ${dossierPath}\n`);
}

main();
