export type ParsedArticle = {
  source_name: string;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
};

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function cleanText(value: string, max = 1600): string {
  return decodeXml(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function readTag(block: string, tag: string): string {
  const match = block.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '\\s*>', 'i'));
  return match?.[1] || '';
}

function normalizePublishedDate(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseFeed(xml: string, source: string): ParsedArticle[] {
  const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)\s*>/gi) || [];
  const output: ParsedArticle[] = [];
  for (const block of blocks.slice(0, 12)) {
    const title = cleanText(readTag(block, 'title'), 240);
    const rawLink = readTag(block, 'link');
    const link = rawLink || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
    const url = decodeXml(link.trim());
    const content = cleanText(readTag(block, 'content:encoded') || readTag(block, 'description') ||
      readTag(block, 'summary') || readTag(block, 'content'));
    const published = cleanText(readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated'), 80);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || !title || !content) continue;
      output.push({ source_name: source, title, url: parsed.toString(), content, published_at: published ? normalizePublishedDate(published) : null });
    } catch { continue; }
  }
  return output;
}
