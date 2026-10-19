import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUsage, quotaDay, nextReset } from '../src/usage.js';
import { dataPaths, silent } from './helpers/fixtures.js';

test('the quota day is the Pacific day of Google', () => {
  // 06:59 UTC is still the previous day in California (PDT, UTC-7).
  assert.equal(quotaDay(Date.parse('2026-10-20T06:59:00Z')), '2026-10-19');
  assert.equal(quotaDay(Date.parse('2026-10-20T07:00:00Z')), '2026-10-20');
  // Winter time (PST, UTC-8).
  assert.equal(quotaDay(Date.parse('2026-12-01T07:30:00Z')), '2026-11-30');
  assert.equal(
    new Date(nextReset(Date.parse('2026-10-20T05:12:34Z'))).toISOString(),
    '2026-10-20T07:00:00.000Z',
  );
  assert.equal(
    new Date(nextReset(Date.parse('2026-12-01T09:00:00Z'))).toISOString(),
    '2026-12-02T08:00:00.000Z',
  );
});

test('units are counted per Pacific day, kept across a restart, reset at midnight PT', () => {
  const paths = dataPaths();
  let clock = Date.parse('2026-10-20T06:00:00Z');
  const make = () =>
    createUsage({ path: paths.usage, getBudget: () => 3, now: () => clock, logger: silent });
  const usage = make();
  usage.record(1);
  usage.record(2);
  assert.equal(usage.used(), 3);
  assert.equal(usage.exhausted(), true);
  assert.equal(make().used(), 3, 'kept in /data');
  clock = Date.parse('2026-10-20T07:00:01Z');
  assert.equal(make().used(), 0, 'a new quota day');
  assert.equal(usage.remaining(), 3);
});
