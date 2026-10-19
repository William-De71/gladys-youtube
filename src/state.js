// -----------------------------------------------------------------------------
// What survives a restart, in /data/state.json, per channel:
//   - `stats`      the last statistics (subscribers, views, videos) and when;
//   - `videos`     the latest uploads (15 at most, newest first) with their
//                  details (duration, Short, live state);
//   - `seen`       the ids already known, so that a restart never announces
//                  an old video again (60 at most);
//   - `feedAt`     the last look at the uploads (RSS or playlist), its error;
//   - `milestone`  the highest subscriber milestone already reached;
//   - `primed`     whether the uploads were read once: the videos found at
//                  the first reading are the past, never "new";
// and for the whole integration: the pause after a refused quota and the
// scene events already fired (quota exhausted once a day, key refused once
// until it works). Never the key.
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/state.json';
const MAX_VIDEOS = 15;
const MAX_SEEN = 60;

const empty = () => ({
  stats: null,
  videos: [],
  seen: [],
  feedAt: 0,
  feedError: null,
  statsAt: 0,
  milestone: null,
  primed: false,
});

/**
 * @description Create the state store.
 * @param {object} options - Options.
 * @param {string|null} options.path - The JSON file (null: memory only).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The store.
 */
function createState({ path, logger = console }) {
  let state = { channels: {}, pausedUntil: 0, flags: {} };
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (stored && typeof stored.channels === 'object' && stored.channels !== null) {
        state = {
          channels: Object.fromEntries(
            Object.entries(stored.channels).map(([id, value]) => [id, { ...empty(), ...value }]),
          ),
          pausedUntil: Number.isFinite(stored.pausedUntil) ? stored.pausedUntil : 0,
          flags: stored.flags && typeof stored.flags === 'object' ? stored.flags : {},
        };
      }
    } catch {
      // No file yet (first start) or unreadable: start empty.
    }
  }

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state));
    } catch (err) {
      logger.warn(`Unable to store the state: ${err.message}`);
    }
  };

  const of = (id) => {
    if (!state.channels[id]) state.channels[id] = empty();
    return state.channels[id];
  };

  return {
    /** @param {string} id - Channel. @returns {object|null} Its state. */
    get: (id) => state.channels[id] ?? null,

    /**
     * @description Change the state of a channel, then store it.
     * @param {string} id - Channel.
     * @param {Function} change - `(channelState) => void`, mutates.
     */
    update(id, change) {
      const current = of(id);
      change(current);
      current.videos = current.videos.slice(0, MAX_VIDEOS);
      current.seen = current.seen.slice(-MAX_SEEN);
      save();
    },

    /** @param {string[]} ids - The channels still followed: forget the others. */
    keep(ids) {
      const wanted = new Set(ids);
      let changed = false;
      Object.keys(state.channels).forEach((id) => {
        if (!wanted.has(id)) {
          delete state.channels[id];
          changed = true;
        }
      });
      if (changed) save();
    },

    /** @returns {number} End of the pause after a refused quota, in ms (0: none). */
    pausedUntil: () => state.pausedUntil,

    /** @param {number} until - End of the pause, in ms. */
    pause(until) {
      state.pausedUntil = until;
      save();
    },

    /** @param {string} key - A flag. @returns {boolean} Whether it is set. */
    flag: (key) => state.flags[key] === true,

    /**
     * @description Set or clear a flag (only the set ones are kept).
     * @param {string} key - The flag.
     * @param {boolean} value - Its value.
     */
    setFlag(key, value) {
      if ((state.flags[key] === true) === value) return;
      if (value) state.flags[key] = true;
      else delete state.flags[key];
      save();
    },

    /** @param {string} prefix - Forget the flags starting with it (but `keep`). @param {string} [keep] - A flag to keep. */
    clearFlags(prefix, keep) {
      let changed = false;
      Object.keys(state.flags).forEach((key) => {
        if (key.startsWith(prefix) && key !== keep) {
          delete state.flags[key];
          changed = true;
        }
      });
      if (changed) save();
    },
  };
}

export { DEFAULT_PATH, MAX_VIDEOS, MAX_SEEN, createState };
