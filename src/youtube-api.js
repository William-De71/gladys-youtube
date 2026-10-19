// -----------------------------------------------------------------------------
// Client of YouTube: the official YouTube Data API v3 (with the user's own
// API key), the public RSS feed of a channel, the public thumbnails, and the
// Shorts check of youtubeaio (the library of the Home Assistant integration).
//
// Data API v3, documented contract (https://developers.google.com/youtube/v3,
// checked on 2026-10-20):
//   GET https://www.googleapis.com/youtube/v3/channels       1 unit
//       part=snippet,statistics,contentDetails; exactly one filter among
//       id (comma-separated), forHandle (with or without "@"), forUsername.
//       statistics.subscriberCount is rounded DOWN to three significant
//       figures; hiddenSubscriberCount; videoCount counts public videos;
//       contentDetails.relatedPlaylists.uploads is the uploads playlist.
//   GET .../playlistItems   1 unit   playlistId, maxResults 0-50 (default 5)
//   GET .../videos          1 unit   id (comma-separated, 50 at most),
//       part=snippet,contentDetails,liveStreamingDetails:
//       snippet.liveBroadcastContent live | upcoming | none,
//       contentDetails.duration ISO 8601 (PT#M#S, P#DT#H#M#S),
//       liveStreamingDetails.scheduledStartTime / actualStartTime / actualEndTime.
//   search.list is NEVER used (100 units a call).
//   Default quota: 10,000 units a day per Cloud project, reset at midnight
//   Pacific Time; even an invalid request costs at least one unit, so every
//   answer of Google is counted.
//   The key travels in the X-Goog-Api-Key header, never in the URL (URLs end
//   up in logs).
//
// RSS feed (no key, no quota): https://www.youtube.com/feeds/videos.xml?channel_id=UC…
//   the 15 latest uploads, newest first, served from a cache of 15 minutes
//   (Cache-Control: max-age=900); the link of a Short is /shorts/<id>, the
//   link of any other video /watch?v=<id>. It is not a documented API and
//   has known outages (404 for every feed for a few hours): the integration
//   falls back on playlistItems.list (1 unit) when it fails.
//
// Shorts outside the feed: HEAD https://www.youtube.com/shorts/<id> answers
// 200 for a Short and a 3xx redirect to /watch for any other video.
// -----------------------------------------------------------------------------

const API_URL = 'https://www.googleapis.com/youtube/v3';
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml';
const SHORTS_URL = 'https://www.youtube.com/shorts/';
const THUMBNAIL_HOST = 'https://i.ytimg.com';
const TIMEOUT_MS = 15 * 1000;
// Ids per channels.list or videos.list request.
const MAX_IDS = 50;
// Items of a playlistItems.list fallback: as many as the RSS feed.
const FEED_SIZE = 15;
// Default quota of a Cloud project, in units a day.
const DEFAULT_QUOTA = 10000;

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;
const HANDLE = /^[\p{L}\p{N}._-]{3,30}$/u;

/** @description Any failure of YouTube. */
class YouTubeError extends Error {
  /**
   * @param {string} message - The message (never contains the key).
   * @param {number|null} status - The HTTP status (null: network).
   * @param {string|null} [reason] - The Google reason.
   */
  constructor(message, status, reason = null) {
    super(message);
    this.name = 'YouTubeError';
    this.status = status;
    this.reason = reason;
  }
}

/**
 * @description The key is missing, invalid, restricted, or the Cloud project
 * cannot use the API (not enabled). Retrying will not help until the user acts.
 */
class ApiKeyError extends YouTubeError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'ApiKeyError';
  }
}

/** @description Google refuses for quota (403 quotaExceeded) or rate (429). */
class QuotaError extends YouTubeError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'QuotaError';
  }
}

