// Review text shares storage with AI assessment values. Only known file drafts
// are listed here; a key alone is never permission to reuse an earlier revision.
export function listReviewDrafts(drafts, files, diffVersion) {
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return [];
  const paths = [...new Set((files || []).map(file => file.path).filter(path => typeof path === 'string'))]
    .sort((a, b) => b.length - a.length);
  const items = [];
  for (const [key, text] of Object.entries(drafts)) {
    if (key.startsWith('checkpoint:') || typeof text !== 'string' || !text.trim()) continue;
    const path = paths.find(path => key.startsWith(`${path}:`));
    if (!path) continue;
    const match = /^(new|old):(file|[1-9]\d*)(?::refs:(.+))?$/.exec(key.slice(path.length + 1));
    if (!match || (match[1] === 'new' && match[3])) continue;
    const [, side, target, refs] = match;
    if (refs) {
      try {
        const version = JSON.parse(refs);
        if (!Array.isArray(version) || version.length !== 3 || !version.every(value => typeof value === 'string' && value)) continue;
      } catch { continue; }
    }
    const line = target === 'file' ? null : Number(target);
    if (line !== null && !Number.isSafeInteger(line)) continue;
    items.push({ key, path, line, side, text, current: side === 'new' || refs === diffVersion });
  }
  return items;
}
