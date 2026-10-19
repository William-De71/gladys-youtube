// The integration end to end, against the fake Gladys of the SDK and a fake
// YouTube (Data API, RSS feeds, Shorts check, thumbnails): the configuration
// buttons, the Discovery list, the clock (feeds, details, lives, statistics,
// restart), the errors (refused key, quota, budget, feed down), the scene
// triggers and actions, the widgets, their buttons and their images.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { createApp, ACTIONS } from '../src/app.js';
import { TRIGGERS } from '../src/events.js';
import { imageKeyOf } from '../src/images.js';
import {
  DEV,
  MUSIC,
  dataPaths,
  fakeYouTube,
  videoItem,
  channelItem,
  keyError,
  quotaError,
  silent,
} from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const outputsOf = (key) =>
  manifest.scene_actions
    .find((a) => a.key === key)
    .outputs.map((o) => o.key)
    .sort();
const variablesOf = (key) =>
  manifest.scene_triggers
    .find((t) => t.key === key)
    .variables.map((v) => v.key)
    .sort();
// The trigger fields are compared with the event data: they must be in it;
// those that are not variables too (the device of the channel) are left out.
const fieldsOf = (key) => {
  const trigger = manifest.scene_triggers.find((t) => t.key === key);
  return (trigger.fields ?? [])
    .map((f) => f.key)
    .filter((field) => !trigger.variables.some((v) => v.key === field));
};

/**
 * @description A started integration on a controllable clock.
 * @param {object} [options] - Options.
 * @returns {Promise<object>} `{ gladys, app, clock, fetchImpl, paths }`.
 */
