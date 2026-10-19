// -----------------------------------------------------------------------------
// The YouTube integration: every handler, registered on a Gladys client.
//
//   - the followed channels are declared with the configuration buttons
//     (channels.js), stored in the Gladys configuration;
//   - one device per channel (device.js): subscribers, views, videos, latest
//     video and its date;
//   - the integration's own clock (a tick every 30 s):
//       * the RSS feed of each channel every `feed_minutes` (free), with
//         playlistItems.list as the fallback of a failing feed (1 unit);
//       * the details of the new videos (duration, live state) in one
//         videos.list request for all the channels (1 unit per 50 videos);
//       * the scheduled and running lives, every 5 minutes around their
//         start (1 unit per 50 videos);
//       * the statistics of every channel every `stats_minutes` (1 unit per
//         50 channels);
//     all of it within the daily budget of units (usage.js);
//   - scene triggers (events.js): new video, live started, subscriber
//     milestone, refused key, quota exhausted;
//   - scene actions: the latest video of a channel, its statistics;
//   - dashboard widgets (widgets.js): latest videos, one channel, quota;
//     thumbnails through onWidgetGetImage (images.js).
//
// Transport: cloud (YouTube Data API v3 with the user's own key, the public
// RSS feeds and thumbnails of YouTube).
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake fetch (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createRegistry, RegistryError } from './channels.js';
import { createState, DEFAULT_PATH } from './state.js';
import { createUsage } from './usage.js';
import {
  createYouTube,
  parseChannelInput,
  ApiKeyError,
  QuotaError,
  BudgetExceededError,
  NotFoundError,
  MAX_IDS,
} from './youtube-api.js';
import { resolveTimezone } from './time.js';
import { buildDevice, buildStates, idFromExternalId, latestOf } from './device.js';
import {
  TRIGGERS,
  SCENE_ACTIONS,
  QUOTA_SOURCES,
  NEW_VIDEO_MAX_AGE_MS,
  milestoneOf,
  newVideoData,
  liveStartedData,
  milestoneData,
  keyRefusedData,
  quotaData,
  latestVideoOutputs,
  statsOutputs,
} from './events.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  buildLatestVideosWidget,
  buildChannelWidget,
  buildQuotaWidget,
} from './widgets.js';
import { videoIdOfKey, MAX_IMAGE_BYTES } from './images.js';
import { t, all, ago, isLanguage, formatNumber } from './i18n.js';

const ACTIONS = {
  ADD: 'add_channel',
  REMOVE: 'remove_channel',
  LIST: 'list_channels',
  TEST_KEY: 'test_api_key',
};
const USAGE_PATH = '/data/usage.json';
// The clock is read this often.
const TICK_MS = 30 * 1000;
// Feeds of one round are spaced (YouTube serves them from a cache anyway).
const REQUEST_SPACING_MS = 1000;
// A channel checked less than this ago is not checked again by a button or
// an action.
const MIN_MANUAL_GAP_MS = 60 * 1000;
// A refused key is tried again this often (the user may fix the Cloud project
// without touching the key).
const KEY_RETRY_MS = 60 * 60 * 1000;
// requestWidgetRefresh: at most once every 10 s per widget.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;
// Lives: checked every 5 minutes from 30 minutes before their scheduled
// start and while they run; every 6 hours when far ahead (a new date);
// given up 48 hours after a start that never came.
const LIVE_SOON_MS = 30 * 60 * 1000;
const LIVE_CHECK_MS = 5 * 60 * 1000;
const LIVE_RUNNING_CHECK_MS = 10 * 60 * 1000;
const LIVE_FAR_CHECK_MS = 6 * 60 * 60 * 1000;
const LIVE_GIVE_UP_MS = 48 * 60 * 60 * 1000;
// The playlist fallback of a failing feed costs a unit per channel: only
// while less than this share of the budget is spent (the statistics first).
const FALLBACK_SHARE = 0.8;
// A failed statistics reading is tried again this long after.
const STATS_RETRY_MS = 5 * 60 * 1000;
// The channel the "Test the API key" button reads (1 unit).
const TEST_HANDLE = 'YouTube';

const RESTRICTED_REASONS = [
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
  'ipRefererBlocked',
];

/**
 * @description The TEXTS key of what to do about a refused key.
 * @param {string|null} reason - The Google reason.
 * @returns {string} The key.
 */
