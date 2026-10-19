// -----------------------------------------------------------------------------
// Dashboard widgets of the YouTube integration.
//
//   - `latest_videos`  the latest uploads of the followed channels, newest
//                      first (8 at most): thumbnail, title, channel and date,
//                      a badge (LIVE, scheduled, Short or the duration), the
//                      link to the video, and a "Check now" button (the RSS
//                      feeds, free); settings: which channels (empty: all),
//                      Shorts shown or not;
//   - `channel`        one channel: thumbnail of its latest video,
//                      subscribers, views and videos, the latest video, its
//                      date and the live state, and a "Refresh" button;
//   - `quota`          the units spent today against the daily budget, the
//                      next reset (midnight Pacific Time), what the channels
//                      plan a day, and whether Google accepts the key.
// Every text exists in the four languages (the content is cached per
// language). Content budget of a card: 8 components, 1 main one, 6 tiles,
// 2 texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, ago, formatNumber, formatCompact, formatDate, formatDuration } from './i18n.js';
import { videoUrl } from './youtube-api.js';
import { imageKeyOf } from './images.js';
import { latestOf } from './device.js';

const WIDGETS = { LATEST_VIDEOS: 'latest_videos', CHANNEL: 'channel', QUOTA: 'quota' };
const WIDGET_ACTIONS = { REFRESH: 'refresh' };
// The rows of a card-list in list display.
const MAX_ITEMS = 8;
const TTL = 300;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
const messageContent = (message, ttl = TTL) => ({
  ttl_seconds: ttl,
  components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
});

/**
 * @description The badge of a video.
 * @param {object} video - The video.
 * @param {string} language - The language.
 * @returns {{ text: string, color: string }} The badge.
 */
function badgeOf(video, language) {
  if (video.live === 'live') return { text: clip(t('badgeLive', language), 16), color: 'danger' };
  if (video.live === 'upcoming') {
    return { text: clip(t('badgeUpcoming', language), 16), color: 'warning' };
  }
  if (video.short) return { text: clip(t('badgeShort', language), 16), color: 'info' };
  if (video.duration) return { text: clip(formatDuration(video.duration), 16), color: 'primary' };
  return { text: clip(t('badgeVideo', language), 16), color: 'primary' };
}

/**
 * @description The "Check now" button of a list of channels.
 * @param {string[]} ids - The channel ids.
 * @param {string} labelKey - The TEXTS key of its label.
 * @param {string} language - The language.
 * @returns {object} The button.
 */
const refreshButton = (ids, labelKey, language) => ({
  type: 'button',
  label: clip(t(labelKey, language), 24),
  icon: 'refresh-cw',
  style: 'secondary',
  action: { key: WIDGET_ACTIONS.REFRESH, params: { channels: ids.slice(0, 50) } },
});

