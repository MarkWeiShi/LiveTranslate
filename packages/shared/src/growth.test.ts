// 成长升级规则单测（纳入 shared npm test → gate）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, xpToNextLevel } from './growth';

test('levelFromXp: 每 100 XP 升 1 级', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(99), 1);
  assert.equal(levelFromXp(100), 2);
  assert.equal(levelFromXp(250), 3);
  assert.equal(levelFromXp(-5), 1); // 负数兜底
});

test('xpToNextLevel', () => {
  assert.equal(xpToNextLevel(0), 100);
  assert.equal(xpToNextLevel(40), 60);
  assert.equal(xpToNextLevel(100), 100);
});
