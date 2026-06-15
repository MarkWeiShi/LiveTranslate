// SQLite has no array columns: learningLanguages/interests are stored as JSON strings.
export function parseStrArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeStrArr(a: string[] | null | undefined): string {
  return JSON.stringify(Array.isArray(a) ? a : []);
}