/**
 * @description The "latest_videos" widget.
 * @param {object} options - Options.
 * @param {object[]} options.channels - The channels, with `{ channel, state }`.
 * @param {boolean} [options.shorts] - Show the Shorts.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {string} options.language - The language.
 * @param {string} options.timezone - The timezone of the dates.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildLatestVideosWidget({ channels, shorts = true, hasKey, language, timezone, now }) {
  if (!hasKey) return messageContent(t('widgetNoKey', language));
  if (channels.length === 0) return messageContent(t('widgetEmpty', language));
  const videos = channels
    .flatMap(({ channel, state }) => (state?.videos ?? []).map((video) => ({ channel, video })))
    .filter(({ video }) => shorts || !video.short)
    .sort((a, b) => {
      // A live now first, then the newest.
      const live = Number(b.video.live === 'live') - Number(a.video.live === 'live');
      return live || Date.parse(b.video.published ?? 0) - Date.parse(a.video.published ?? 0);
    })
    .slice(0, MAX_ITEMS);
  const ids = channels.map(({ channel }) => channel.id);
  const checked = Math.max(0, ...channels.map(({ state }) => state?.feedAt ?? 0));
  if (videos.length === 0) {
    return {
      ttl_seconds: TTL,
      components: [
        { type: 'text', variant: 'body', text: clip(t('widgetNoVideo', language), 300) },
        refreshButton(ids, 'buttonCheck', language),
      ],
    };
  }
  return {
    ttl_seconds: TTL,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('videosCaption', language, { checked: ago(checked, now, language) }), 80),
      },
      {
        type: 'card-list',
        display: 'list',
        items: videos.map(({ channel, video }) => {
          const when =
            video.live === 'upcoming' && video.scheduled
              ? t('scheduledFor', language, {
                  date: formatDate(video.scheduled, language, timezone),
                })
              : formatDate(video.published, language, timezone);
          const details = [
            channel.title,
            `${t('statusPublished', language)}: ${formatDate(video.published, language, timezone)}`,
          ];
          if (video.duration) {
            details.push(`${t('statusDuration', language)}: ${formatDuration(video.duration)}`);
          }
          if (video.live === 'upcoming' && video.scheduled) {
            details.push(
              t('scheduledFor', language, {
                date: formatDate(video.scheduled, language, timezone),
              }),
            );
          }
          const image = imageKeyOf(video.id);
          return {
            title: clip(video.title || video.id, 60),
            subtitle: clip(`${channel.title} · ${when}`, 60),
            ...(image ? { image } : {}),
            badge: badgeOf(video, language),
            description: clip(details.join('\n'), 2000),
            links: [{ url: videoUrl(video.id, video.short), label: 'YouTube' }],
          };
        }),
      },
      refreshButton(ids, 'buttonCheck', language),
    ],
  };
}

/**
 * @description The live state of a channel, as a status row.
 * @param {object[]} videos - Its uploads.
 * @param {string} language - The language.
 * @param {string} timezone - The timezone.
 * @returns {{ value: string, color: string }} The row value.
 */
function liveRow(videos, language, timezone) {
  const live = videos.find((video) => video.live === 'live');
  if (live) return { value: clip(live.title, 40), color: 'danger' };
  const next = videos
    .filter((video) => video.live === 'upcoming' && video.scheduled)
    .sort((a, b) => Date.parse(a.scheduled) - Date.parse(b.scheduled))[0];
  if (next) {
    return {
      value: clip(
        t('scheduledFor', language, { date: formatDate(next.scheduled, language, timezone) }),
        40,
      ),
      color: 'warning',
    };
  }
  return { value: t('liveNone', language), color: 'neutral' };
}

