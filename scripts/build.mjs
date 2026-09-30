#!/usr/bin/env node
/**
 * `next build`, with one clean retry.
 *
 * Turbopack keeps a persistent cache under `.next/cache`, and a build that
 * fails can leave it in a state that fails the *next* build too — for the
 * original reason, even after that reason is fixed. That is survivable
 * locally, where `rm -rf .next` is one command. It is not survivable on a
 * host that persists `.next/cache` between deploys, as Railway does through
 * a BuildKit cache mount: once one build failed there, every later build
 * inherited the poisoned cache and reported the same error, so a correct
 * commit could not deploy at all.
 *
 * Demonstrated rather than assumed. With the dependency fault repaired and
 * only `.next/cache` carried over from the failed build:
 *
 *   rm -rf node_modules; npm ci; next build
 *     → Error: Cannot find module '@tailwindcss/postcss'
 *
 * So: build; if it fails, throw the cache away and build once more. A build
 * that is genuinely broken fails the second time too and the exit code
 * propagates, so this hides nothing — it only removes the cache's ability to
 * make a failure permanent.
 */

import { spawnSync } from "node:child_process";
import { rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT = ["next", "build"];

function build() {
  const result = spawnSync("npx", NEXT, { stdio: "inherit", shell: false });
  return result.status ?? 1;
}

/**
 * Empties `.next` without unlinking it or `.next/cache`. Both can be mount
 * points on a build host, where removing the directory itself fails with
 * EBUSY — so the contents go, and the directories stay.
 */
function clearBuildCache() {
  for (const dir of [".next/cache", ".next"]) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (dir === ".next" && entry === "cache") continue; // handled above
      rmSync(join(dir, entry), { recursive: true, force: true });
    }
  }
}

let status = build();

if (status !== 0) {
  console.warn(
    "\n[build] failed — clearing .next and retrying once, in case the " +
      "incremental cache is the reason rather than the code.\n"
  );
  clearBuildCache();
  status = build();
  if (status === 0) {
    console.warn("[build] succeeded on a clean cache; the first failure was stale state.\n");
  }
}

process.exit(status);
