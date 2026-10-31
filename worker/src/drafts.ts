export type Draft = {
  article_index: number;
  body: string;
  rationale: string;
  confidence: number;
};

function findArrayEnd(input: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth++;
    else if (char === ']') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function parseDrafts(raw: string): Draft[] {
  const candidates: unknown[] = [];
  for (let start = raw.indexOf('['); start >= 0; start = raw.indexOf('[', start + 1)) {
    const end = findArrayEnd(raw, start);
    if (end < 0) continue;
    try {
      candidates.push(JSON.parse(raw.slice(start, end + 1)) as unknown);
    } catch {
      continue;
    }
  }

  const parsed = candidates.find(Array.isArray);
  if (!Array.isArray(parsed)) {
    throw new Error('AI response did not contain a valid JSON array (response length: ' + raw.length + ').');
  }
  return parsed.filter((item): item is Draft =>
    typeof item === 'object' && item !== null &&
    Number.isInteger((item as Record<string, unknown>).article_index) &&
    typeof (item as Record<string, unknown>).body === 'string' &&
    typeof (item as Record<string, unknown>).rationale === 'string' &&
    typeof (item as Record<string, unknown>).confidence === 'number'
  );
}