/** @description The daily budget of the integration is spent. */
class BudgetExceededError extends YouTubeError {
  /** @param {number} budget - The daily budget, in units. */
  constructor(budget) {
    super(`Daily budget of ${budget} units reached`, null, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
  }
}

/** @description What the user typed is not a channel YouTube knows. */
class NotFoundError extends YouTubeError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ErrorInfo reasons and legacy `errors[].reason` values pointing at the key
// or the Cloud project.
const KEY_REASONS = new Set([
  'API_KEY_INVALID',
  'API_KEY_EXPIRED',
  'API_KEY_SERVICE_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
  'SERVICE_DISABLED',
  'CONSUMER_INVALID',
  'accessNotConfigured',
  'keyInvalid',
  'keyExpired',
  'ipRefererBlocked',
]);
const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'RATE_LIMIT_EXCEEDED',
]);

/**
 * @description Read a Google error body.
 * @param {object|null} body - The parsed body.
 * @returns {{ message: string, status: string|null, reason: string|null, legacy: string|null }} The error.
 */
function readError(body) {
  const error = body?.error ?? {};
  const details = Array.isArray(error.details) ? error.details : [];
  const info = details.find((detail) => typeof detail?.reason === 'string');
  const legacy = Array.isArray(error.errors)
    ? error.errors.find((e) => typeof e?.reason === 'string')
    : null;
  return {
    message: typeof error.message === 'string' ? error.message.slice(0, 300) : '',
    status: typeof error.status === 'string' ? error.status : null,
    reason: info?.reason ?? null,
    legacy: legacy?.reason ?? null,
  };
}

/**
 * @description Turn an HTTP failure of the Data API into the right error class.
 * @param {number} httpStatus - The HTTP status.
 * @param {object|null} body - The parsed body.
 * @returns {YouTubeError} The error.
 * @example
 * classifyError(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }); // QuotaError
 */
function classifyError(httpStatus, body) {
  const { message, status, reason, legacy } = readError(body);
  const text = `YouTube Data API ${httpStatus}${status ? ` ${status}` : ''}${message ? `: ${message}` : ''}`;
  if (QUOTA_REASONS.has(reason) || QUOTA_REASONS.has(legacy) || httpStatus === 429) {
    return new QuotaError(text, httpStatus, legacy ?? reason ?? 'quotaExceeded');
  }
  // A bad key answers 400 INVALID_ARGUMENT with the API_KEY_INVALID reason.
  if (KEY_REASONS.has(reason) || KEY_REASONS.has(legacy)) {
    return new ApiKeyError(text, httpStatus, reason ?? legacy);
  }
  if (httpStatus === 401 || (httpStatus === 403 && status === 'PERMISSION_DENIED')) {
    return new ApiKeyError(text, httpStatus, reason ?? legacy ?? 'PERMISSION_DENIED');
  }
  if (/api key/i.test(message)) {
    return new ApiKeyError(text, httpStatus, reason ?? legacy ?? 'API_KEY_INVALID');
  }
  if (httpStatus === 404) {
    return new NotFoundError(text);
  }
  return new YouTubeError(text, httpStatus, reason ?? legacy ?? status);
}

/**
 * @description What the user typed to add a channel: an id, a handle, a
 * legacy user name, or a video whose channel is wanted.
 * @param {unknown} raw - "@handle", "handle", "UC…", or a youtube.com /
 *   youtu.be URL (channel, @handle, /user/, /c/, watch, shorts, live).
 * @returns {{ kind: 'id'|'handle'|'username'|'video', value: string }|null} The query, null when unreadable.
 * @example
 * parseChannelInput('https://www.youtube.com/@GoogleDevelopers/videos'); // -> { kind: 'handle', value: 'GoogleDevelopers' }
 */
function parseChannelInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (CHANNEL_ID.test(text)) return { kind: 'id', value: text };
  if (text.startsWith('@')) {
    const handle = text.slice(1);
    return HANDLE.test(handle) ? { kind: 'handle', value: handle } : null;
  }
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    url = null;
  }
  const host = url?.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  if (url && (host === 'youtube.com' || host === 'youtu.be')) {
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (host === 'youtu.be') {
      return VIDEO_ID.test(parts[0] ?? '') ? { kind: 'video', value: parts[0] } : null;
    }
    const [first = '', second = ''] = parts;
    if (first.startsWith('@')) {
      const handle = first.slice(1);
      return HANDLE.test(handle) ? { kind: 'handle', value: handle } : null;
    }
    if (first === 'channel' && CHANNEL_ID.test(second)) return { kind: 'id', value: second };
    if (first === 'user' && /^[\w.-]{1,100}$/.test(second)) {
      return { kind: 'username', value: second };
    }
    // Legacy custom URLs (/c/Name) have no API: the name is most often the handle.
    if (first === 'c' && HANDLE.test(second)) return { kind: 'handle', value: second };
    if (first === 'watch') {
      const id = url.searchParams.get('v') ?? '';
      return VIDEO_ID.test(id) ? { kind: 'video', value: id } : null;
    }
    if (['shorts', 'live', 'embed', 'v'].includes(first) && VIDEO_ID.test(second)) {
      return { kind: 'video', value: second };
    }
    return null;
  }
  // A bare handle, without "@".
  return HANDLE.test(text) && !text.includes('.') ? { kind: 'handle', value: text } : null;
}