async function start({
  at = '2026-10-20T08:00:00Z',
  config = {},
  paths = dataPaths(),
  fetchImpl = fakeYouTube(),
  gladys = createFakeGladys({ config: { language: 'en', api_key: 'AIzaTEST', ...config } }),
} = {}) {
  const clock = { now: new Date(at) };
  const app = createApp(gladys, {
    now: () => clock.now,
    timezone: 'Europe/Paris',
    fetchImpl,
    statePath: paths.state,
    usagePath: paths.usage,
    sleep: async () => {},
    tickMs: 0,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, clock, fetchImpl, paths };
}

const ok = (ack) => {
  assert.equal(ack.success, true, ack.error);
  return ack.data.message ?? ack.data.content ?? ack.data.outputs ?? ack.data.image;
};
const later = (clock, minutes) => {
  clock.now = new Date(clock.now.getTime() + minutes * 60000);
};
const create = async (gladys) => {
  for (const device of gladys.fake.discoveredDevices) await gladys.fake.deviceCreated(device);
};
const last = (gladys, channel, key) =>
  gladys.fake.lastState(`ext:test-integration:channel:${channel.id}:${key}`);
const events = (gladys, key) => gladys.fake.sceneEvents.filter((e) => e.key === key);
const apiCalls = (fetchImpl) =>
  fetchImpl.calls.filter((c) => c.url.hostname === 'www.googleapis.com');
const deviceOf = (channel) => `ext:test-integration:channel:${channel.id}`;

test('no key: the status says what to do, and nothing goes out', async () => {
  const { gladys, app, fetchImpl } = await start({ config: { api_key: '' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /clé d’API Google Cloud/);
  const refused = await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' });
  assert.equal(refused.success, false);
  await app.tick();
  assert.equal(fetchImpl.calls.length, 0);
  const widget = ok(await gladys.fake.widgetGet('latest_videos', { language: 'en' }));
  assert.match(widget.components[0].text, /API key/);
});

test('add a channel: resolved, stored in Gladys, its past uploads read once, no event', async () => {
  const { gladys, app, fetchImpl } = await start();
  assert.match(gladys.fake.connectionStatus.message.en, /No channel yet/);
  const message = ok(
    await gladys.fake.action(ACTIONS.ADD, { channel: 'https://www.youtube.com/@GoogleDevelopers' }),
  );
  assert.match(
    message.en,
    /^Added: #1 Google for Developers @googledevelopers \(UC_x5XG1OV2P6uZZ5FSM9Ttw\): 2,490,000 subscribers; latest video: “Builders & Gemini”/,
  );
  assert.match(message.fr, /Ouvrez maintenant l’onglet Découverte/);
  assert.deepEqual(
    gladys.fake.config.channels.map((c) => c.id),
    [DEV.id],
  );
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.name),
    ['Google for Developers'],
  );
  // channels.list (forHandle) + videos.list of the two uploads: 2 units.
  assert.equal(apiCalls(fetchImpl).length, 2);
  assert.equal(app.usage.used(), 2);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the past is never announced');
  assert.equal(gladys.fake.states.length, 0, 'no device yet');
  await create(gladys);
  assert.equal(last(gladys, DEV, 'subscribers'), 2490000);
  assert.equal(last(gladys, DEV, 'videos'), 6789);
  assert.equal(last(gladys, DEV, 'latest_video'), 'Builders & Gemini');
  assert.match(gladys.fake.connectionStatus.message.en, /1 channel\(s\)\. Today: 2 \/ 9,000 units/);
  assert.deepEqual(gladys.fake.widgetRefreshes.includes('latest_videos'), true);
  // The same channel again: refreshed, not doubled.
  const again = ok(await gladys.fake.action(ACTIONS.ADD, { channel: DEV.id }));
  assert.match(again.en, /^Already followed/);
  assert.equal(gladys.fake.config.channels.length, 1);
  const bad = await gladys.fake.action(ACTIONS.ADD, { channel: 'https://example.com/x' });
  assert.match(bad.error, /Type an @handle/);
  const unknown = await gladys.fake.action(ACTIONS.ADD, { channel: '@nobody' });
  assert.match(unknown.error, /YouTube knows no channel for “@nobody”/);
});

test('the clock: a new video and a new Short are announced once, with every variable', async () => {
  const { gladys, app, clock, fetchImpl, paths } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  await create(gladys);
  const feed = fetchImpl.world.feeds.get(DEV.id);
  feed.unshift(
    { id: 'newShort123', title: 'A Short', published: '2026-10-20T07:58:00+00:00', short: true },
    { id: 'newVideo123', title: 'A video', published: '2026-10-20T07:50:00+00:00' },
    // Back in the feed after a deletion: too old to be news.
    { id: 'oldVideo123', title: 'Old', published: '2026-10-01T07:50:00+00:00' },
  );
  fetchImpl.world.videos.set(
    'newVideo123',
    videoItem('newVideo123', {
      title: 'A video',
      duration: 'PT1H2M3S',
      published: '2026-10-20T07:50:00Z',
    }),
  );
  later(clock, 5);
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.NEW_VIDEO).length, 0, 'not due yet (15 min)');
  later(clock, 10);
  await app.tick();
  const fired = events(gladys, TRIGGERS.NEW_VIDEO);
  assert.deepEqual(
    fired.map((e) => [e.data.video_id, e.data.kind]),
    [
      ['newShort123', 'short'],
      ['newVideo123', 'video'],
    ],
  );
  const data = fired[1].data;
  assert.deepEqual(
    Object.keys(data)
      .filter((key) => !fieldsOf(TRIGGERS.NEW_VIDEO).includes(key))
      .sort(),
    variablesOf(TRIGGERS.NEW_VIDEO),
  );
  assert.equal(data.channel, deviceOf(DEV));
  assert.equal(data.url, 'https://www.youtube.com/watch?v=newVideo123');
  assert.equal(data.duration_seconds, 3723);
  assert.equal(data.duration, '1:02:03');
  assert.equal(data.short, false);
  assert.equal(
    data.summary,
    'Google for Developers published a new video: A video (1:02:03). https://www.youtube.com/watch?v=newVideo123',
  );
  assert.equal(fired[0].data.url, 'https://www.youtube.com/shorts/newShort123');
  assert.equal(last(gladys, DEV, 'latest_video'), 'A Short');
  // Nothing twice, after a restart neither.
  later(clock, 15);
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.NEW_VIDEO).length, 2);
  app.stop();
  const restarted = await start({
    paths,
    fetchImpl,
    at: clock.now.toISOString(),
    gladys: createFakeGladys({ config: { ...gladys.fake.config } }),
  });
  later(restarted.clock, 30);
  await restarted.app.tick();
  assert.equal(events(restarted.gladys, TRIGGERS.NEW_VIDEO).length, 0);
});

