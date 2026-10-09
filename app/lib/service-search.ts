function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function matchesServiceSearch(name: string, query: string): boolean {
  return normalizeSearch(name).includes(normalizeSearch(query));
}
