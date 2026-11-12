/**
 * Make free text safe to embed in a PostgREST `or=(…)` filter: drop characters with syntactic
 * meaning there (, ( ) " \ * % :) and limit the length. Callers also double-quote the value.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()"\\*%:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/** Build an ilike OR-filter over several columns for a sanitised term (or null if empty). */
export function ilikeAny(columns: string[], raw: string): string | null {
  const term = sanitizeSearch(raw);
  if (!term) return null;
  const like = `"%${term}%"`;
  return columns.map((c) => `${c}.ilike.${like}`).join(',');
}