test('lives: a scheduled live is not a new video; its start is announced once', async () => {
  const { gladys, app, clock, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  fetchImpl.world.feeds
    .get(DEV.id)
    .unshift({ id: 'liveLive123', title: 'Keynote', published: '2026-10-20T08:00:00+00:00' });
  fetchImpl.world.videos.set(
    'liveLive123',
    videoItem('liveLive123', {
      title: 'Keynote',
      live: 'upcoming',
      duration: 'P0D',
      scheduled: '2026-10-20T09:40:00Z',
    }),
  );
  later(clock, 15);
  await app.tick();
  assert.equal(gladys.fake.sceneEvents.length, 0);
  const widget = ok(await gladys.fake.widgetGet('latest_videos', { language: 'en' }));
  const items = widget.components.find((c) => c.type === 'card-list').items;
  assert.ok(items.some((item) => item.badge.text === 'Scheduled'));
  // Far from its start: not checked every 5 minutes.
  const before = app.usage.used();
  later(clock, 5);
  await app.tick();
  assert.equal(app.usage.used(), before);
  fetchImpl.world.videos.set(
    'liveLive123',
    videoItem('liveLive123', {
      title: 'Keynote',
      live: 'live',
      duration: 'P0D',
      scheduled: '2026-10-20T09:40:00Z',
      started: '2026-10-20T09:41:00Z',
    }),
  );
  later(clock, 60);
  await app.tick();
  later(clock, 5);
  await app.tick();
  const lives = events(gladys, TRIGGERS.LIVE_STARTED);
  assert.equal(lives.length, 1);
  assert.deepEqual(
    Object.keys(lives[0].data)
      .filter((key) => !fieldsOf(TRIGGERS.LIVE_STARTED).includes(key))
      .sort(),
    variablesOf(TRIGGERS.LIVE_STARTED),
  );
  assert.equal(lives[0].data.started_at, '2026-10-20T09:41:00Z');
  assert.equal(events(gladys, TRIGGERS.NEW_VIDEO).length, 0);
  later(clock, 30);
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.LIVE_STARTED).length, 1);
});

test('statistics: read every hour; a new subscriber milestone once, never after a dip', async () => {
  const { gladys, app, clock, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  await create(gladys);
  fetchImpl.world.channels.set(DEV.id, channelItem(DEV, { subscriberCount: '5010000' }));
  later(clock, 30);
  await app.tick();
  assert.equal(last(gladys, DEV, 'subscribers'), 2490000, 'not due yet');
  later(clock, 31);
  await app.tick();
  assert.equal(last(gladys, DEV, 'subscribers'), 5010000);
  const fired = events(gladys, TRIGGERS.SUBSCRIBER_MILESTONE);
  assert.deepEqual(
    fired.map((e) => [e.data.milestone, e.data.subscribers]),
    [[5000000, 5010000]],
  );
  assert.deepEqual(
    Object.keys(fired[0].data)
      .filter((key) => !fieldsOf(TRIGGERS.SUBSCRIBER_MILESTONE).includes(key))
      .sort(),
    variablesOf(TRIGGERS.SUBSCRIBER_MILESTONE),
  );
  assert.equal(fired[0].data.summary, 'Google for Developers reached 5,000,000 subscribers.');
  fetchImpl.world.channels.set(DEV.id, channelItem(DEV, { subscriberCount: '4990000' }));
  later(clock, 61);
  await app.tick();
  fetchImpl.world.channels.set(DEV.id, channelItem(DEV, { subscriberCount: '5020000' }));
  later(clock, 61);
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.SUBSCRIBER_MILESTONE).length, 1);
});