/**
 * @description The "channel" widget of one channel.
 * @param {object} options - Options.
 * @param {object|null} options.channel - The channel (null: not chosen or removed).
 * @param {object|null} options.state - Its state (state.js).
 * @param {boolean} [options.chosen] - Whether a channel is chosen in the settings.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {string} options.language - The language.
 * @param {string} options.timezone - The timezone of the dates.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildChannelWidget({ channel, state, chosen = true, hasKey, language, timezone, now }) {
  if (!hasKey) return messageContent(t('widgetNoKey', language));
  if (!channel) {
    return messageContent(t(chosen ? 'widgetUnknownChannel' : 'widgetChooseChannel', language));
  }
  const stats = state?.stats ?? null;
  const videos = state?.videos ?? [];
  const latest = latestOf(videos);
  const components = [
    { type: 'text', variant: 'heading', text: clip(channel.title, 40) },
    {
      type: 'text',
      variant: 'caption',
      text: clip(
        [channel.handle, stats ? t('updated', language, { ago: ago(stats.at, now, language) }) : '']
          .filter(Boolean)
          .join(' · ') || channel.id,
        80,
      ),
    },
  ];
  const image = latest ? imageKeyOf(latest.id) : null;
  if (image) {
    components.push({ type: 'image', key: image, alt: clip(latest.title, 120), fit: 'cover' });
  }
  if (stats) {
    if (stats.subscribers !== null) {
      components.push({
        type: 'value',
        value: formatCompact(stats.subscribers, language),
        label: clip(t('tileSubscribers', language), 24),
        icon: 'users',
      });
    }
    components.push(
      {
        type: 'value',
        value: formatCompact(stats.views ?? 0, language),
        label: clip(t('tileViews', language), 24),
        icon: 'eye',
      },
      {
        type: 'value',
        value: formatNumber(stats.videos ?? 0, language),
        label: clip(t('tileVideos', language), 24),
        icon: 'film',
      },
    );
  }
  const live = liveRow(videos, language, timezone);
  const items = [
    {
      label: t('statusLatest', language),
      value: clip(latest ? latest.title || latest.id : t('noVideo', language), 40),
      color: 'neutral',
    },
    {
      label: t('statusPublished', language),
      value: clip(latest?.published ? formatDate(latest.published, language, timezone) : '—', 40),
      color: 'neutral',
    },
    { label: t('statusLive', language), ...live },
  ];
  if (stats && stats.subscribers === null) {
    items.push({
      label: t('tileSubscribers', language),
      value: t('hiddenCount', language),
      color: 'neutral',
    });
  }
  if (state?.feedError) {
    items.push({
      label: t('statusError', language),
      value: clip(state.feedError, 40),
      color: 'warning',
    });
  }
  components.push({ type: 'status', items });
  components.push(refreshButton([channel.id], 'buttonRefresh', language));
  return { ttl_seconds: TTL, components };
}

/**
 * @description The "quota" widget.
 * @param {object} options - Options.
 * @param {number} options.used - Units spent today.
 * @param {number} options.budget - The daily budget.
 * @param {number} options.planned - Units a day the channels plan.
 * @param {number} options.channels - Followed channels.
 * @param {number} options.resetAt - Next reset, in ms.
 * @param {string} options.keyState - missing, unknown, ok, refused or paused.
 * @param {string} options.language - The language.
 * @param {string} options.timezone - The timezone of the reset time.
 * @returns {object} The content.
 */
function buildQuotaWidget({
  used,
  budget,
  planned,
  channels,
  resetAt,
  keyState,
  language,
  timezone,
}) {
  const keyColors = {
    ok: 'success',
    unknown: 'neutral',
    refused: 'danger',
    missing: 'warning',
    paused: 'warning',
  };
  const keyTexts = {
    ok: 'quotaKeyOk',
    unknown: 'quotaKeyUnknown',
    refused: 'quotaKeyRefused',
    missing: 'quotaKeyMissing',
    paused: 'quotaPaused',
  };
  return {
    ttl_seconds: TTL,
    components: [
      { type: 'text', variant: 'heading', text: clip(t('quotaHeading', language), 40) },
      {
        type: 'text',
        variant: 'caption',
        text: clip(
          t('quotaCaption', language, {
            reset: formatDate(new Date(resetAt).toISOString(), language, timezone),
          }),
          80,
        ),
      },
      {
        type: 'gauge',
        value: Math.min(used, budget),
        min: 0,
        max: budget,
        label: clip(t('gaugeLabel', language), 24),
        color: used >= budget ? 'danger' : used >= budget * 0.8 ? 'warning' : 'success',
      },
      {
        type: 'value',
        value: planned,
        label: clip(t('tilePlanned', language), 24),
        icon: 'calendar',
      },
      {
        type: 'value',
        value: channels,
        label: clip(t('tileChannels', language), 24),
        icon: 'tv',
      },
      {
        type: 'status',
        items: [
          {
            label: t('quotaKey', language),
            value: clip(t(keyTexts[keyState] ?? 'quotaKeyUnknown', language), 40),
            color: keyColors[keyState] ?? 'warning',
          },
          {
            label: t('quotaUsed', language),
            value: clip(
              t('quotaUsedValue', language, {
                used: formatNumber(used, language),
                budget: formatNumber(budget, language),
              }),
              40,
            ),
            color: 'neutral',
          },
        ],
      },
    ],
  };
}

export {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL,
  MAX_ITEMS,
  clip,
  messageContent,
  badgeOf,
  buildLatestVideosWidget,
  buildChannelWidget,
  buildQuotaWidget,
};
