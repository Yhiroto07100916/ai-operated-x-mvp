import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/rss.ts';

test('parses RSS items, decodes entities, and strips embedded markup', () => {
  const xml = `<rss><channel><item>
    <title>Science &amp; Technology</title>
    <link>https://example.com/story?a=1&amp;b=2</link>
    <description><![CDATA[<p>Useful <strong>research</strong><script>ignoreMe()</script></p>]]></description>
    <pubDate>Sat, 31 Oct 2026 10:00:00 GMT</pubDate>
  </item></channel></rss>`;
  const [item] = parseFeed(xml, 'example.com');
  assert.equal(item.title, 'Science & Technology');
  assert.equal(item.url, 'https://example.com/story?a=1&b=2');
  assert.equal(item.content, 'Useful research');
  assert.equal(item.source_name, 'example.com');
  assert.equal(item.published_at, '2026-10-31T10:00:00.000Z');
});

test('parses Atom links expressed as href attributes', () => {
  const xml = `<feed><entry><title>Atom entry</title>
    <link rel="alternate" href="https://example.org/entry"/>
    <summary>Summary text</summary><updated>2026-10-31T10:00:00Z</updated>
  </entry></feed>`;
  const [item] = parseFeed(xml, 'example.org');
  assert.equal(item.url, 'https://example.org/entry');
  assert.equal(item.content, 'Summary text');
  assert.equal(item.published_at, '2026-10-31T10:00:00.000Z');
});

test('rejects unsafe URLs and incomplete entries', () => {
  const xml = `<rss><channel>
    <item><title>Unsafe</title><link>javascript:alert(1)</link><description>Text</description></item>
    <item><title>No content</title><link>https://example.com/no-content</link></item>
    <item><title>No URL</title><description>Text</description></item>
  </channel></rss>`;
  assert.deepEqual(parseFeed(xml, 'example.com'), []);
});

test('limits parsing to twelve entries and bounds field lengths', () => {
  const items = Array.from({ length: 15 }, (_, index) =>
    `<item><title>${'T'.repeat(300)} ${index}</title><link>https://example.com/${index}</link><description>${'C'.repeat(1800)}</description></item>`
  ).join('');
  const parsed = parseFeed(`<rss><channel>${items}</channel></rss>`, 'example.com');
  assert.equal(parsed.length, 12);
  assert.ok(parsed.every((item) => item.title.length <= 240 && item.content.length <= 1600));
});

test('normalizes invalid publication dates to null', () => {
  const xml = `<rss><channel><item>
    <title>Undated story</title><link>https://example.com/undated</link>
    <description>Story content</description><pubDate>not-a-date</pubDate>
  </item></channel></rss>`;
  const [item] = parseFeed(xml, 'example.com');
  assert.equal(item.published_at, null);
});