function hintKey(reason) {
  if (RESTRICTED_REASONS.includes(reason)) return 'hint_restricted';
  if (['API_KEY_INVALID', 'API_KEY_EXPIRED', 'keyInvalid', 'keyExpired'].includes(reason)) {
    return 'hint_API_KEY_INVALID';
  }
  if (['SERVICE_DISABLED', 'accessNotConfigured'].includes(reason)) return 'hint_SERVICE_DISABLED';
  if (['API_KEY_MISSING', 'API_KEY_SERVICE_BLOCKED'].includes(reason)) return `hint_${reason}`;
  return 'hint_default';
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.now] - `() => Date` (tests).
 * @param {string} [options.timezone] - IANA timezone (default: TZ).
 * @param {Function} [options.fetchImpl] - `fetch` (tests).
 * @param {string|null} [options.statePath] - File of the state.
 * @param {string|null} [options.usagePath] - File of the usage counter.
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {number} [options.tickMs] - Clock period, 0 for none (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ tick: Function, registry: object, usage: object, state: object, stop: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    now = () => new Date(),
    timezone = resolveTimezone(),
    fetchImpl = fetch,
    statePath = DEFAULT_PATH,
    usagePath = USAGE_PATH,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    tickMs = TICK_MS,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the language of the texts Gladys
  // does not ask for in a language, when the `language` setting is `auto`.
  let language = guessLanguage(timezone);
  let timer = null;
  let running = Promise.resolve();
  let lastStatus = null;
  // missing, unknown (no request yet), ok, refused.
  let keyState = 'missing';
  let keyReason = null;
  let keyRefusedAt = 0;
  // Last statistics reading (or attempt), for the retry gap.
  let statsAt = 0;
  const widgetRefreshedAt = new Map();

  const registry = createRegistry(gladys, { logger });
  const state = createState({ path: statePath, logger });
  const usage = createUsage({
    path: usagePath,
    getBudget: () => config.dailyBudget,
    now: () => now().getTime(),
    logger,
  });
  const youtube = createYouTube({ getApiKey: () => config.apiKey, usage, fetchImpl, logger });

  const ms = () => now().getTime();
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);
  const createdIds = () =>
    new Set((gladys.devices ?? []).map((device) => idFromExternalId(device.external_id)));

  /** @returns {boolean} Whether a Data API request may go out now. */
  const apiUsable = () =>
    Boolean(config.apiKey) &&
    ms() >= state.pausedUntil() &&
    !usage.exhausted() &&
    !(keyState === 'refused' && ms() - keyRefusedAt < KEY_RETRY_MS);

  /** @returns {number} Units a day the channels plan (statistics and details). */
  function plannedPerDay() {
    const count = registry.list().length;
    if (count === 0) return 0;
    const statsCalls = Math.ceil(count / MAX_IDS) * Math.ceil(1440 / config.statsMinutes);
    // About one videos.list a day per channel for its new uploads.
    return statsCalls + count;
  }

  /**
   * @description Remember the language of a widget request, and store it
   * when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!isLanguage(next) || next === language) return;
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
    if (config.language === AUTO_LANGUAGE) {
      publishDiscovery();
      publishStates(registry.list());
    }
  }

  /** @description Offer every channel on the Discovery screen. */
  async function publishDiscovery() {
    if (!gladys.connected) return;
    try {
      await gladys.publishDiscoveredDevices(
        registry.list().map((channel) => buildDevice(gladys, channel, textLanguage())),
      );
    } catch (err) {
      logger.error('Unable to publish the discovered channels', err);
    }
  }

  /**
   * @description Publish the states of channels whose device exists (only
   * the changed values).
   * @param {object[]} channels - The channels.
   */
  async function publishStates(channels) {
    if (!gladys.connected) return;
    const created = createdIds();
    const states = channels.flatMap((channel) =>
      created.has(channel.id)
        ? buildStates(gladys, channel, state.get(channel.id), {
            language: textLanguage(),
            timezone,
          })
        : [],
    );
    if (states.length === 0) return;
    try {
      await gladys.publishChangedStates(states);
    } catch (err) {
      logger.error('Unable to publish the states', err);
    }
  }

  /** @description Ask Gladys to fetch the widgets again (10 s apart at least). */
  function refreshWidgets() {
    if (!gladys.connected) return;
    Object.values(WIDGETS).forEach((key) => {
      const last = widgetRefreshedAt.get(key) ?? -Infinity;
      if (ms() - last < WIDGET_REFRESH_GAP_MS) return;
      widgetRefreshedAt.set(key, ms());
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.warn(`Unable to refresh the widget ${key}: ${err.message}`);
      }
    });
  }

  /** @description Show the channels and the units of the day in the Configuration screen. */
  async function reportStatus() {
    let connected = true;
    let message;
    if (!config.apiKey) {
      connected = false;
      message = all('statusNoKey');
    } else if (keyState === 'refused') {
      connected = false;
      message = all((lang) =>
        t('statusKeyError', lang, { reason: keyReason, hint: t(hintKey(keyReason), lang) }),
      );
    } else if (registry.list().length === 0) {
      message = all('statusEmpty');
    } else {
      message = all((lang) =>
        t('statusOk', lang, {
          count: registry.list().length,
          used: formatNumber(usage.used(), lang),
          budget: formatNumber(usage.budget(), lang),
        }),
      );
    }
    const signature = JSON.stringify([connected, message]);
    if (!gladys.connected || signature === lastStatus) return;
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the status', err);
    }
  }

  /**
   * @description Fire a scene event; a refusal is logged, never thrown.
   * @param {string} key - The trigger.
   * @param {object} data - Its data.
   * @returns {Promise<boolean>} Whether Gladys accepted it.
   */
  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      return true;
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
      return false;
    }
  }

  /**
   * @description The message of a failed request, in a language.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function errorMessage(err, lang) {
    if (err instanceof BudgetExceededError) {
      return t('errorBudget', lang, { budget: formatNumber(usage.budget(), lang) });
    }
    if (err instanceof ApiKeyError) {
      return t('statusKeyError', lang, { reason: err.reason, hint: t(hintKey(err.reason), lang) });
    }
    if (err instanceof QuotaError) return t('errorQuota', lang);
    return t('errorUnreachable', lang, { message: err.message });
  }

  /**
   * @description Run a Data API call, turning a refused key or quota into
   * the state of the whole integration.
   * @param {Function} call - `() => Promise`.
   * @returns {Promise<*>} Its result.
   * @throws {Error} The error of the call.
   */
  async function api(call) {
    try {
      const result = await call();
      if (keyState !== 'ok') {
        keyState = 'ok';
        keyReason = null;
        state.setFlag('key_refused', false);
      }
      return result;
    } catch (err) {
      if (err instanceof ApiKeyError) {
        keyState = config.apiKey ? 'refused' : 'missing';
        keyReason = err.reason;
        keyRefusedAt = ms();
      } else if (err instanceof QuotaError) {
        // Google's own count says no: nothing more until its reset.
        state.pause(usage.resetAt());
        state.setFlag(`quota_google:${usage.day()}`, true);
      }
      throw err;
    } finally {
      await reportStatus();
    }
  }

  /** @description Fire the refused-key event once per refusal. */
  async function checkKey() {
    if (keyState !== 'refused' || state.flag('key_refused')) return;
    const data = keyRefusedData(keyReason, t(hintKey(keyReason), textLanguage()), textLanguage());
    if (await fire(TRIGGERS.API_KEY_REFUSED, data)) state.setFlag('key_refused', true);
  }

  /** @description Fire the quota event once per quota day. */
  async function checkQuota() {
    const day = usage.day();
    const flag = `quota:${day}`;
    if (state.flag(flag)) return;
    let source = null;
    if (state.flag(`quota_google:${day}`)) source = QUOTA_SOURCES.GOOGLE;
    else if (usage.exhausted()) source = QUOTA_SOURCES.BUDGET;
    if (!source) return;
    const data = quotaData(source, usage.used(), usage.budget(), textLanguage());
    if (await fire(TRIGGERS.QUOTA_EXHAUSTED, data)) {
      // Forget the flags of the previous days, keep this one.
      state.clearFlags('quota', `quota_google:${day}`);
      state.setFlag(flag, true);
    }
  }

  /**
   * @description Read the latest uploads of a channel (RSS feed, or its
   * uploads playlist when the feed fails) and merge them into its state.
   * @param {object} channel - The channel.
   * @param {object} options - Options.
   * @param {boolean} options.scheduled - A reading of the clock: only it
   *   marks the new videos as seen (and announces them).
   * @returns {Promise<object[]>} The new videos (seen for the first time),
   *   empty for a manual reading or the first reading of the channel.
   */
  async function readUploads(channel, { scheduled }) {
    let entries;
    try {
      entries = await youtube.feed(channel.id);
    } catch (feedError) {
      if (!apiUsable() || usage.used() >= usage.budget() * FALLBACK_SHARE) {
        state.update(channel.id, (s) => {
          s.feedAt = ms();
          s.feedError = feedError.message.slice(0, 200);
        });
        logger.warn(`Channel ${channel.id}: ${feedError.message}`);
        return [];
      }
      try {
        entries = await api(() => youtube.uploads(channel.uploads));
      } catch (err) {
        state.update(channel.id, (s) => {
          s.feedAt = ms();
          s.feedError = err.message.slice(0, 200);
        });
        logger.warn(`Channel ${channel.id}: ${err.message}`);
        throw err;
      }
    }
    const current = state.get(channel.id);
    const primed = current?.primed ?? false;
    const seen = new Set(current?.seen ?? []);
    const known = new Map((current?.videos ?? []).map((video) => [video.id, video]));
    const fresh = [];
    const videos = [];
    for (const entry of entries.slice(0, 15)) {
      const previous = known.get(entry.id);
      let short = entry.short ?? previous?.short ?? null;
      if (short === null && !seen.has(entry.id)) short = await youtube.isShort(entry.id);
      const video = previous
        ? { ...previous, title: entry.title || previous.title, short: short ?? false }
        : {
            id: entry.id,
            title: entry.title,
            published: entry.published,
            short: short ?? false,
            duration: 0,
            live: 'none',
            detailed: false,
          };
      videos.push(video);
      if (primed && scheduled && !seen.has(entry.id)) fresh.push(video);
    }
    // A scheduled or running live leaves the feed only once replaced: keep
    // the tracked ones that fell out of it.
    for (const video of current?.videos ?? []) {
      if (video.live !== 'none' && !videos.some((other) => other.id === video.id)) {
        videos.push(video);
      }
    }
    videos.sort((a, b) => Date.parse(b.published ?? 0) - Date.parse(a.published ?? 0));
    state.update(channel.id, (s) => {
      s.videos = videos;
      s.feedAt = ms();
      s.feedError = null;
      if (scheduled || !s.primed) {
        s.seen = [...new Set([...s.seen, ...entries.map((entry) => entry.id)])];
        s.primed = true;
      }
    });
    return fresh;
  }

  /**
   * @description Read the details of videos (duration, live state) and
   * store them in their channels. Never throws.
   * @param {string[]} ids - The video ids.
   * @returns {Promise<Map<string, object>>} The details read, by id.
   */
  async function readDetails(ids) {
    const found = new Map();
    if (ids.length === 0 || !apiUsable()) return found;
    try {
      (await api(() => youtube.videos(ids))).forEach((video) => found.set(video.id, video));
    } catch (err) {
      logger.warn(`Video details: ${err.message}`);
      return found;
    }
    // A video asked for and not returned is private or deleted: never asked
    // again (and no longer a live).
    const asked = new Set(ids);
    for (const channel of registry.list()) {
      const current = state.get(channel.id);
      if (!current?.videos.some((video) => asked.has(video.id))) continue;
      state.update(channel.id, (s) => {
        s.videos = s.videos.map((video) => {
          if (!asked.has(video.id)) return video;
          const details = found.get(video.id);
          if (!details) return { ...video, live: 'none', detailed: true, checkedAt: ms() };
          return {
            ...video,
            title: details.title || video.title,
            published: details.published ?? video.published,
            duration: details.duration,
            live: details.live,
            scheduled: details.scheduled,
            started: details.started,
            detailed: true,
            checkedAt: ms(),
          };
        });
      });
    }
    return found;
  }

  /**
   * @description Whether a tracked live is due for a check.
   * @param {object} video - The video.
   * @returns {boolean} Due.
   */
  function liveDue(video) {
    const checkedAt = video.checkedAt ?? 0;
    if (video.live === 'live') return ms() - checkedAt >= LIVE_RUNNING_CHECK_MS;
    if (video.live !== 'upcoming') return false;
    const start = Date.parse(video.scheduled ?? '');
    if (!Number.isFinite(start)) return ms() - checkedAt >= LIVE_FAR_CHECK_MS;
    if (ms() - start > LIVE_GIVE_UP_MS) return false;
    return ms() - checkedAt >= (start - ms() <= LIVE_SOON_MS ? LIVE_CHECK_MS : LIVE_FAR_CHECK_MS);
  }

  /**
   * @description Announce what changed since the previous round: the new
   * videos, the lives that started. Scheduled readings only.
   * @param {Array<{ channel: object, video: object }>} fresh - The new videos.
   */
  async function announce(fresh) {
    for (const { channel, video: stale } of fresh) {
      const video = state.get(channel.id)?.videos.find((v) => v.id === stale.id) ?? stale;
      if (video.live === 'upcoming') continue;
      if (video.live === 'live') continue; // announced below, with the running lives
      const published = Date.parse(video.published ?? '');
      if (!Number.isFinite(published) || ms() - published > NEW_VIDEO_MAX_AGE_MS) continue;
      await fire(TRIGGERS.NEW_VIDEO, newVideoData(gladys, channel, video, textLanguage()));
    }
    for (const channel of registry.list()) {
      const current = state.get(channel.id);
      const started = (current?.videos ?? []).filter(
        (video) => video.live === 'live' && !video.liveAnnounced,
      );
      if (started.length === 0) continue;
      for (const video of started) {
        await fire(TRIGGERS.LIVE_STARTED, liveStartedData(gladys, channel, video, textLanguage()));
      }
      state.update(channel.id, (s) => {
        s.videos = s.videos.map((video) =>
          started.some((other) => other.id === video.id)
            ? { ...video, liveAnnounced: true }
            : video,
        );
      });
    }
  }

  /**
   * @description Read the statistics of channels (1 unit per 50).
   * @param {object[]} channels - The channels.
   * @param {object} options - Options.
   * @param {boolean} options.scheduled - Announce the milestones.
   * @returns {Promise<void>}
   * @throws {Error} The error of the request.
   */
  async function readStats(channels, { scheduled }) {
    if (channels.length === 0) return;
    const read = await api(() => youtube.channels(channels.map((channel) => channel.id)));
    for (const channel of channels) {
      const fresh = read.find((other) => other.id === channel.id);
      if (!fresh) {
        state.update(channel.id, (s) => {
          s.feedError = 'Channel not found (deleted or terminated?)';
        });
        continue;
      }
      await storeStats(channel, fresh, { scheduled });
    }
    if (await registry.update(read).catch(() => false)) await publishDiscovery();
  }

  /**
   * @description Store the statistics of a channel; fire its milestone.
   * @param {object} channel - The channel.
   * @param {object} fresh - The channel read from YouTube.
   * @param {object} options - Options.
   * @param {boolean} options.scheduled - Announce a new milestone.
   */
  async function storeStats(channel, fresh, { scheduled }) {
    const milestone = milestoneOf(fresh.subscribers);
    // The first reading of a channel is its baseline: never announced.
    const previous = state.get(channel.id)?.milestone ?? null;
    state.update(channel.id, (s) => {
      s.stats = {
        subscribers: fresh.subscribers,
        hidden: fresh.hidden,
        views: fresh.views,
        videos: fresh.videos,
        at: ms(),
      };
      // A milestone seen by a button or an action is left for the clock to
      // announce; only the baseline is set at once.
      if (milestone !== null && (previous === null || (scheduled && milestone > previous))) {
        s.milestone = milestone;
      }
    });
    if (scheduled && previous !== null && milestone !== null && milestone > previous) {
      await fire(
        TRIGGERS.SUBSCRIBER_MILESTONE,
        milestoneData(gladys, channel, milestone, fresh.subscribers, textLanguage()),
      );
    }
  }

  /**
   * @description Check the uploads of channels now, read the details of
   * their new videos, and publish the result.
   * @param {object[]} channels - The channels.
   * @param {object} options - Options.
   * @param {boolean} options.scheduled - A reading of the clock (announces).
   * @returns {Promise<number>} The new videos found.
   */
  async function checkChannels(channels, { scheduled }) {
    const fresh = [];
    for (const [index, channel] of channels.entries()) {
      if (index > 0) await sleep(REQUEST_SPACING_MS);
      try {
        (await readUploads(channel, { scheduled })).forEach((video) =>
          fresh.push({ channel, video }),
        );
      } catch (err) {
        if (err instanceof ApiKeyError || err instanceof QuotaError) break;
      }
    }
    // The details missing (new uploads) and the lives due, in one request.
    const ids = new Set();
    for (const channel of registry.list()) {
      for (const video of state.get(channel.id)?.videos ?? []) {
        if (!video.detailed || liveDue(video)) ids.add(video.id);
      }
    }
    await readDetails([...ids].slice(0, MAX_IDS));
    let newVideos;
    if (scheduled) {
      await announce(fresh);
      newVideos = fresh.length;
    } else {
      // A manual check announces nothing: the clock does it at its next round.
      const seenBefore = new Set();
      channels.forEach((channel) =>
        (state.get(channel.id)?.seen ?? []).forEach((id) => seenBefore.add(id)),
      );
      newVideos = channels.reduce(
        (sum, channel) =>
          sum + (state.get(channel.id)?.videos ?? []).filter((v) => !seenBefore.has(v.id)).length,
        0,
      );
    }
    await publishStates(channels);
    return newVideos;
  }

  /**
   * @description One look at the clock: the feeds due, the details and the
   * lives due, the statistics due. Never two rounds at once.
   * @returns {Promise<void>}
   */
  function tick() {
    running = running.then(async () => {
      if (!gladys.connected) return;
      await checkKey();
      await checkQuota();
      if (!config.apiKey) return;
      const channels = registry.list();
      const feedDue = channels.filter(
        (channel) => ms() - (state.get(channel.id)?.feedAt ?? 0) >= config.feedMinutes * 60000,
      );
      const livesDue = channels.some((channel) =>
        (state.get(channel.id)?.videos ?? []).some(liveDue),
      );
      let changed = false;
      if (feedDue.length > 0 || livesDue) {
        await checkChannels(feedDue, { scheduled: true });
        changed = true;
      }
      const statsDue = channels.some(
        (channel) => ms() - (state.get(channel.id)?.stats?.at ?? 0) >= config.statsMinutes * 60000,
      );
      if (statsDue && ms() - statsAt >= STATS_RETRY_MS && apiUsable()) {
        statsAt = ms();
        try {
          await readStats(channels, { scheduled: true });
          await publishStates(channels);
          changed = true;
        } catch (err) {
          logger.warn(`Statistics: ${err.message}`);
        }
      }
      if (changed) {
        refreshWidgets();
        await checkKey();
        await checkQuota();
        await reportStatus();
      }
    });
    running = running.catch((err) => logger.error('Clock round failed', err));
    return running;
  }

  /** @description Everything that follows a change of the channels. */
  async function channelsChanged() {
    state.keep(registry.list().map((channel) => channel.id));
    await publishDiscovery();
    await publishStates(registry.list());
    refreshWidgets();
    await reportStatus();
  }

  /**
   * @description A one-line description of a channel.
   * @param {object} channel - The channel.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function describe(channel, lang) {
    const current = state.get(channel.id);
    const latest = latestOf(current?.videos);
    const subscribers = current?.stats?.subscribers;
    return (
      t('listLine', lang, {
        n: registry.numberOf(channel),
        title: channel.title,
        handle: channel.handle ? `${channel.handle} ` : '',
        id: channel.id,
        subscribers:
          subscribers === null || subscribers === undefined
            ? current?.stats?.hidden
              ? t('hiddenCount', lang)
              : '?'
            : formatNumber(subscribers, lang),
        latest: latest ? `“${latest.title}”` : t('noVideo', lang),
        checked: ago(current?.feedAt ?? 0, ms(), lang),
      }) + (current?.feedError ? t('listError', lang, { message: current.feedError }) : '')
    );
  }

  /**
   * @description Run a change of the registry, turning its errors into a
   * message in the language of the integration.
   * @param {Function} change - `() => Promise`.
   * @returns {Promise<*>} The result of the change.
   */
  async function guarded(change) {
    try {
      return await change();
    } catch (err) {
      if (err instanceof RegistryError) {
        throw new Error(t(err.key, textLanguage(), err.params), { cause: err });
      }
      throw new Error(t('errorSave', textLanguage(), { message: err.message }), { cause: err });
    }
  }

  /**
   * @description Check channels now for a button or an action, unless they
   * were checked a moment ago. Announces nothing.
   * @param {object[]} channels - The channels.
   * @returns {Promise<number>} The new videos found.
   */
  async function checkNow(channels) {
    const due = channels.filter(
      (channel) => ms() - (state.get(channel.id)?.feedAt ?? 0) >= MIN_MANUAL_GAP_MS,
    );
    if (due.length === 0) return 0;
    return checkChannels(due, { scheduled: false });
  }

  // --- Configuration buttons ------------------------------------------------
  gladys.onAction(ACTIONS.ADD, async (fields = {}) => {
    const query = parseChannelInput(fields.channel);
    if (!query) throw new Error(t('errorInput', textLanguage()));
    let resolved;
    try {
      resolved = await api(() => youtube.resolve(query));
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new Error(
          t('errorNoChannel', textLanguage(), { input: String(fields.channel).slice(0, 100) }),
          { cause: err },
        );
      }
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
    const { channel, existed } = await guarded(() => registry.add(resolved));
    logger.info(`Channel ${channel.id} ${existed ? 'refreshed' : 'added'}`);
    await storeStats(channel, resolved, { scheduled: false });
    // The uploads of today are the past: read once, never announced.
    try {
      await readUploads(channel, { scheduled: false });
      await readDetails(
        (state.get(channel.id)?.videos ?? []).filter((v) => !v.detailed).map((v) => v.id),
      );
      // A live already running when the channel is added is not "starting".
      state.update(channel.id, (s) => {
        s.videos = s.videos.map((v) => (v.live === 'live' ? { ...v, liveAnnounced: true } : v));
      });
    } catch (err) {
      logger.warn(`Channel ${channel.id}: ${err.message}`);
    }
    await channelsChanged();
    return all((lang) =>
      t(existed ? 'addedExisting' : 'added', lang, { line: describe(channel, lang) }),
    );
  });

  gladys.onAction(ACTIONS.REMOVE, async (fields = {}) => {
    const channel = await guarded(() => registry.remove(fields.channel));
    logger.info(`Channel ${channel.id} removed`);
    await channelsChanged();
    return all('removed', { name: channel.title });
  });

  gladys.onAction(ACTIONS.LIST, async () => {
    const channels = registry.list();
    if (channels.length === 0) return all('listEmpty');
    return all((lang) =>
      [
        t('listHeader', lang, {
          count: channels.length,
          used: formatNumber(usage.used(), lang),
          budget: formatNumber(usage.budget(), lang),
          planned: formatNumber(plannedPerDay(), lang),
        }),
        ...channels.map((channel) => describe(channel, lang)),
      ].join('\n'),
    );
  });

  gladys.onAction(ACTIONS.TEST_KEY, async () => {
    let channel;
    try {
      channel = await api(() => youtube.resolve({ kind: 'handle', value: TEST_HANDLE }));
    } catch (err) {
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
    refreshWidgets();
    return all('testOk', { title: channel.title, used: usage.used() });
  });

  // --- Scene actions --------------------------------------------------------
  /**
   * @description The followed channel of a scene field (a device external id).
   * @param {unknown} value - The field.
   * @returns {object} The channel.
   * @throws {Error} When it is not a followed channel.
   */
  function channelOfField(value) {
    const channel = registry.byId(idFromExternalId(value));
    if (!channel) throw new Error(t('errorUnknownDevice', textLanguage()));
    return channel;
  }

  gladys.onSceneAction(SCENE_ACTIONS.LATEST_VIDEO, async (fields = {}) => {
    const channel = channelOfField(fields.channel);
    try {
      await checkNow([channel]);
    } catch (err) {
      logger.warn(`Channel ${channel.id}: ${err.message}`);
    }
    const videos = (state.get(channel.id)?.videos ?? []).filter(
      (video) => video.live !== 'upcoming' && (fields.include_shorts !== false || !video.short),
    );
    if (videos.length === 0) throw new Error(t('errorNoVideoYet', textLanguage()));
    return latestVideoOutputs(channel, videos[0], textLanguage());
  });

  gladys.onSceneAction(SCENE_ACTIONS.CHANNEL_STATS, async (fields = {}) => {
    const channel = channelOfField(fields.channel);
    if (!state.get(channel.id)?.stats) {
      try {
        await readStats([channel], { scheduled: false });
      } catch (err) {
        throw new Error(errorMessage(err, textLanguage()), { cause: err });
      }
    }
    const stats = state.get(channel.id)?.stats;
    if (!stats) throw new Error(t('errorNoStats', textLanguage()));
    return statsOutputs(channel, stats, textLanguage());
  });

  // --- Widgets --------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.LATEST_VIDEOS, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const wanted = new Set(
      []
        .concat(settings.channels ?? [])
        .filter(Boolean)
        .map(idFromExternalId),
    );
    const channels = registry
      .list()
      .filter((channel) => wanted.size === 0 || wanted.has(channel.id))
      .map((channel) => ({ channel, state: state.get(channel.id) }));
    return buildLatestVideosWidget({
      channels,
      shorts: settings.shorts !== false,
      hasKey: Boolean(config.apiKey),
      language: isLanguage(lang) ? lang : textLanguage(),
      timezone,
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.CHANNEL, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const channel = registry.byId(idFromExternalId(settings.channel)) ?? null;
    return buildChannelWidget({
      channel,
      state: channel ? state.get(channel.id) : null,
      chosen: Boolean(settings.channel),
      hasKey: Boolean(config.apiKey),
      language: isLanguage(lang) ? lang : textLanguage(),
      timezone,
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.QUOTA, async ({ language: lang } = {}) => {
    rememberLanguage(lang);
    const paused = ms() < state.pausedUntil() || usage.exhausted();
    return buildQuotaWidget({
      used: usage.used(),
      budget: usage.budget(),
      planned: plannedPerDay(),
      channels: registry.list().length,
      resetAt: usage.resetAt(),
      keyState: paused && keyState !== 'refused' && config.apiKey ? 'paused' : keyState,
      language: isLanguage(lang) ? lang : textLanguage(),
      timezone,
    });
  });

  // Image keys encode the video they stand for (images.js): the handler only
  // ever fetches a YouTube thumbnail.
  gladys.onWidgetGetImage(async (imageKey) => {
    const id = videoIdOfKey(imageKey);
    if (!id) throw new Error(`Unknown image key: ${imageKey}`);
    const bytes = await youtube.thumbnail(id);
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`Thumbnail too large: ${bytes.length}`);
    return bytes.toString('base64');
  });

  /**
   * @description The "Check now" / "Refresh" buttons. The answer is a toast
   * (200 characters at most), a refused request included.
   * @param {string} actionKey - The action of the button.
   * @param {object} params - Its params (sent by the content: channel ids).
   * @returns {Promise<object>} The toast, in every language.
   */
  async function widgetAction(actionKey, params = {}) {
    if (actionKey !== WIDGET_ACTIONS.REFRESH) throw new Error(`Unknown widget action ${actionKey}`);
    const channels = []
      .concat(params.channels ?? [])
      .slice(0, MAX_IDS)
      .map((id) => registry.byId(id))
      .filter(Boolean);
    if (channels.length === 0) return all((lang) => t('widgetUnknownChannel', lang).slice(0, 200));
    let found;
    try {
      found = await checkNow(channels);
      if (channels.length === 1) {
        const stats = state.get(channels[0].id)?.stats;
        if (apiUsable() && (!stats || ms() - stats.at >= MIN_MANUAL_GAP_MS)) {
          await readStats(channels, { scheduled: false });
          await publishStates(channels);
        }
      }
    } catch (err) {
      return all((lang) => errorMessage(err, lang).slice(0, 200));
    }
    refreshWidgets();
    return all((lang) => t('toastChecked', lang, { count: channels.length, found }).slice(0, 200));
  }
  gladys.onWidgetAction(WIDGETS.LATEST_VIDEOS, widgetAction);
  gladys.onWidgetAction(WIDGETS.CHANNEL, widgetAction);

  // --- Devices and configuration --------------------------------------------
  gladys.onScanRequest(async () => {
    await publishDiscovery();
  });

  gladys.onDeviceCreated(async (device) => {
    const channel = registry.byId(idFromExternalId(device.external_id));
    if (channel) {
      // States published before the device existed were dropped by Gladys:
      // send them all again.
      const states = buildStates(gladys, channel, state.get(channel.id), {
        language: textLanguage(),
        timezone,
      });
      if (states.length > 0) {
        try {
          await gladys.publishStates(states);
        } catch (err) {
          logger.error('Unable to publish the states', err);
        }
      }
    }
    widgetRefreshedAt.clear();
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    const channel = registry.byId(idFromExternalId(device.external_id));
    if (channel) await publishStates([channel]);
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = { language: textLanguage(), apiKey: config.apiKey };
    config = normalizeConfig(raw);
    if (config.apiKey !== previous.apiKey) {
      keyState = config.apiKey ? 'unknown' : 'missing';
      keyReason = null;
      keyRefusedAt = 0;
      state.setFlag('key_refused', false);
    }
    if (textLanguage() !== previous.language) {
      await publishDiscovery();
      await publishStates(registry.list());
    }
    refreshWidgets();
    await reportStatus();
    await tick();
  });

  gladys.on('connected', async () => {
    const raw = gladys.config ?? {};
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
    registry.load(raw);
    state.keep(registry.list().map((channel) => channel.id));
    if (!config.apiKey) keyState = 'missing';
    else if (keyState === 'missing') keyState = 'unknown';
    lastStatus = null;
    logger.info(`${registry.list().length} channel(s), timezone ${timezone}`);
    await publishDiscovery();
    await publishStates(registry.list());
    await reportStatus();
    await tick();
    if (tickMs > 0 && timer === null) {
      timer = setInterval(() => tick(), tickMs);
      timer.unref?.();
    }
  });

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stop();
    await running;
  });

  return { tick, registry, usage, state, stop };
}

export { ACTIONS, TICK_MS, TEST_HANDLE, hintKey, createApp };