test('a feed down: the uploads playlist instead (1 unit), Shorts by the HEAD check', async () => {
  const { gladys, app, clock, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  fetchImpl.world.feedStatus = 404;
  fetchImpl.world.feeds
    .get(DEV.id)
    .unshift({ id: 'newShort123', title: 'A Short', published: '2026-10-20T08:10:00+00:00' });
  fetchImpl.world.shorts.add('newShort123');
  later(clock, 15);
  await app.tick();
  assert.ok(apiCalls(fetchImpl).some((c) => c.url.pathname.endsWith('/playlistItems')));
  const fired = events(gladys, TRIGGERS.NEW_VIDEO);
  assert.deepEqual(
    fired.map((e) => [e.data.video_id, e.data.short]),
    [['newShort123', true]],
  );
  // Over 80 % of the budget: no fallback, the error is kept for the list.
  await gladys.fake.configUpdated({ ...gladys.fake.config, daily_budget: 100 });
  app.usage.record(85);
  later(clock, 15);
  const calls = apiCalls(fetchImpl).length;
  await app.tick();
  assert.equal(apiCalls(fetchImpl).length, calls);
  const list = ok(await gladys.fake.action(ACTIONS.LIST));
  assert.match(list.en, /last error: RSS feed 404/);
});

test('a refused key: the status, one event, the hint, a retry an hour later', async () => {
  const fetchImpl = fakeYouTube();
  const { gladys, app, clock } = await start({ fetchImpl });
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  fetchImpl.world.apiError = keyError;
  const test = await gladys.fake.action(ACTIONS.TEST_KEY);
  assert.match(test.error, /Google refuses the API key \(API_KEY_INVALID\)\. Check the key/);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  await app.tick();
  later(clock, 61);
  await app.tick();
  const fired = events(gladys, TRIGGERS.API_KEY_REFUSED);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].data.reason, 'API_KEY_INVALID');
  assert.deepEqual(Object.keys(fired[0].data).sort(), variablesOf(TRIGGERS.API_KEY_REFUSED));
  fetchImpl.world.apiError = null;
  later(clock, 61);
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  const okMessage = ok(await gladys.fake.action(ACTIONS.TEST_KEY));
  assert.match(okMessage.en, /The key works/);
});

test('quota: Google refuses it (403 quotaExceeded) or the budget is spent: one event a day', async () => {
  const fetchImpl = fakeYouTube();
  const { gladys, app, clock } = await start({ fetchImpl });
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  fetchImpl.world.apiError = quotaError;
  later(clock, 61);
  await app.tick();
  const fired = events(gladys, TRIGGERS.QUOTA_EXHAUSTED);
  assert.deepEqual(
    fired.map((e) => e.data.source),
    ['google'],
  );
  assert.deepEqual(Object.keys(fired[0].data).sort(), variablesOf(TRIGGERS.QUOTA_EXHAUSTED));
  const calls = apiCalls(fetchImpl).length;
  later(clock, 61);
  await app.tick();
  assert.equal(apiCalls(fetchImpl).length, calls, 'paused until midnight Pacific Time');
  const quota = ok(await gladys.fake.widgetGet('quota', { language: 'fr' }));
  assert.deepEqual(validateWidgetContent(quota), []);
  // The next Pacific day: requests again, then the own budget runs out.
  fetchImpl.world.apiError = null;
  clock.now = new Date('2026-10-21T07:30:00Z');
  await gladys.fake.configUpdated({ ...gladys.fake.config, daily_budget: 100 });
  app.usage.record(100);
  await app.tick();
  assert.deepEqual(
    events(gladys, TRIGGERS.QUOTA_EXHAUSTED).map((e) => e.data.source),
    ['google', 'budget'],
  );
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.QUOTA_EXHAUSTED).length, 2);
});

