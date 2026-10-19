import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  milestoneOf,
  newVideoData,
  liveStartedData,
  quotaData,
  statsOutputs,
  latestVideoOutputs,
} from '../src/events.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, DEV } from './helpers/fixtures.js';

test('subscriber milestones: 1, 2 and 5 times a power of ten, from 100', () => {
  const cases = [
    [null, null],
    [99, null],
    [100, 100],
    [199, 100],
    [200, 200],
    [499, 200],
    [500, 500],
    [999, 500],
    [1000, 1000],
    [2490000, 2000000],
    [5000000, 5000000],
    [120000000, 100000000],
  ];
  for (const [count, milestone] of cases) assert.equal(milestoneOf(count), milestone, `${count}`);
});

/**
 * @description Assert the data of a scene event respects the core limits.
 * @param {object} data - The data.
 */
function assertFlat(data) {
  assert.ok(Object.keys(data).length <= 30);
  for (const [key, value] of Object.entries(data)) {
    const scalar =
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.length <= 1000);
    assert.ok(scalar, key);
  }
}

test('event data: flat scalars, summaries in every language, bounded', () => {
  const long = 'x'.repeat(5000);
  const video = {
    id: 'LJ2v4-FvPcA',
    title: long,
    published: '2026-10-20T08:00:00Z',
    short: true,
    duration: 42,
    live: 'live',
    started: '2026-10-20T08:01:00Z',
  };
  for (const language of LANGUAGES) {
    assertFlat(newVideoData(fakeGladys, DEV, video, language));
    assertFlat(liveStartedData(fakeGladys, DEV, video, language));
    assertFlat(quotaData('google', 10, 9000, language));
  }
  const data = newVideoData(fakeGladys, DEV, { ...video, title: 'Hi' }, 'fr');
  assert.equal(
    data.summary,
    'Google for Developers a publié un nouveau Short : Hi (0:42). https://www.youtube.com/shorts/LJ2v4-FvPcA',
  );
  assert.equal(data.thumbnail, 'https://i.ytimg.com/vi/LJ2v4-FvPcA/mqdefault.jpg');
});

test('action outputs: scalars; hidden subscribers are -1', () => {
  const stats = statsOutputs(DEV, { subscribers: null, views: 10, videos: 2 }, 'de');
  assert.equal(stats.subscribers, -1);
  assert.match(stats.summary, /Abonnenten verborgen/);
  const latest = latestVideoOutputs(DEV, { id: 'i3X7Fv0Z3Uc', title: 'T', short: false }, 'en');
  assert.deepEqual([latest.duration_seconds, latest.published_at, latest.live], [0, '', 'none']);
});
