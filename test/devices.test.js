// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { buildDevice, buildStates, idFromExternalId, latestOf } from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, DEV, MUSIC } from './helpers/fixtures.js';

const devices = (language) =>
  [DEV, MUSIC].map((channel) => buildDevice(fakeGladys, channel, language));

// The pairs with an icon and a label in the front
// (front/src/config/i18n/*.json, deviceFeatureCategory: counter-sensor/integer
// "Compteur entier", text/text "Texte").
const PAIRS = [
  [CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER],
  [CATEGORIES.TEXT, TYPES.TEXT.TEXT],
];

const DATA = {
  stats: { subscribers: 2490000, hidden: false, views: 6510000000, videos: 6789, at: 1 },
  videos: [
    { id: 'upcomingAAA', title: 'Next live', published: '2026-10-20T10:00:00Z', live: 'upcoming' },
    { id: 'LJ2v4-FvPcA', title: 'Builders', published: '2026-10-16T21:00:00Z', live: 'none' },
  ],
};

test('devices are never polled by Gladys: the integration has its own clock', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name, feature.external_id);
      }
    }
  }
});

test('every category / type pair has an icon and a label in Gladys', () => {
  for (const device of devices('en')) {
    for (const feature of device.features) {
      assert.ok(
        PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
        `${feature.external_id}: ${feature.category} / ${feature.type}`,
      );
    }
  }
});

test('external ids come from the channel id, never its title nor its handle', () => {
  const device = buildDevice(fakeGladys, DEV, 'fr');
  assert.equal(device.external_id, `ext:test-integration:channel:${DEV.id}`);
  assert.equal(idFromExternalId(device.external_id), DEV.id);
  assert.equal(idFromExternalId('ext:x:channel:Google'), null);
  const renamed = buildDevice(fakeGladys, { ...DEV, title: 'Other', handle: '@other' }, 'fr');
  assert.deepEqual(
    renamed.features.map((f) => f.external_id),
    device.features.map((f) => f.external_id),
  );
  assert.equal(device.name, 'Google for Developers');
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['subscribers', 'views', 'videos', 'latest_video', 'latest_published'],
  );
  assert.equal(device.features[0].name, 'Abonnés');
});

test('states: counts, the latest video that is not a scheduled live, its date in the timezone', () => {
  assert.equal(latestOf(DATA.videos).id, 'LJ2v4-FvPcA');
  const states = buildStates(fakeGladys, DEV, DATA, { language: 'fr', timezone: 'Europe/Paris' });
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.equal(byKey.subscribers, 2490000);
  assert.equal(byKey.views, 6510000000);
  assert.equal(byKey.latest_video, 'Builders');
  assert.match(byKey.latest_published, /^16 oct\. 2026,? 23:00$/);
  const hidden = buildStates(
    fakeGladys,
    DEV,
    { stats: { ...DATA.stats, subscribers: null }, videos: [] },
    { language: 'en', timezone: 'UTC' },
  );
  assert.deepEqual(
    hidden.map((s) => s.device_feature_external_id.split(':').pop()),
    ['views', 'videos'],
    'no state for a hidden count nor a missing video',
  );
  assert.deepEqual(buildStates(fakeGladys, DEV, null, { language: 'en', timezone: 'UTC' }), []);
});

test('the whole Discovery batch is accepted by the fake Gladys', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  await gladys.publishDiscoveredDevices(devices('es'));
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  await gladys.disconnect?.();
});
