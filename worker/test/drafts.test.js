import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDrafts } from '../src/drafts.ts';

const draft = {
  article_index: 0,
  body: 'これは十分な長さを持つ投稿案のテストです。',
  rationale: '記事の要点を反映しているため。',
  confidence: 0.8
};

test('parses a plain JSON array', () => {
  assert.deepEqual(parseDrafts(JSON.stringify([draft])), [draft]);
});

test('parses JSON arrays inside Markdown fences and surrounding prose', () => {
  const response = '生成結果です。\n```json\n' + JSON.stringify([draft]) + '\n```\n以上です。';
  assert.deepEqual(parseDrafts(response), [draft]);
});

test('handles nested arrays and bracket characters inside JSON strings', () => {
  const item = { ...draft, body: '配列 [1, 2] と引用符 \\" を含む投稿案です。' };
  assert.deepEqual(parseDrafts('結果: ' + JSON.stringify([item])), [item]);
});

test('filters malformed draft objects from a valid array', () => {
  assert.deepEqual(parseDrafts(JSON.stringify([draft, { body: 'invalid' }, null])), [draft]);
});

test('rejects responses without a valid JSON array', () => {
  assert.throws(() => parseDrafts('申し訳ありません。JSON形式で出力できません。'), /valid JSON array/);
});