test('scene actions: latest video (fresh feed, free) and statistics, declared outputs only', async () => {
  const { gladys, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  const latest = ok(
    await gladys.fake.sceneAction('latest_video', { channel: deviceOf(DEV), include_shorts: true }),
  );
  assert.deepEqual(Object.keys(latest).sort(), outputsOf('latest_video'));
  assert.deepEqual([latest.video_id, latest.short], ['LJ2v4-FvPcA', true]);
  const noShort = ok(
    await gladys.fake.sceneAction('latest_video', {
      channel: deviceOf(DEV),
      include_shorts: false,
    }),
  );
  assert.equal(noShort.video_id, 'i3X7Fv0Z3Uc');
  assert.equal(noShort.url, 'https://www.youtube.com/watch?v=i3X7Fv0Z3Uc');
  const stats = ok(await gladys.fake.sceneAction('channel_stats', { channel: deviceOf(DEV) }));
  assert.deepEqual(Object.keys(stats).sort(), outputsOf('channel_stats'));
  assert.equal(
    stats.summary,
    'Google for Developers: 2,490,000 subscribers, 6,510,000,000 views, 6,789 videos.',
  );
  const unknown = await gladys.fake.sceneAction('channel_stats', { channel: 'ext:x:channel:nope' });
  assert.equal(unknown.success, false);
  // A video found by an action is announced by the clock, never by the action.
  fetchImpl.world.feeds
    .get(DEV.id)
    .unshift({ id: 'newVideo123', title: 'Now', published: '2026-10-20T08:01:00+00:00' });
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('widgets: contents, thumbnail bytes, the check button (no event), then the clock announces', async () => {
  const { gladys, app, clock, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: MUSIC.id }));
  await create(gladys);
  for (const language of ['en', 'fr', 'de', 'es']) {
    const list = ok(
      await gladys.fake.widgetGet('latest_videos', {
        language,
        settings: { channels: [deviceOf(DEV)] },
      }),
    );
    assert.deepEqual(validateWidgetContent(list), [], language);
    const card = list.components.find((c) => c.type === 'card-list');
    assert.equal(card.items.length, 2, 'only the chosen channel');
    const channel = ok(
      await gladys.fake.widgetGet('channel', { language, settings: { channel: deviceOf(MUSIC) } }),
    );
    assert.deepEqual(validateWidgetContent(channel), [], language);
  }
  const image = ok(await gladys.fake.widgetGetImage(imageKeyOf('LJ2v4-FvPcA')));
  assert.deepEqual(validateWidgetImage(image), []);
  assert.ok(
    fetchImpl.calls.some((c) => c.url.href === 'https://i.ytimg.com/vi/LJ2v4-FvPcA/mqdefault.jpg'),
  );
  assert.equal((await gladys.fake.widgetGetImage('https://evil')).success, false);
  fetchImpl.world.feeds
    .get(DEV.id)
    .unshift({ id: 'newVideo123', title: 'Now', published: '2026-10-20T08:03:00+00:00' });
  later(clock, 2);
  const toast = ok(
    await gladys.fake.widgetAction('latest_videos', 'refresh', { channels: [DEV.id] }),
  );
  assert.equal(toast.en, 'Checked 1 channel(s): 1 new video(s).');
  assert.equal(gladys.fake.sceneEvents.length, 0, 'a button never fires a scene');
  const list = ok(await gladys.fake.widgetGet('latest_videos', { language: 'en' }));
  assert.equal(list.components.find((c) => c.type === 'card-list').items[0].title, 'Now');
  later(clock, 15);
  await app.tick();
  assert.deepEqual(
    events(gladys, TRIGGERS.NEW_VIDEO).map((e) => e.data.video_id),
    ['newVideo123'],
  );
  const one = ok(await gladys.fake.widgetAction('channel', 'refresh', { channels: [MUSIC.id] }));
  assert.match(one.fr, /^1 chaîne\(s\) vérifiée\(s\)/);
  const gone = ok(await gladys.fake.widgetAction('channel', 'refresh', { channels: ['UCnope'] }));
  assert.equal(gone.en, 'This channel is no longer followed.');
});

test('list and remove: numbers, units of the day; the device stays', async () => {
  const { gladys } = await start();
  assert.equal(ok(await gladys.fake.action(ACTIONS.LIST)).en, 'No channel yet.');
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: '@GoogleDevelopers' }));
  ok(await gladys.fake.action(ACTIONS.ADD, { channel: MUSIC.id }));
  const list = ok(await gladys.fake.action(ACTIONS.LIST));
  assert.match(list.en, /^2 channel\(s\)\. Today: 4 \/ 9,000 units, about 26 a day planned\./);
  assert.match(list.en, /\n#2 Music @music \(UC-9-kyTW8ZkZNDHQJ6FgpwQ\): 120,000,000 subscribers/);
  const removed = ok(await gladys.fake.action(ACTIONS.REMOVE, { channel: '@music' }));
  assert.match(removed.en, /^Removed: Music\./);
  assert.deepEqual(
    gladys.fake.config.channels.map((c) => c.id),
    [DEV.id],
  );
  const missing = await gladys.fake.action(ACTIONS.REMOVE, { channel: '#5' });
  assert.match(missing.error, /No followed channel matches “#5”/);
});
