// -----------------------------------------------------------------------------
// The registry of the channels the user follows, declared with the
// configuration buttons ("Add a channel", "Remove a channel"): an @handle, a
// URL or a channel id, resolved once into the stable channel id (UC…).
//
// Stored through setConfig() under INTERNAL_KEYS.registry, a key outside the
// config_schema: the configuration lives in the Gladys database, so the
// channels follow the Gladys backups (/data does not). A change is applied in
// memory only once Gladys saved it, and changes run one after the other: two
// quick buttons never lose a channel.
//
// The channel id builds the external ids of its device: never its title nor
// its handle, which the owner can change.
// -----------------------------------------------------------------------------

import { INTERNAL_KEYS } from './config.js';
import { CHANNEL_ID, MAX_IDS } from './youtube-api.js';

// One channels.list request reads the statistics of 50 channels.
const MAX_CHANNELS = MAX_IDS;

class RegistryError extends Error {
  /**
   * @param {string} key - The TEXTS key of the message.
   * @param {object} [params] - Its substitutions.
   */
  constructor(key, params = {}) {
    super(key);
    this.key = key;
    this.params = params;
  }
}

/**
 * @description Check a stored or new channel and return its normalized form.
 * @param {object} raw - The candidate.
 * @returns {object} `{ id, title, handle, uploads }`.
 * @throws {RegistryError} When it is not a channel.
 */
function validateChannel(raw) {
  if (!raw || !CHANNEL_ID.test(raw.id)) {
    throw new RegistryError('errorInput');
  }
  const uploads = /^UU[\w-]{22}$/.test(raw.uploads ?? '') ? raw.uploads : `UU${raw.id.slice(2)}`;
  return {
    id: raw.id,
    title: String(raw.title ?? raw.id).slice(0, 100) || raw.id,
    handle: typeof raw.handle === 'string' ? raw.handle.slice(0, 40) : '',
    uploads,
  };
}

/**
 * @description Read the stored registry, dropping what is not a valid channel.
 * @param {*} stored - The stored value (an array, or its JSON).
 * @param {object} [logger] - Logger.
 * @returns {object[]} The channels.
 */
function parseRegistry(stored, logger) {
  let list = stored;
  if (typeof stored === 'string') {
    try {
      list = JSON.parse(stored);
    } catch {
      logger?.warn('YouTube: the stored channels are not valid JSON, ignored');
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const channels = [];
  for (const raw of list) {
    try {
      const channel = validateChannel(raw);
      if (seen.has(channel.id)) continue;
      seen.add(channel.id);
      channels.push(channel);
    } catch {
      logger?.warn(`YouTube: stored channel ignored (${String(raw?.id ?? '?').slice(0, 40)})`);
    }
  }
  return channels.slice(0, MAX_CHANNELS);
}

/**
 * @description The registry of the channels.
 * @param {object} gladys - SDK client (setConfig).
 * @param {object} [options] - Options.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The registry.
 */
function createRegistry(gladys, { logger } = {}) {
  let channels = [];
  let writing = Promise.resolve();

  // One change at a time, computed from the previous one once it is saved.
  const serial = (change) => {
    const run = writing.then(async () => {
      const { next, result } = change(channels);
      if (next !== channels) {
        await gladys.setConfig({ [INTERNAL_KEYS.registry]: next });
        channels = next;
      }
      return result;
    });
    writing = run.catch(() => {});
    return run;
  };

  const registry = {
    /** @param {object} config - `gladys.config`. @returns {object[]} The channels. */
    load(config) {
      channels = parseRegistry(config?.[INTERNAL_KEYS.registry], logger);
      return channels;
    },

    list: () => channels,

    /** @param {string} id - Channel id. @returns {object|undefined} The channel. */
    byId: (id) => channels.find((channel) => channel.id === id),

    /** @param {object} channel - A channel. @returns {number} Its number in the list (1…). */
    numberOf: (channel) => channels.findIndex((other) => other.id === channel.id) + 1,

    /**
     * @description Find a channel by its number (#2 or 2), its title or
     * handle (any case, "@" optional) or its id.
     * @param {string} query - What the user typed.
     * @returns {object} The channel.
     * @throws {RegistryError} When none or several match.
     */
    find(query) {
      const value = String(query ?? '').trim();
      if (!value) throw new RegistryError('errorTarget');
      const number = /^#?(\d{1,3})$/.exec(value);
      if (number) {
        const channel = channels[Number(number[1]) - 1];
        if (channel) return channel;
      }
      const byId = channels.find((channel) => channel.id === value);
      if (byId) return byId;
      const lower = value.toLocaleLowerCase().replace(/^@/, '');
      const matches = channels.filter(
        (channel) =>
          channel.title.toLocaleLowerCase() === lower ||
          channel.handle.toLocaleLowerCase().replace(/^@/, '') === lower,
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        throw new RegistryError('errorAmbiguous', {
          query: value,
          numbers: matches.map((channel) => `#${channels.indexOf(channel) + 1}`).join(', '),
        });
      }
      throw new RegistryError('errorNotFound', { query: value });
    },

    /**
     * @description Add a resolved channel (an already followed one is
     * refreshed: same id, same device).
     * @param {object} resolved - The channel read from YouTube.
     * @returns {Promise<{ channel: object, existed: boolean }>} The channel.
     */
    add(resolved) {
      return serial((current) => {
        const channel = validateChannel(resolved);
        const existed = current.some((other) => other.id === channel.id);
        if (!existed && current.length >= MAX_CHANNELS) {
          throw new RegistryError('errorFull', { max: MAX_CHANNELS });
        }
        const next = existed
          ? current.map((other) => (other.id === channel.id ? channel : other))
          : [...current, channel];
        return { next, result: { channel, existed } };
      });
    },

    /**
     * @description Refresh the title, handle and uploads playlist of the
     * channels from a statistics reading (only when one changed).
     * @param {object[]} read - Channels read from YouTube.
     * @returns {Promise<boolean>} Whether something changed.
     */
    update(read) {
      return serial((current) => {
        let changed = false;
        const next = current.map((channel) => {
          const fresh = read.find((other) => other.id === channel.id);
          if (!fresh) return channel;
          const updated = validateChannel({ ...channel, ...fresh });
          if (
            updated.title === channel.title &&
            updated.handle === channel.handle &&
            updated.uploads === channel.uploads
          ) {
            return channel;
          }
          changed = true;
          return updated;
        });
        return { next: changed ? next : current, result: changed };
      });
    },

    /**
     * @description Stop following a channel.
     * @param {string} query - Its number, title, handle or id.
     * @returns {Promise<object>} The removed channel.
     */
    remove(query) {
      return serial((current) => {
        const channel = registry.find(query);
        return { next: current.filter((other) => other.id !== channel.id), result: channel };
      });
    },
  };
  return registry;
}

export { MAX_CHANNELS, RegistryError, validateChannel, parseRegistry, createRegistry };
