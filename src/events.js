// -----------------------------------------------------------------------------
// Scene triggers and scene actions of the integration.
//
// Triggers, one event per transition (never a periodic snapshot):
//   - `new_video`             a followed channel publishes a video or a Short
//                             (seen for the first time, published less than
//                             48 hours ago; never the uploads found when the
//                             channel is added);
//   - `live_started`          a live (or a premiere) of a followed channel
//                             starts;
//   - `subscriber_milestone`  a channel reaches a new subscriber milestone
//                             (100, 200, 500, 1,000, 2,000, 5,000…), once:
//                             the highest milestone is kept, a dip below
//                             and back never fires again;
//   - `api_key_refused`       Google starts refusing the key: once, until a
//                             request succeeds again;
//   - `quota_exhausted`       the daily budget of the integration is spent,
//                             or Google refuses the quota of the project:
//                             once per quota day.
// Subscribers, views and videos are device features: "more than 10,000
// subscribers" is a device-state trigger of Gladys.
//
// Actions (no event as their consequence):
//   - `latest_video`   the latest upload of a channel: title, URL, date,
//                      duration, Short or not, summary;
//   - `channel_stats`  the statistics of a channel and a summary sentence.
// Every event value is a flat scalar.
// -----------------------------------------------------------------------------

import { idsOf } from './device.js';
import { videoUrl, thumbnailUrl } from './youtube-api.js';
import { t, formatNumber, formatDuration } from './i18n.js';

const TRIGGERS = {
  NEW_VIDEO: 'new_video',
  LIVE_STARTED: 'live_started',
  SUBSCRIBER_MILESTONE: 'subscriber_milestone',
  API_KEY_REFUSED: 'api_key_refused',
  QUOTA_EXHAUSTED: 'quota_exhausted',
};
const SCENE_ACTIONS = { LATEST_VIDEO: 'latest_video', CHANNEL_STATS: 'channel_stats' };
const KINDS = { VIDEO: 'video', SHORT: 'short' };
const QUOTA_SOURCES = { BUDGET: 'budget', GOOGLE: 'google' };
// A video published longer ago is never announced (it entered the feed
// because a newer one was deleted, or was made public long after).
const NEW_VIDEO_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * @description The highest subscriber milestone at or under a count:
 * 1, 2 and 5 times a power of ten, from 100.
 * @param {number|null} count - Subscribers.
 * @returns {number|null} The milestone, null under 100.
 * @example
 * milestoneOf(123456); // -> 100000
 */
