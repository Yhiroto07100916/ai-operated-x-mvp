export type XTrend = {
  name: string;
  rank: number;
  tweet_count: number | null;
};

export function parseXTrends(payload: unknown): XTrend[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.slice(0, 50).flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as { trend_name?: unknown; tweet_count?: unknown };
    const name = typeof item.trend_name === 'string' ? item.trend_name.trim().slice(0, 160) : '';
    if (!name) return [];
    const count = typeof item.tweet_count === 'number' && Number.isFinite(item.tweet_count)
      ? Math.max(0, Math.floor(item.tweet_count)) : null;
    return [{ name, rank: index + 1, tweet_count: count }];
  });
}

export async function fetchXTrends(token: string): Promise<XTrend[]> {
  if (!token) return [];
  const response = await fetch('https://api.x.com/2/trends/by/woeid/23424856?max_trends=30&trend.fields=trend_name,tweet_count', {
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('X Trends API HTTP ' + response.status);
  return parseXTrends(await response.json());
}