/**
 * @description Seconds of an ISO 8601 duration ("PT1H2M3S", "P1DT2H", "P0D").
 * @param {unknown} value - The duration.
 * @returns {number} The seconds, 0 when unreadable.
 * @example
 * parseDuration('PT12M5S'); // -> 725
 */
function parseDuration(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value ?? ''));
  if (!match) return 0;
  const [, d = 0, h = 0, m = 0, s = 0] = match;
  return Number(d) * 86400 + Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * @description A count of the Data API (they come as strings).
 * @param {unknown} value - The count.
 * @returns {number|null} The count, null when absent.
 */
function count(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * @description The largest thumbnail URL of a thumbnails map.
 * @param {object} thumbnails - The map.
 * @returns {string|null} The URL.
 */
function bestThumbnail(thumbnails) {
  for (const size of ['high', 'medium', 'default']) {
    const url = thumbnails?.[size]?.url;
    if (typeof url === 'string' && url.startsWith('https://')) return url;
  }
  return null;
}

/**
 * @description A channel of channels.list.
 * @param {object} item - The resource.
 * @returns {object} `{ id, title, handle, thumbnail, uploads, subscribers, hidden, views, videos }`.
 */
function readChannel(item) {
  const snippet = item?.snippet ?? {};
  const stats = item?.statistics ?? {};
  const custom = typeof snippet.customUrl === 'string' ? snippet.customUrl : '';
  return {
    id: item.id,
    title: String(snippet.title ?? item.id).slice(0, 100),
    handle: custom.startsWith('@') ? custom.slice(0, 40) : '',
    thumbnail: bestThumbnail(snippet.thumbnails),
    uploads:
      item?.contentDetails?.relatedPlaylists?.uploads ?? `UU${String(item.id ?? '').slice(2)}`,
    hidden: stats.hiddenSubscriberCount === true,
    subscribers: stats.hiddenSubscriberCount === true ? null : count(stats.subscriberCount),
    views: count(stats.viewCount),
    videos: count(stats.videoCount),
  };
}

/**
 * @description The details of a video of videos.list.
 * @param {object} item - The resource.
 * @returns {object} `{ id, title, published, duration, live, scheduled, started, ended }`.
 */
function readVideo(item) {
  const snippet = item?.snippet ?? {};
  const live = item?.liveStreamingDetails ?? {};
  const state = ['live', 'upcoming'].includes(snippet.liveBroadcastContent)
    ? snippet.liveBroadcastContent
    : 'none';
  return {
    id: item.id,
    channelId: snippet.channelId ?? null,
    title: String(snippet.title ?? '').slice(0, 200),
    published: snippet.publishedAt ?? null,
    duration: parseDuration(item?.contentDetails?.duration),
    live: state,
    wasLive: Boolean(live.actualStartTime || live.scheduledStartTime),
    scheduled: live.scheduledStartTime ?? null,
    started: live.actualStartTime ?? null,
    ended: live.actualEndTime ?? null,
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * @description Decode the XML entities of a text node.
 * @param {string} text - The raw text.
 * @returns {string} The text.
 */
function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * @description The entries of a channel RSS feed (Atom), newest first.
 * @param {string} xml - The feed.
 * @returns {object[]} `{ id, title, published, short }`.
 * @example
 * parseFeed(xml)[0]; // -> { id: 'LJ2v4-FvPcA', title: '…', published: '2026-10-16T21:00:00+00:00', short: true }
 */
function parseFeed(xml) {
  const text = String(xml ?? '');
  if (!/<feed[\s>]/.test(text)) {
    throw new YouTubeError('The RSS feed is not an Atom feed', 200, 'FEED_INVALID');
  }
  const entries = [];
  for (const [, entry] of text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry)?.[1];
    if (!id) continue;
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] ?? '';
    const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1] ?? null;
    const link = /<link rel="alternate" href="([^"]+)"/.exec(entry)?.[1] ?? '';
    entries.push({
      id,
      title: decodeXml(title).trim().slice(0, 200),
      published,
      short: link.includes('/shorts/'),
    });
  }
  return entries.sort((a, b) => Date.parse(b.published ?? 0) - Date.parse(a.published ?? 0));
}