function milestoneOf(count) {
  if (!Number.isFinite(count) || count < 100) return null;
  const power = 10 ** Math.floor(Math.log10(count));
  const lead = Math.floor(count / power + 1e-9);
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

/**
 * @description The kind of a video.
 * @param {object} video - The video.
 * @returns {string} video or short.
 */
const kindOf = (video) => (video.short ? KINDS.SHORT : KINDS.VIDEO);

/**
 * @description The sentence of a video, for a message or a voice.
 * @param {string} channelName - The channel.
 * @param {object} video - The video.
 * @param {string} language - The language.
 * @returns {string} The sentence.
 */
function videoSummary(channelName, video, language) {
  const values = {
    channel: channelName,
    title: String(video.title ?? '').slice(0, 500),
    duration: video.duration ? ` (${formatDuration(video.duration)})` : '',
    url: videoUrl(video.id, video.short),
  };
  return t(video.short ? 'summaryNewShort' : 'summaryNewVideo', language, values).slice(0, 1000);
}

/**
 * @description The data of a new_video event.
 * @param {object} gladys - The SDK client (external ids).
 * @param {object} channel - The channel.
 * @param {object} video - The video.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function newVideoData(gladys, channel, video, language) {
  return {
    channel: idsOf(gladys, channel.id).device,
    channel_name: channel.title.slice(0, 200),
    kind: kindOf(video),
    short: Boolean(video.short),
    title: String(video.title ?? '').slice(0, 500),
    url: videoUrl(video.id, video.short),
    video_id: video.id,
    duration_seconds: video.duration ?? 0,
    duration: video.duration ? formatDuration(video.duration) : '',
    published_at: video.published ?? '',
    thumbnail: thumbnailUrl(video.id),
    summary: videoSummary(channel.title, video, language),
  };
}

/**
 * @description The data of a live_started event.
 * @param {object} gladys - The SDK client (external ids).
 * @param {object} channel - The channel.
 * @param {object} video - The live.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function liveStartedData(gladys, channel, video, language) {
  const url = videoUrl(video.id);
  return {
    channel: idsOf(gladys, channel.id).device,
    channel_name: channel.title.slice(0, 200),
    title: String(video.title ?? '').slice(0, 500),
    url,
    video_id: video.id,
    started_at: video.started ?? '',
    scheduled_at: video.scheduled ?? '',
    thumbnail: thumbnailUrl(video.id),
    summary: t('summaryLive', language, { channel: channel.title, title: video.title, url }).slice(
      0,
      1000,
    ),
  };
}

/**
 * @description The data of a subscriber_milestone event.
 * @param {object} gladys - The SDK client (external ids).
 * @param {object} channel - The channel.
 * @param {number} milestone - The milestone reached.
 * @param {number} subscribers - The subscribers now.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function milestoneData(gladys, channel, milestone, subscribers, language) {
  return {
    channel: idsOf(gladys, channel.id).device,
    channel_name: channel.title.slice(0, 200),
    milestone,
    subscribers,
    summary: t('summaryMilestone', language, {
      channel: channel.title,
      milestone: formatNumber(milestone, language),
    }),
  };
}

/**
 * @description The data of an api_key_refused event.
 * @param {string} reason - The Google reason.
 * @param {string} hint - What to do, in the language.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function keyRefusedData(reason, hint, language) {
  return { reason, summary: t('apiErrorSummary', language, { reason, hint }).slice(0, 1000) };
}

/**
 * @description The data of a quota_exhausted event.
 * @param {string} source - budget (the integration's own) or google.
 * @param {number} used - Units spent today.
 * @param {number} budget - The daily budget.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function quotaData(source, used, budget, language) {
  return {
    source,
    used,
    budget,
    summary: t(
      source === QUOTA_SOURCES.GOOGLE ? 'quotaGoogleSummary' : 'quotaBudgetSummary',
      language,
      {
        used: formatNumber(used, language),
        budget: formatNumber(budget, language),
      },
    ),
  };
}

/**
 * @description The outputs of the latest_video action.
 * @param {object} channel - The channel.
 * @param {object} video - The video.
 * @param {string} language - The language of the summary.
 * @returns {object} The declared outputs, scalars only.
 */
function latestVideoOutputs(channel, video, language) {
  return {
    title: String(video.title ?? '').slice(0, 500),
    url: videoUrl(video.id, video.short),
    video_id: video.id,
    short: Boolean(video.short),
    duration_seconds: video.duration ?? 0,
    published_at: video.published ?? '',
    live: video.live ?? 'none',
    summary: videoSummary(channel.title, video, language),
  };
}

/**
 * @description The outputs of the channel_stats action.
 * @param {object} channel - The channel.
 * @param {object} stats - Its statistics.
 * @param {string} language - The language of the summary.
 * @returns {object} The declared outputs, scalars only.
 */
function statsOutputs(channel, stats, language) {
  const subscribers = stats.subscribers ?? -1;
  return {
    subscribers,
    views: stats.views ?? 0,
    videos: stats.videos ?? 0,
    summary: t(subscribers >= 0 ? 'summaryStats' : 'summaryStatsHidden', language, {
      channel: channel.title,
      subscribers: formatNumber(Math.max(0, subscribers), language),
      views: formatNumber(stats.views ?? 0, language),
      videos: formatNumber(stats.videos ?? 0, language),
    }),
  };
}

export {
  TRIGGERS,
  SCENE_ACTIONS,
  KINDS,
  QUOTA_SOURCES,
  NEW_VIDEO_MAX_AGE_MS,
  milestoneOf,
  kindOf,
  videoSummary,
  newVideoData,
  liveStartedData,
  milestoneData,
  keyRefusedData,
  quotaData,
  latestVideoOutputs,
  statsOutputs,
};
