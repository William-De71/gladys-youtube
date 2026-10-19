import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, parseRegistry, RegistryError, MAX_CHANNELS } from '../src/channels.js';
import { DEV, MUSIC, silent } from './helpers/fixtures.js';

const fakeConfig = () => {
  const writes = [];
  return {
    writes,
    setConfig: async (values) => {
      writes.push(values);
    },
  };
};

test('the stored registry keeps only valid channels, once each', () => {
  const list = parseRegistry(
    JSON.stringify([DEV, { id: 'nope' }, DEV, { ...MUSIC, uploads: 'bad' }]),
    silent,
  );
  assert.deepEqual(
    list.map((c) => [c.id, c.uploads]),
    [
      [DEV.id, DEV.uploads],
      [MUSIC.id, MUSIC.uploads],
    ],
  );
  assert.deepEqual(parseRegistry('{not json', silent), []);
  assert.deepEqual(parseRegistry(null, silent), []);
});

test('add, find, update and remove, each saved with setConfig before it applies', async () => {
  const gladys = fakeConfig();
  const registry = createRegistry(gladys, { logger: silent });
  await Promise.all([registry.add(DEV), registry.add(MUSIC)]);
  assert.equal(registry.list().length, 2, 'two quick additions keep both');
  assert.equal(gladys.writes.at(-1).channels.length, 2);
  const again = await registry.add({ ...DEV, title: 'Google Devs' });
  assert.equal(again.existed, true);
  assert.equal(registry.list().length, 2);
  for (const query of ['#1', '1', 'google devs', '@googledevelopers', 'googledevelopers', DEV.id]) {
    assert.equal(registry.find(query).id, DEV.id, query);
  }
  assert.throws(() => registry.find('#9'), RegistryError);
  assert.throws(
    () => registry.find(''),
    (err) => err.key === 'errorTarget',
  );
  const writes = gladys.writes.length;
  assert.equal(await registry.update([{ ...MUSIC }]), false);
  assert.equal(gladys.writes.length, writes, 'nothing changed, nothing written');
  assert.equal(await registry.update([{ ...MUSIC, title: 'YouTube Music' }]), true);
  assert.equal(registry.byId(MUSIC.id).title, 'YouTube Music');
  const removed = await registry.remove('#2');
  assert.equal(removed.id, MUSIC.id);
  assert.deepEqual(
    registry.list().map((c) => c.id),
    [DEV.id],
  );
});

test('a failed save changes nothing; the registry is bounded', async () => {
  const registry = createRegistry(
    {
      setConfig: async () => {
        throw new Error('database locked');
      },
    },
    { logger: silent },
  );
  await assert.rejects(registry.add(DEV), /database locked/);
  assert.equal(registry.list().length, 0);
  const full = createRegistry(fakeConfig(), { logger: silent });
  for (let i = 0; i < MAX_CHANNELS; i += 1) {
    await full.add({ id: `UC${String(i).padStart(22, '0')}`, title: `C${i}` });
  }
  await assert.rejects(full.add(DEV), (err) => err.key === 'errorFull');
});
