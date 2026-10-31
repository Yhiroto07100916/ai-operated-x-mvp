import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXTrends } from '../src/trends.ts';

test('parses X trend names, ranks and optional post counts', () => {
  assert.deepEqual(parseXTrends({
    data: [
      { trend_name: '#Example', tweet_count: 1234 },
      { trend_name: 'News topic', tweet_count: null },
      { trend_name: '  ', tweet_count: 5 },
      null
    ]
  }), [
    { name: '#Example', rank: 1, tweet_count: 1234 },
    { name: 'News topic', rank: 2, tweet_count: null }
  ]);
});

test('handles empty and unexpected X API responses', () => {
  assert.deepEqual(parseXTrends(null), []);
  assert.deepEqual(parseXTrends({ data: 'unexpected' }), []);
  assert.deepEqual(parseXTrends({ data: [{ trend_name: 42 }] }), []);
});

test('limits trend names and result count', () => {
  const data = Array.from({ length: 55 }, (_, i) => ({ trend_name: 'T'.repeat(200) + i }));
  const trends = parseXTrends({ data });
  assert.equal(trends.length, 50);
  assert.equal(trends[0].name.length, 160);
});
