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
      else if (char === '\\') escaped = true;
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

function extractArray(value: unknown, depth = 0): unknown[] | null {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ['drafts', 'response', 'result', 'output']) {
      if (key in record) {
        const found = extractArray(record[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    const found = extractArray(parsed, depth + 1);
    if (found) return found;
  } catch {
    // Fall back to extracting an array from surrounding model text.
  }

  for (let start = value.indexOf('['); start >= 0; start = value.indexOf('[', start + 1)) {
    const end = findArrayEnd(value, start);
    if (end < 0) continue;
    try {
      const parsed: unknown = JSON.parse(value.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function parseDrafts(raw: unknown): Draft[] {
  const parsed = extractArray(raw);
  if (!parsed) {
    const responseType = raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw;
    throw new Error('AI response did not contain a valid JSON array (response type: ' + responseType + ').');
  }
  return parsed.filter((item): item is Draft =>
    typeof item === 'object' && item !== null &&
    Number.isInteger((item as Record<string, unknown>).article_index) &&
    typeof (item as Record<string, unknown>).body === 'string' &&
    typeof (item as Record<string, unknown>).rationale === 'string' &&
    typeof (item as Record<string, unknown>).confidence === 'number'
  );
}
