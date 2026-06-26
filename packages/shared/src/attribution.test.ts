// 多渠道归因解析单测（纳入 shared npm test → gate）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUtmParams, channelFromSource } from './attribution';

test('parseUtmParams reads utm_* + ref', () => {
  const u = parseUtmParams('?utm_source=x&utm_medium=social&utm_campaign=launch&ref=inv42');
  assert.equal(u.source, 'x');
  assert.equal(u.medium, 'social');
  assert.equal(u.campaign, 'launch');
  assert.equal(u.ref, 'inv42');
});

test('parseUtmParams tolerates no leading ? and missing keys', () => {
  const u = parseUtmParams('source=instagram');
  assert.equal(u.source, 'instagram');
  assert.equal(u.campaign, undefined);
});

test('channelFromSource normalizes aliases', () => {
  assert.equal(channelFromSource('twitter'), 'x');
  assert.equal(channelFromSource('X'), 'x');
  assert.equal(channelFromSource('fb'), 'messenger');
  assert.equal(channelFromSource('Messenger'), 'messenger');
  assert.equal(channelFromSource('ig'), 'instagram');
  assert.equal(channelFromSource('tg'), 'telegram');
  assert.equal(channelFromSource('weibo'), 'web'); // 未知来源 → web
  assert.equal(channelFromSource(undefined), 'direct'); // 无来源 → direct
});