/**
 * @description The public URL of a video.
 * @param {string} id - The video id.
 * @param {boolean} [short] - A Short.
 * @returns {string} The URL.
 */
const videoUrl = (id, short = false) =>
  short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;

/**
 * @description The public URL of a thumbnail (320 × 180, 16:9, no black bars).
 * @param {string} id - The video id.
 * @returns {string} The URL.
 */
const thumbnailUrl = (id) => `${THUMBNAIL_HOST}/vi/${id}/mqdefault.jpg`;

/**
 * @description Create the YouTube client.
 * @param {object} options - Options.
 * @param {Function} options.getApiKey - `() => string`.
 * @param {object} options.usage - The daily unit counter (usage.js).
 * @param {Function} [options.fetchImpl] - `fetch` (injected by the tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The client.
 * @example
 * const youtube = createYouTube({ getApiKey: () => key, usage });
 */
function createYouTube({ getApiKey, usage, fetchImpl = fetch, logger = console }) {
  /**
   * @description One GET of the Data API: 1 unit, counted once Google answered.
   * @param {string} resource - channels, playlistItems or videos.
   * @param {object} params - The query.
   * @returns {Promise<object>} The body.
   */
  async function get(resource, params) {
    const apiKey = getApiKey();
    if (!apiKey) throw new ApiKeyError('No API key configured', null, 'API_KEY_MISSING');
    if (usage.exhausted()) throw new BudgetExceededError(usage.budget());
    const url = `${API_URL}/${resource}?${new URLSearchParams(params)}`;
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { 'X-Goog-Api-Key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new YouTubeError(`YouTube Data API unreachable: ${err.message}`, null);
    }
    // Any answer costs at least one unit, an error included.
    usage.record(1);
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) throw classifyError(response.status, body);
    logger.debug?.(`YouTube ${resource} OK (${usage.used()} unit(s) today)`);
    return body ?? {};
  }

  /**
   * @description Download a public resource (feed, thumbnail).
   * @param {string} url - The URL.
   * @param {object} [options] - fetch options.
   * @returns {Promise<Response>} The response.
   */
  async function download(url, options = {}) {
    try {
      return await fetchImpl(url, {
        ...options,
        headers: { 'User-Agent': 'gladys-youtube', ...(options.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new YouTubeError(`YouTube unreachable: ${err.message}`, null);
    }
  }

  const client = {
    /**
     * @description Channels by id, 50 per request (1 unit each).
     * @param {string[]} ids - Channel ids.
     * @returns {Promise<object[]>} The channels found (readChannel).
     */
    async channels(ids) {
      const found = [];
      for (let i = 0; i < ids.length; i += MAX_IDS) {
        const body = await get('channels', {
          part: 'snippet,statistics,contentDetails',
          id: ids.slice(i, i + MAX_IDS).join(','),
          maxResults: String(MAX_IDS),
        });
        (body.items ?? []).forEach((item) => found.push(readChannel(item)));
      }
      return found;
    },

    /**
     * @description The channel of what the user typed (1 unit, 2 for a video).
     * @param {{ kind: string, value: string }} query - parseChannelInput.
     * @returns {Promise<object>} The channel (readChannel).
     * @throws {NotFoundError} When YouTube knows no such channel.
     */
    async resolve(query) {
      let filter;
      if (query.kind === 'video') {
        const [video] = await client.videos([query.value]);
        if (!video?.channelId) throw new NotFoundError(`No video ${query.value}`);
        filter = { id: video.channelId };
      } else if (query.kind === 'id') filter = { id: query.value };
      else if (query.kind === 'username') filter = { forUsername: query.value };
      else filter = { forHandle: `@${query.value}` };
      const body = await get('channels', { part: 'snippet,statistics,contentDetails', ...filter });
      const item = (body.items ?? [])[0];
      if (!item) throw new NotFoundError(`No channel for ${query.kind} ${query.value}`);
      return readChannel(item);
    },

    /**
     * @description Details of videos, 50 per request (1 unit each).
     * @param {string[]} ids - Video ids.
     * @returns {Promise<object[]>} The videos found (readVideo).
     */
    async videos(ids) {
      const found = [];
      for (let i = 0; i < ids.length; i += MAX_IDS) {
        const body = await get('videos', {
          part: 'snippet,contentDetails,liveStreamingDetails',
          id: ids.slice(i, i + MAX_IDS).join(','),
          maxResults: String(MAX_IDS),
        });
        (body.items ?? []).forEach((item) => found.push(readVideo(item)));
      }
      return found;
    },

    /**
     * @description The latest uploads of a channel from its uploads playlist
     * (1 unit): the fallback of the RSS feed. No Shorts flag here.
     * @param {string} playlistId - The uploads playlist.
     * @returns {Promise<object[]>} `{ id, title, published, short: null }`, newest first.
     */
    async uploads(playlistId) {
      const body = await get('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(FEED_SIZE),
      });
      return (body.items ?? [])
        .map((item) => ({
          id: item?.contentDetails?.videoId ?? item?.snippet?.resourceId?.videoId,
          title: String(item?.snippet?.title ?? '').slice(0, 200),
          published: item?.contentDetails?.videoPublishedAt ?? item?.snippet?.publishedAt ?? null,
          short: null,
        }))
        .filter((video) => VIDEO_ID.test(video.id ?? ''))
        .sort((a, b) => Date.parse(b.published ?? 0) - Date.parse(a.published ?? 0));
    },

    /**
     * @description The RSS feed of a channel (no key, no quota).
     * @param {string} channelId - The channel id.
     * @returns {Promise<object[]>} parseFeed.
     */
    async feed(channelId) {
      const response = await download(`${FEED_URL}?channel_id=${encodeURIComponent(channelId)}`);
      if (!response.ok) {
        throw new YouTubeError(`RSS feed ${response.status}`, response.status, 'FEED_HTTP');
      }
      return parseFeed(await response.text());
    },

    /**
     * @description Whether a video is a Short (no quota): 200 on /shorts/,
     * a redirect for any other video.
     * @param {string} id - The video id.
     * @returns {Promise<boolean|null>} null when YouTube answers otherwise.
     */
    async isShort(id) {
      try {
        const response = await download(`${SHORTS_URL}${id}`, {
          method: 'HEAD',
          redirect: 'manual',
        });
        if (response.status === 200) return true;
        if (response.status >= 300 && response.status < 400) return false;
        return null;
      } catch {
        return null;
      }
    },

    /**
     * @description The bytes of a thumbnail (no quota).
     * @param {string} id - The video id.
     * @returns {Promise<Buffer>} The JPEG.
     */
    async thumbnail(id) {
      const response = await download(thumbnailUrl(id));
      if (!response.ok) {
        throw new YouTubeError(`Thumbnail ${response.status}`, response.status, 'THUMBNAIL');
      }
      return Buffer.from(await response.arrayBuffer());
    },
  };
  return client;
}

export {
  API_URL,
  FEED_URL,
  MAX_IDS,
  FEED_SIZE,
  DEFAULT_QUOTA,
  CHANNEL_ID,
  VIDEO_ID,
  YouTubeError,
  ApiKeyError,
  QuotaError,
  BudgetExceededError,
  NotFoundError,
  readError,
  classifyError,
  parseChannelInput,
  parseDuration,
  readChannel,
  readVideo,
  decodeXml,
  parseFeed,
  videoUrl,
  thumbnailUrl,
  createYouTube,
};
