// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases; the image keys and the
// thumbnails through validateWidgetImage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';

import {
  buildLatestVideosWidget,
  buildChannelWidget,
  buildQuotaWidget,
  badgeOf,
  MAX_ITEMS,
} from '../src/widgets.js';
import { imageKeyOf, videoIdOfKey } from '../src/images.js';
import { LANGUAGES } from '../src/i18n.js';
import { DEV, MUSIC } from './helpers/fixtures.js';

const NOW = Date.parse('2026-10-20T07:30:00Z');
const TZ = 'Europe/Paris';
const types = (content) => content.components.map((component) => component.type);

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(count(['button']) <= 4, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'status') {
      component.items.forEach((item) => assert.ok(item.value, `${label}: status without value`));
    }
  }
}

const video = (id, values = {}) => ({
  id,
  title: `Video ${id}`,
  published: '2026-10-19T16:00:00Z',
  short: false,
  duration: 725,
  live: 'none',
  detailed: true,
  ...values,
});
const DEV_STATE = {
  stats: { subscribers: 2490000, hidden: false, views: 6510000000, videos: 6789, at: NOW - 60000 },
  videos: [
    video('upcomingAAA', { live: 'upcoming', scheduled: '2026-10-21T17:00:00Z', duration: 0 }),
    video('LJ2v4-FvPcA', { short: true, duration: 42, published: '2026-10-19T21:00:00Z' }),
    ...Array.from({ length: 10 }, (_, i) => video(`old${String(i).padStart(8, '0')}`)),
  ],
  feedAt: NOW - 120000,
  feedError: null,
};
const MUSIC_STATE = {
  stats: { subscribers: null, hidden: true, views: 10, videos: 1, at: NOW },
  videos: [video('liveBBBBBBB', { live: 'live', published: '2026-10-18T10:00:00Z' })],
  feedAt: NOW,
  feedError: 'RSS feed 404',
};

test('latest videos: valid in every language, the live first, thumbnails, links, badges', () => {
  for (const language of LANGUAGES) {
    const content = buildLatestVideosWidget({
      channels: [
        { channel: DEV, state: DEV_STATE },
        { channel: MUSIC, state: MUSIC_STATE },
      ],
      hasKey: true,
      language,
      timezone: TZ,
      now: NOW,
    });
    assertValid(content, language);
    const list = content.components.find((c) => c.type === 'card-list');
    assert.equal(list.items.length, MAX_ITEMS);
    assert.equal(list.items[0].badge.color, 'danger', 'the running live first');
    assert.equal(list.items[0].image, imageKeyOf('liveBBBBBBB'));
    assert.ok(list.items.every((item) => /^https:\/\/www\.youtube\.com\//.test(item.links[0].url)));
    assert.equal(content.components.at(-1).action.key, 'refresh');
    assert.deepEqual(content.components.at(-1).action.params.channels, [DEV.id, MUSIC.id]);
  }
  const noShorts = buildLatestVideosWidget({
    channels: [{ channel: DEV, state: DEV_STATE }],
    shorts: false,
    hasKey: true,
    language: 'en',
    timezone: TZ,
    now: NOW,
  });
  const items = noShorts.components.find((c) => c.type === 'card-list').items;
  assert.ok(items.every((item) => item.badge.text !== 'Short'));
});

test('latest videos: no key, no channel, no video yet', () => {
  const base = { language: 'fr', timezone: TZ, now: NOW };
  assertValid(buildLatestVideosWidget({ ...base, channels: [], hasKey: false }), 'no key');
  assertValid(buildLatestVideosWidget({ ...base, channels: [], hasKey: true }), 'empty');
  const none = buildLatestVideosWidget({
    ...base,
    channels: [{ channel: DEV, state: null }],
    hasKey: true,
  });
  assertValid(none, 'no video');
  assert.deepEqual(types(none), ['text', 'button']);
});

test('badges: live, scheduled, Short, duration, at most 16 characters', () => {
  for (const language of LANGUAGES) {
    for (const v of [
      video('a', { live: 'live' }),
      video('b', { live: 'upcoming' }),
      video('c', { short: true }),
      video('d', { duration: 36000 }),
      video('e', { duration: 0 }),
    ]) {
      assert.ok(badgeOf(v, language).text.length <= 16, `${language} ${v.id}`);
    }
  }
  assert.equal(badgeOf(video('d'), 'en').text, '12:05');
});

test('channel widget: thumbnail, tiles, status, refresh; hidden subscribers; edge cases', () => {
  for (const language of LANGUAGES) {
    const content = buildChannelWidget({
      channel: DEV,
      state: DEV_STATE,
      hasKey: true,
      language,
      timezone: TZ,
      now: NOW,
    });
    assertValid(content, language);
    assert.deepEqual(types(content), [
      'text',
      'text',
      'image',
      'value',
      'value',
      'value',
      'status',
      'button',
    ]);
    assert.equal(content.components[2].key, imageKeyOf('LJ2v4-FvPcA'), 'not the scheduled live');
  }
  const hidden = buildChannelWidget({
    channel: MUSIC,
    state: MUSIC_STATE,
    hasKey: true,
    language: 'en',
    timezone: TZ,
    now: NOW,
  });
  assertValid(hidden, 'hidden');
  assert.equal(types(hidden).filter((type) => type === 'value').length, 2);
  const status = hidden.components.find((c) => c.type === 'status').items;
  assert.ok(status.some((item) => item.value === 'hidden by the channel'));
  assert.ok(
    status.some((item) => item.color === 'danger'),
    'live now',
  );
  const base = { hasKey: true, language: 'de', timezone: TZ, now: NOW };
  assertValid(buildChannelWidget({ ...base, channel: null, chosen: false }), 'not chosen');
  assertValid(buildChannelWidget({ ...base, channel: null }), 'removed');
  assertValid(buildChannelWidget({ ...base, channel: DEV, state: null }), 'nothing read yet');
  assertValid(buildChannelWidget({ ...base, channel: DEV, hasKey: false }), 'no key');
});

test('quota widget: gauge colors, key states, every language', () => {
  for (const language of LANGUAGES) {
    for (const [used, keyState] of [
      [0, 'unknown'],
      [8000, 'ok'],
      [9000, 'paused'],
      [12, 'refused'],
      [0, 'missing'],
    ]) {
      const content = buildQuotaWidget({
        used,
        budget: 9000,
        planned: 34,
        channels: 10,
        resetAt: Date.parse('2026-10-20T07:00:00Z'),
        keyState,
        language,
        timezone: TZ,
      });
      assertValid(content, `${language} ${keyState}`);
    }
  }
});

test('image keys carry the video id and nothing else; a thumbnail passes the core checks', () => {
  for (const id of ['dQw4w9WgXcQ', 'LJ2v4-FvPcA', '-nmcYcO-EE8', '_x_y_z_1234']) {
    const key = imageKeyOf(id);
    assert.match(key, /^[a-z0-9][a-z0-9-]{0,63}$/);
    assert.equal(videoIdOfKey(key), id);
  }
  assert.equal(imageKeyOf('../etc/pass'), null);
  assert.equal(videoIdOfKey('yt-zz'), null);
  assert.equal(videoIdOfKey('lf-0123'), null);
  // A 320 × 180 JPEG, the size of the mqdefault thumbnails of YouTube.
  const jpeg = readFileSync(new URL('./fixtures/thumbnail.jpg', import.meta.url));
  assert.deepEqual(validateWidgetImage(jpeg.toString('base64')), []);
});
