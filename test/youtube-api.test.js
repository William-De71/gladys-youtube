import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChannelInput,
  parseDuration,
  parseFeed,
  classifyError,
  readChannel,
  readVideo,
  createYouTube,
  ApiKeyError,
  QuotaError,
  BudgetExceededError,
  NotFoundError,
  YouTubeError,
} from '../src/youtube-api.js';
import { createUsage } from '../src/usage.js';
import {
  DEV,
  feedXml,
  channelItem,
  videoItem,
  keyError,
  quotaError,
  fakeYouTube,
  silent,
} from './helpers/fixtures.js';

test('what the user types: handles, URLs, ids, videos', () => {
  const cases = {
    '@GoogleDevelopers': { kind: 'handle', value: 'GoogleDevelopers' },
    GoogleDevelopers: { kind: 'handle', value: 'GoogleDevelopers' },
    'https://www.youtube.com/@GoogleDevelopers/videos': {
      kind: 'handle',
      value: 'GoogleDevelopers',
    },
    'youtube.com/@Théo.Nom-1': { kind: 'handle', value: 'Théo.Nom-1' },
    'm.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw': { kind: 'id', value: DEV.id },
    UC_x5XG1OV2P6uZZ5FSM9Ttw: { kind: 'id', value: DEV.id },
    'https://www.youtube.com/user/GoogleDevelopers': {
      kind: 'username',
      value: 'GoogleDevelopers',
    },
    'https://www.youtube.com/c/GoogleDevelopers': { kind: 'handle', value: 'GoogleDevelopers' },
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10': { kind: 'video', value: 'dQw4w9WgXcQ' },
    'https://youtu.be/dQw4w9WgXcQ?si=x': { kind: 'video', value: 'dQw4w9WgXcQ' },
    'https://www.youtube.com/shorts/LJ2v4-FvPcA': { kind: 'video', value: 'LJ2v4-FvPcA' },
    'https://www.youtube.com/live/LJ2v4-FvPcA': { kind: 'video', value: 'LJ2v4-FvPcA' },
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.deepEqual(parseChannelInput(input), expected, input);
  }
  for (const input of [
    '',
    '  ',
    '@a',
    'https://example.com/@x',
    'https://www.youtube.com/',
    'a b c',
    'www.example.com',
  ]) {
    assert.equal(parseChannelInput(input), null, input);
  }
});

test('ISO 8601 durations', () => {
  assert.equal(parseDuration('PT12M5S'), 725);
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('P1DT2H'), 93600);
  assert.equal(parseDuration('P0D'), 0);
  assert.equal(parseDuration('PT45S'), 45);
  assert.equal(parseDuration('nonsense'), 0);
});

test('the RSS feed: ids, titles decoded, Shorts by their link, newest first', () => {
  const xml = feedXml(DEV.id, [
    { id: 'i3X7Fv0Z3Uc', title: 'Old', published: '2026-10-15T19:00:22+00:00' },
    {
      id: 'LJ2v4-FvPcA',
      title: 'A &amp; B &#233; &quot;C&quot;',
      published: '2026-10-16T21:00:00+00:00',
      short: true,
    },
  ]);
  assert.deepEqual(parseFeed(xml), [
    {
      id: 'LJ2v4-FvPcA',
      title: 'A & B é "C"',
      published: '2026-10-16T21:00:00+00:00',
      short: true,
    },
    { id: 'i3X7Fv0Z3Uc', title: 'Old', published: '2026-10-15T19:00:22+00:00', short: false },
  ]);
  assert.throws(() => parseFeed('<html>error</html>'), YouTubeError);
});

test('errors: refused key (400 API_KEY_INVALID), quota (403 quotaExceeded), API disabled, other', () => {
  assert.ok(classifyError(keyError.status, keyError.body) instanceof ApiKeyError);
  assert.equal(classifyError(keyError.status, keyError.body).reason, 'API_KEY_INVALID');
  assert.ok(classifyError(quotaError.status, quotaError.body) instanceof QuotaError);
  const disabled = classifyError(403, {
    error: {
      status: 'PERMISSION_DENIED',
      message: 'YouTube Data API v3 has not been used in project 1 before or it is disabled.',
      details: [{ reason: 'SERVICE_DISABLED' }],
    },
  });
  assert.ok(disabled instanceof ApiKeyError);
  assert.equal(disabled.reason, 'SERVICE_DISABLED');
  assert.ok(classifyError(403, { error: { status: 'PERMISSION_DENIED' } }) instanceof ApiKeyError);
  assert.ok(classifyError(404, {}) instanceof NotFoundError);
  const other = classifyError(500, { error: { message: 'Backend Error' } });
  assert.ok(other instanceof YouTubeError && !(other instanceof ApiKeyError));
});

