// -----------------------------------------------------------------------------
// One device per followed channel, offered on the Discovery screen, named
// after the channel.
//
// Features (category / type pairs of the SDK constants, with an icon and a
// label in the Gladys front):
//   - subscribers       counter-sensor / integer: subscribers (YouTube rounds
//                       the public count down to three significant figures;
//                       no state when the owner hides it)
//   - views             counter-sensor / integer: views of all the videos
//   - videos            counter-sensor / integer: public videos
//   - latest_video      text / text: title of the latest upload (a Short or a
//                       finished live included, a scheduled live excluded)
//   - latest_published  text / text: its publication date, written in the
//                       language of the integration and the timezone of Gladys
//
// No binary "live" feature: Gladys has no category for it (a switch would be
// a command, a presence sensor a lie); a live start is a scene trigger and a
// badge of the widgets.
//
// External ids: `channel:<UC…>`, the channel id: never its title nor its
// handle. The readings come from the integration's own timer (minutes
// apart): `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { t, formatDate } from './i18n.js';

const DEVICE_TYPE = 'channel';
// Far beyond the largest channel (hundreds of billions of views).
const MAX_COUNT = 10 ** 13;

const counter = {
  category: CATEGORIES.COUNTER_SENSOR,
  type: TYPES.SENSOR.INTEGER,
  min: 0,
  max: MAX_COUNT,
  read_only: true,
  has_feedback: false,
  keep_history: true,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  read_only: true,
  has_feedback: false,
  keep_history: false,
};

/**
 * @description The latest upload that is not a scheduled live.
 * @param {object[]} videos - The uploads, newest first.
 * @returns {object|null} The video.
 */
const latestOf = (videos) => (videos ?? []).find((video) => video.live !== 'upcoming') ?? null;

const FEATURES = [
  {
    key: 'subscribers',
    name: 'featureSubscribers',
    shape: counter,
    state: ({ stats }) => stats?.subscribers ?? null,
  },
  {
    key: 'views',
    name: 'featureViews',
    shape: counter,
    state: ({ stats }) => stats?.views ?? null,
  },
  {
    key: 'videos',
    name: 'featureVideos',
    shape: counter,
    state: ({ stats }) => stats?.videos ?? null,
  },
  {
    key: 'latest_video',
    name: 'featureLatestVideo',
    shape: text,
    state: ({ videos }) => {
      const latest = latestOf(videos);
      return latest ? { text: latest.title || latest.id } : null;
    },
  },
  {
    key: 'latest_published',
    name: 'featureLatestPublished',
    shape: text,
    state: ({ videos }, { language, timezone }) => {
      const latest = latestOf(videos);
      return latest?.published ? { text: formatDate(latest.published, language, timezone) } : null;
    },
  },
];

/**
 * @description The external ids of a channel.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The channel id.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, id) => gladys.externalIds(DEVICE_TYPE, id);

/**
 * @description The channel id of a device external id.
 * @param {string} externalId - `ext:<selector>:channel:<UC…>`.
 * @returns {string|null} The channel id.
 */
function idFromExternalId(externalId) {
  const match = /:channel:(UC[\w-]{22})$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The device of a channel.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} channel - The channel `{ id, title, handle }`.
 * @param {string} [language] - Language of the feature names.
 * @returns {object} The discovered device.
 * @example
 * buildDevice(gladys, channel, 'fr');
 */
function buildDevice(gladys, channel, language = 'en') {
  const ids = idsOf(gladys, channel.id);
  return {
    name: channel.title,
    external_id: ids.device,
    model: 'YouTube',
    should_poll: false,
    params: [
      // Shown as is under "Technical parameters"; nothing reads them back.
      { name: 'CHANNEL_ID', value: channel.id },
      { name: 'HANDLE', value: channel.handle || '—' },
      { name: 'URL', value: `https://www.youtube.com/channel/${channel.id}` },
    ],
    features: FEATURES.map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a channel (only the known values).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} channel - The channel.
 * @param {object|null} data - Its state (state.js): `{ stats, videos }`.
 * @param {object} options - Options.
 * @param {string} options.language - Language of the date.
 * @param {string} options.timezone - Timezone of the date.
 * @returns {object[]} The states.
 */
function buildStates(gladys, channel, data, { language, timezone }) {
  if (!data) return [];
  const ids = idsOf(gladys, channel.id);
  return FEATURES.flatMap((spec) => {
    const value = spec.state(data, { language, timezone });
    if (value === null || value === undefined) return [];
    const id = ids.feature(spec.key);
    return typeof value === 'object'
      ? [{ device_feature_external_id: id, text: value.text.slice(0, 200) }]
      : [{ device_feature_external_id: id, state: value }];
  });
}

export {
  DEVICE_TYPE,
  FEATURES,
  MAX_COUNT,
  latestOf,
  idsOf,
  idFromExternalId,
  buildDevice,
  buildStates,
};
