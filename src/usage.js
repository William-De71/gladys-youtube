// -----------------------------------------------------------------------------
// Daily counter of the YouTube Data API units.
//
// Google gives a Cloud project 10,000 units a day by default and resets the
// count at midnight Pacific Time; every call this integration makes costs 1
// unit (channels.list, playlistItems.list, videos.list — never search.list),
// an error included. This counter is the integration's own safety net: once
// `daily_budget` units are spent in a Pacific day, no more request goes out
// until the next one (the RSS feeds, free, still detect the new videos).
//
// It lives in /data/usage.json so that a restart does not reset it. It is an
// estimate: other uses of the same Cloud project count at Google too (Cloud
// console → APIs & Services → YouTube Data API v3 → Quotas is the reference).
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { localDay } from './time.js';

const QUOTA_TIMEZONE = 'America/Los_Angeles';

/**
 * @description The Pacific day of an instant (the quota day of Google).
 * @param {number} instant - The instant in ms.
 * @returns {string} "YYYY-MM-DD".
 * @example
 * quotaDay(Date.parse('2026-10-20T06:00:00Z')); // -> '2026-10-19'
 */
function quotaDay(instant) {
  return localDay(new Date(instant), QUOTA_TIMEZONE);
}

/**
 * @description The next reset of the quota (midnight Pacific Time), in ms.
 * @param {number} instant - Now, in ms.
 * @returns {number} The instant of the reset.
 */
function nextReset(instant) {
  const today = quotaDay(instant);
  // Step by 10 minutes: the first instant of another Pacific day, at most
  // 10 minutes late (DST included).
  let at = instant;
  while (quotaDay(at) === today) at += 10 * 60 * 1000;
  return at - (at % (10 * 60 * 1000));
}

/**
 * @description Create the usage counter.
 * @param {object} options - Options.
 * @param {string|null} options.path - The JSON file (null: memory only).
 * @param {Function} options.getBudget - `() => number`, units a day, read on every check.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The counter.
 */
function createUsage({ path, getBudget, now = () => Date.now(), logger = console }) {
  let state = { day: quotaDay(now()), units: 0 };
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof stored?.day === 'string' && Number.isInteger(stored.units) && stored.units >= 0) {
        state = { day: stored.day, units: stored.units };
      }
    } catch {
      // No file yet (first start) or unreadable: start from zero.
    }
  }

  const rollOver = () => {
    const day = quotaDay(now());
    if (day !== state.day) state = { day, units: 0 };
  };

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state));
    } catch (err) {
      logger.warn(`Unable to store the API usage counter: ${err.message}`);
    }
  };

  const usage = {
    /** @returns {number} Units spent today (Pacific day). */
    used() {
      rollOver();
      return state.units;
    },
    /** @returns {number} The daily budget. */
    budget: () => getBudget(),
    /** @returns {number} Units left today. */
    remaining: () => Math.max(0, usage.budget() - usage.used()),
    /** @returns {boolean} Whether the budget of the day is spent. */
    exhausted: () => usage.used() >= usage.budget(),
    /** @returns {string} The quota day, "YYYY-MM-DD". */
    day() {
      rollOver();
      return state.day;
    },
    /** @returns {number} The next reset, in ms. */
    resetAt: () => nextReset(now()),
    /** @param {number} units - Count units spent. */
    record(units) {
      rollOver();
      state.units += units;
      save();
    },
  };
  return usage;
}

export { QUOTA_TIMEZONE, quotaDay, nextReset, createUsage };