test('channel and video resources: counts as numbers, hidden subscribers, live state', () => {
  const channel = readChannel(channelItem(DEV));
  assert.deepEqual(
    [channel.subscribers, channel.views, channel.videos, channel.handle, channel.uploads],
    [2490000, 6510000000, 6789, '@googledevelopers', DEV.uploads],
  );
  const hidden = readChannel(
    channelItem(DEV, { hiddenSubscriberCount: true, subscriberCount: '0' }),
  );
  assert.deepEqual([hidden.hidden, hidden.subscribers], [true, null]);
  const live = readVideo(
    videoItem('LJ2v4-FvPcA', { live: 'live', duration: 'P0D', started: '2026-10-19T18:00:00Z' }),
  );
  assert.deepEqual([live.live, live.duration, live.started], ['live', 0, '2026-10-19T18:00:00Z']);
  assert.equal(readVideo(videoItem('x', { live: 'weird' })).live, 'none');
});

test('the client: key in a header (never in the URL), one unit per answer, the budget, the feed fallback', async () => {
  const fetchImpl = fakeYouTube();
  let budget = 3;
  const usage = createUsage({ path: null, getBudget: () => budget, logger: silent });
  const youtube = createYouTube({
    getApiKey: () => 'AIzaSECRET',
    usage,
    fetchImpl,
    logger: silent,
  });
  const resolved = await youtube.resolve({ kind: 'handle', value: 'GoogleDevelopers' });
  assert.equal(resolved.id, DEV.id);
  const call = fetchImpl.calls.at(-1);
  assert.equal(call.url.searchParams.get('forHandle'), '@GoogleDevelopers');
  assert.equal(call.headers['X-Goog-Api-Key'], 'AIzaSECRET');
  assert.doesNotMatch(call.url.href, /AIzaSECRET|key=/);
  assert.equal(usage.used(), 1);
  // A video URL: the video, then its channel (2 units).
  assert.equal((await youtube.resolve({ kind: 'video', value: 'dQw4w9WgXcQ' })).id, DEV.id);
  assert.equal(usage.used(), 3);
  await assert.rejects(youtube.channels([DEV.id]), BudgetExceededError);
  assert.equal(fetchImpl.calls.length, 3, 'nothing goes out once the budget is spent');
  budget = 100;
  await assert.rejects(youtube.resolve({ kind: 'handle', value: 'nobody' }), NotFoundError);
  // An error costs a unit too.
  fetchImpl.world.apiError = keyError;
  await assert.rejects(youtube.channels([DEV.id]), ApiKeyError);
  assert.equal(usage.used(), 5);
  fetchImpl.world.apiError = null;
  const uploads = await youtube.uploads(DEV.uploads);
  assert.deepEqual(
    uploads.map((v) => [v.id, v.short]),
    [
      ['LJ2v4-FvPcA', null],
      ['i3X7Fv0Z3Uc', null],
    ],
  );
  fetchImpl.world.shorts.add('LJ2v4-FvPcA');
  assert.equal(await youtube.isShort('LJ2v4-FvPcA'), true);
  assert.equal(await youtube.isShort('i3X7Fv0Z3Uc'), false);
  const head = fetchImpl.calls.at(-1);
  assert.equal(head.method, 'HEAD');
  const free = usage.used();
  await youtube.feed(DEV.id);
  assert.equal(usage.used(), free, 'the RSS feed costs nothing');
  fetchImpl.world.feedStatus = 404;
  await assert.rejects(youtube.feed(DEV.id), /RSS feed 404/);
  const noKey = createYouTube({ getApiKey: () => '', usage, fetchImpl, logger: silent });
  await assert.rejects(noKey.channels([DEV.id]), ApiKeyError);
});

test('channels and videos are read 50 per request', async () => {
  const fetchImpl = fakeYouTube();
  const usage = createUsage({ path: null, getBudget: () => 1000, logger: silent });
  const youtube = createYouTube({ getApiKey: () => 'k', usage, fetchImpl, logger: silent });
  const ids = Array.from({ length: 120 }, (_, i) => `v${String(i).padStart(10, '0')}`);
  await youtube.videos(ids);
  assert.equal(usage.used(), 3);
  assert.equal(fetchImpl.calls[0].url.searchParams.get('id').split(',').length, 50);
});
