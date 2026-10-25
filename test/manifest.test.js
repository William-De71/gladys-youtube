import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS, SCENE_ACTIONS, KINDS, QUOTA_SOURCES } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { FEED_MINUTES, STATS_MINUTES, DAILY_BUDGET, AUTO_LANGUAGE } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const REPO = 'William-De71/gladys-youtube';

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'YouTube');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-youtube:${pkg.version}`);
  assert.equal(manifest.cover_image, `https://raw.githubusercontent.com/${REPO}/main/cover.jpg`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-youtube');
});

test('declares the cloud transport: YouTube only, never a local device', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  const api = source('../src/youtube-api.js');
  assert.match(api, /https:\/\/www\.googleapis\.com\/youtube\/v3/);
  assert.match(api, /https:\/\/www\.youtube\.com\/feeds\/videos\.xml/);
  // search.list costs 100 units: never used.
  assert.doesNotMatch(api, /get\('search'/);
  for (const file of [
    'app',
    'channels',
    'events',
    'widgets',
    'device',
    'state',
    'usage',
    'images',
    'config',
  ]) {
    assert.doesNotMatch(
      source(`../src/${file}.js`),
      /fetch\(|node:https?|node:net|node:dgram/,
      file,
    );
  }
  // A single channel: no transport to publish per device.
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
});

test('requires Gladys 5.3.0 (catalog keywords); no widget form, no extra permission', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.doesNotMatch(source('../src/widgets.js'), /fields:/, 'a button form would need 5.2.0');
  assert.deepEqual(manifest.categories, ['multimedia', 'services']);
  for (const key of ['location', 'network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(JSON.stringify(manifest), /"source":"houses"/);
  const key = byKey(manifest.config_schema).get('api_key');
  assert.deepEqual([key.type, key.required], ['secret', true]);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  const app = source('../src/app.js');
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key),
    Object.values(TRIGGERS),
  );
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    Object.values(WIDGETS),
  );
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of ['LATEST_VIDEOS', 'CHANNEL']) {
    assert.match(app, new RegExp(`onWidgetAction\\(WIDGETS\\.${key}`), key);
  }
  assert.match(app, /onWidgetGetImage\(/);
  assert.deepEqual(Object.values(WIDGET_ACTIONS), ['refresh']);
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
  // The trigger fields are keys of the event data (the core compares them).
  const triggers = byKey(manifest.scene_triggers);
  assert.deepEqual(
    triggers.get('new_video').fields.map((f) => f.key),
    ['channel', 'kind'],
  );
  assert.deepEqual(values(triggers.get('new_video').fields[1]), Object.values(KINDS));
  assert.deepEqual(values(triggers.get('quota_exhausted').fields[0]), Object.values(QUOTA_SOURCES));
  for (const key of ['live_started', 'subscriber_milestone']) {
    assert.deepEqual(
      triggers.get(key).fields.map((f) => [f.key, f.source]),
      [['channel', 'devices']],
    );
  }
});

test('mirrors the bounds and values of the code', () => {
  const config = byKey(manifest.config_schema);
  for (const bound of ['min', 'max', 'default']) {
    assert.equal(config.get('feed_minutes')[bound], FEED_MINUTES[bound]);
    assert.equal(config.get('stats_minutes')[bound], STATS_MINUTES[bound]);
    assert.equal(config.get('daily_budget')[bound], DAILY_BUDGET[bound]);
  }
  // Number fields are rounded by Gladys: whole bounds only.
  for (const field of manifest.config_schema.filter((f) => f.type === 'number')) {
    assert.ok(Number.isInteger(field.min) && Number.isInteger(field.max), field.key);
  }
  // The statistics never go faster than the free quota allows for 50 channels.
  assert.ok((1440 / STATS_MINUTES.min) * 1 < DAILY_BUDGET.default);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.actions.length <= 10);
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
    for (const field of trigger.fields ?? []) {
      assert.notEqual(field.type, 'boolean', `${trigger.key}.${field.key}: no boolean filter`);
    }
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('says it is not affiliated with Google nor YouTube', () => {
  const intro = byKey(manifest.config_schema).get('intro').description;
  assert.match(intro.en, /Not affiliated with Google or YouTube/);
  assert.match(intro.fr, /Non affilié à Google ni à YouTube/);
  assert.match(source('../NOTICE'), /not affiliated with, endorsed by nor sponsored by Google/);
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog fields of Gladys 5.3: search keywords, available worldwide', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.ok(Array.isArray(manifest.keywords), 'keywords');
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10, '1 to 10 keywords');
  for (const keyword of manifest.keywords) {
    assert.ok(keyword.length <= 30 && keyword.trim().length >= 2, keyword);
  }
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'the name is already searched');
  // No `countries`: usable anywhere, the catalog shows it in every country.
  assert.equal(manifest.countries, undefined);
});
